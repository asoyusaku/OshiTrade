import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { BidirectionalMatch } from '../../src/lib/types';

export default function MatchesScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const [matches, setMatches] = useState<BidirectionalMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const findMatches = useCallback(async () => {
    if (!user || !activeEvent) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('find_bidirectional_matches', {
      p_user_id: user.id,
      p_event_id: activeEvent.id,
    });

    if (!error && data) {
      setMatches(data);
    }
    setLoading(false);
  }, [user, activeEvent]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  const onRefresh = async () => {
    setRefreshing(true);
    await findMatches();
    setRefreshing(false);
  };

  const handleCreateMatch = async (match: BidirectionalMatch) => {
    if (!user || !activeEvent) return;

    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('event_id', activeEvent.id)
      .or(`and(user_a.eq.${user.id},user_b.eq.${match.partner_id}),and(user_a.eq.${match.partner_id},user_b.eq.${user.id})`)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existingMatch) {
      router.push(`/(modals)/match-detail?matchId=${existingMatch.id}`);
      return;
    }

    const { data: newMatch, error } = await supabase
      .from('matches')
      .insert({
        event_id: activeEvent.id,
        user_a: user.id,
        user_b: match.partner_id,
        status: 'pending',
      })
      .select()
      .single();

    if (!error && newMatch) {
      await supabase.from('match_items').insert([
        {
          match_id: newMatch.id,
          giver_id: user.id,
          have_item_id: match.my_have_id,
          want_item_id: match.their_want_id,
        },
        {
          match_id: newMatch.id,
          giver_id: match.partner_id,
          have_item_id: match.their_have_id,
          want_item_id: match.my_want_id,
        },
      ]);

      router.push(`/(modals)/match-detail?matchId=${newMatch.id}`);
    }
  };

  if (!activeEvent) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          まずホーム画面からイベントに参加してください
        </Text>
      </View>
    );
  }

  const renderMatch = ({ item }: { item: BidirectionalMatch }) => (
    <Card style={styles.card} onPress={() => handleCreateMatch(item)}>
      <Card.Content>
        <Text style={styles.partnerName}>{item.partner_name}</Text>
        <View style={styles.tradeRow}>
          <View style={styles.tradeItem}>
            <Text style={styles.tradeLabel}>あなたが渡す</Text>
            <Chip style={styles.giveChip} textStyle={styles.giveChipText}>
              {item.i_give_member} / {item.i_give_goods}
            </Chip>
          </View>
          <Text style={styles.arrow}>⇄</Text>
          <View style={styles.tradeItem}>
            <Text style={styles.tradeLabel}>あなたがもらう</Text>
            <Chip style={styles.getChip} textStyle={styles.getChipText}>
              {item.i_get_member} / {item.i_get_goods}
            </Chip>
          </View>
        </View>
        <Button
          mode="contained"
          buttonColor={COLORS.primary}
          style={styles.actionButton}
          onPress={() => handleCreateMatch(item)}
        >
          交換をリクエスト
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item, index) =>
          `${item.partner_id}-${item.my_have_id}-${item.their_have_id}-${index}`
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading
                ? 'マッチを検索中...'
                : 'マッチが見つかりませんでした。\n持ち物を追加してみましょう！'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  list: {
    padding: SPACING.md,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  partnerName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  tradeItem: {
    flex: 1,
    alignItems: 'center',
  },
  tradeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  arrow: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.primary,
    marginHorizontal: SPACING.sm,
  },
  giveChip: {
    backgroundColor: '#FFF3CD',
  },
  giveChipText: {
    fontSize: FONT_SIZE.xs,
    color: '#856404',
  },
  getChip: {
    backgroundColor: '#D4EDDA',
  },
  getChipText: {
    fontSize: FONT_SIZE.xs,
    color: '#155724',
  },
  actionButton: {
    marginTop: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
});
