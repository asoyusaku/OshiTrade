import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Chip, Divider } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { Match, MatchItem, Profile } from '../../src/lib/types';

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId || !user) return;

    const fetchMatch = async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', parseInt(matchId))
        .single();

      if (!matchData) return;
      setMatch(matchData);

      const partnerId =
        matchData.user_a === user.id ? matchData.user_b : matchData.user_a;

      const [itemsRes, profileRes] = await Promise.all([
        supabase
          .from('match_items')
          .select(`
            *,
            have_items(*, members(*), goods_types(*)),
            want_items(*, members(*), goods_types(*))
          `)
          .eq('match_id', matchData.id),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', partnerId)
          .single(),
      ]);

      if (itemsRes.data) setMatchItems(itemsRes.data);
      if (profileRes.data) setPartner(profileRes.data);
      setLoading(false);
    };

    fetchMatch();
  }, [matchId, user]);

  const handleAccept = async () => {
    if (!match) return;
    await supabase
      .from('matches')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', match.id);
    setMatch({ ...match, status: 'accepted' });
  };

  const handleComplete = async () => {
    if (!match) return;
    Alert.alert('取引完了', 'この取引を完了しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '完了',
        onPress: async () => {
          await supabase
            .from('matches')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', match.id);

          // Mark items as traded
          for (const item of matchItems) {
            await supabase
              .from('have_items')
              .update({ is_available: false })
              .eq('id', item.have_item_id);
            await supabase
              .from('want_items')
              .update({ is_fulfilled: true })
              .eq('id', item.want_item_id);
          }

          setMatch({ ...match, status: 'completed' });
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!match) return;
    Alert.alert('取引キャンセル', 'この取引をキャンセルしますか？', [
      { text: '戻る', style: 'cancel' },
      {
        text: 'キャンセルする',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('matches')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', match.id);
          setMatch({ ...match, status: 'cancelled' });
        },
      },
    ]);
  };

  const handleStartChat = async () => {
    if (!match || !user) return;

    // Check if chat room already exists
    const { data: existing } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('match_id', match.id)
      .maybeSingle();

    if (existing) {
      router.push(`/(tabs)/chat/${existing.id}`);
      return;
    }

    const partnerId = match.user_a === user.id ? match.user_b : match.user_a;

    const { data: newRoom } = await supabase
      .from('chat_rooms')
      .insert({
        match_id: match.id,
        user_a: user.id,
        user_b: partnerId,
      })
      .select()
      .single();

    if (newRoom) {
      router.push(`/(tabs)/chat/${newRoom.id}`);
    }
  };

  const statusLabel = {
    pending: '承認待ち',
    accepted: '承認済み',
    completed: '完了',
    cancelled: 'キャンセル済み',
  };

  const statusColor = {
    pending: COLORS.warning,
    accepted: COLORS.success,
    completed: COLORS.secondary,
    cancelled: COLORS.error,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  if (!match || !partner) return null;

  const myItems = matchItems.filter((i) => i.giver_id === user?.id);
  const theirItems = matchItems.filter((i) => i.giver_id !== user?.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.partnerName}>{partner.display_name || partner.username}</Text>
        <Chip
          style={{ backgroundColor: statusColor[match.status] }}
          textStyle={{ color: COLORS.white }}
        >
          {statusLabel[match.status]}
        </Chip>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>あなたが渡すもの</Text>
          {myItems.map((item) => (
            <View key={item.id} style={styles.tradeItemRow}>
              <Text style={styles.memberName}>
                {item.have_items?.members?.name}
              </Text>
              <Text style={styles.goodsName}>
                {item.have_items?.goods_types?.name}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>あなたがもらうもの</Text>
          {theirItems.map((item) => (
            <View key={item.id} style={styles.tradeItemRow}>
              <Text style={styles.memberName}>
                {item.have_items?.members?.name}
              </Text>
              <Text style={styles.goodsName}>
                {item.have_items?.goods_types?.name}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      {match.status === 'pending' && match.user_b === user?.id && (
        <Button
          mode="contained"
          onPress={handleAccept}
          buttonColor={COLORS.success}
          style={styles.actionButton}
        >
          承認する
        </Button>
      )}

      {(match.status === 'pending' || match.status === 'accepted') && (
        <>
          <Button
            mode="contained"
            onPress={handleStartChat}
            buttonColor={COLORS.primary}
            style={styles.actionButton}
          >
            チャットを開始
          </Button>

          {match.status === 'accepted' && (
            <Button
              mode="contained"
              onPress={handleComplete}
              buttonColor={COLORS.success}
              style={styles.actionButton}
            >
              取引完了
            </Button>
          )}

          <Button
            mode="outlined"
            onPress={handleCancel}
            textColor={COLORS.error}
            style={styles.actionButton}
          >
            キャンセル
          </Button>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  partnerName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  tradeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  memberName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  goodsName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    marginVertical: SPACING.md,
  },
  actionButton: {
    marginBottom: SPACING.sm,
  },
});
