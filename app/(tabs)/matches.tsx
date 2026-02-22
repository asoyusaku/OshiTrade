import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { BidirectionalMatch } from '../../src/lib/types';

export default function MatchesScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const colors = useColors();
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

  useFocusEffect(
    useCallback(() => {
      findMatches();
    }, [findMatches])
  );

  // マッチを定期的に再検索（10秒間隔）
  useEffect(() => {
    if (!user || !activeEvent) return;
    const interval = setInterval(() => {
      findMatches();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, activeEvent, findMatches]);

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
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.partnerRow}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerAvatarText}>
              {(item.partner_name || '?').charAt(0)}
            </Text>
          </View>
          <Text style={styles.partnerName}>{item.partner_name || 'ユーザー'}</Text>
        </View>

        <View style={styles.tradeRow}>
          <View style={styles.tradeItem}>
            <Text style={styles.tradeLabel}>あなたが渡す</Text>
            <View style={styles.giveTag}>
              <Text style={styles.giveTagText}>{item.i_give_member}</Text>
              <Text style={styles.goodsText}>{item.i_give_goods}</Text>
            </View>
          </View>
          <Text style={styles.arrow}>⇄</Text>
          <View style={styles.tradeItem}>
            <Text style={styles.tradeLabel}>あなたがもらう</Text>
            <View style={styles.getTag}>
              <Text style={styles.getTagText}>{item.i_get_member}</Text>
              <Text style={styles.goodsText}>{item.i_get_goods}</Text>
            </View>
          </View>
        </View>

        <Button
          mode="contained"
          buttonColor={colors.primary}
          style={styles.actionButton}
          contentStyle={{ paddingVertical: 4 }}
          labelStyle={{ fontWeight: 'bold' }}
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
    borderRadius: 16,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  partnerAvatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  partnerName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.sm,
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
    marginHorizontal: SPACING.xs,
  },
  giveTag: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  giveTagText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  getTag: {
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  getTagText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  goodsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    marginTop: SPACING.xs,
    borderRadius: 12,
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
