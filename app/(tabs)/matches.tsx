import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/shared/utils/constants';
import { CardSkeleton } from '../../src/shared/components/CardSkeleton';
import type { BidirectionalMatch, Match } from '../../src/lib/types';

type IncomingRequest = Match & {
  requester_name: string;
  items: { give_member: string; give_goods: string; get_member: string; get_goods: string }[];
};

export default function MatchesScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const colors = useColors();
  const [matches, setMatches] = useState<BidirectionalMatch[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  // partner_id → { matchId, status } 既存マッチの状態
  const [existingMatches, setExistingMatches] = useState<Map<string, { matchId: number; status: string }>>(new Map());

  const findMatches = useCallback(async () => {
    if (!user || !activeEvent) {
      setLoading(false);
      return;
    }

    const [matchRes, requestRes, existingRes] = await Promise.all([
      supabase.rpc('find_bidirectional_matches', {
        p_user_id: user.id,
        p_event_id: activeEvent.id,
      }),
      supabase
        .from('matches')
        .select(`
          *,
          match_items(*, have_items(*, members(*), goods_types(*)))
        `)
        .eq('user_b', user.id)
        .eq('event_id', activeEvent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      // 自分が関わっている pending/accepted マッチを取得
      supabase
        .from('matches')
        .select('id, user_a, user_b, status')
        .eq('event_id', activeEvent.id)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .in('status', ['pending', 'accepted']),
    ]);

    if (!matchRes.error && matchRes.data) {
      setMatches(matchRes.data);
    }

    // 相手ごとの既存マッチ状態を構築
    const eMap = new Map<string, { matchId: number; status: string }>();
    if (!existingRes.error && existingRes.data) {
      for (const m of existingRes.data) {
        const partnerId = m.user_a === user.id ? m.user_b : m.user_a;
        eMap.set(partnerId, { matchId: m.id, status: m.status });
      }
    }
    setExistingMatches(eMap);

    if (!requestRes.error && requestRes.data) {
      // リクエスト送信者のプロフィールを取得
      const requesterIds = [...new Set(requestRes.data.map((r: any) => r.user_a))];
      const profileMap = new Map<string, string>();
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', requesterIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, p.display_name || 'ユーザー');
          }
        }
      }

      const parsed: IncomingRequest[] = requestRes.data.map((r: any) => {
        const myItems = (r.match_items || []).filter((i: any) => i.giver_id === user.id);
        const theirItems = (r.match_items || []).filter((i: any) => i.giver_id !== user.id);
        const items = myItems.map((mi: any, idx: number) => ({
          give_member: mi.have_items?.members?.name || '',
          give_goods: mi.have_items?.goods_types?.name || '',
          get_member: theirItems[idx]?.have_items?.members?.name || '',
          get_goods: theirItems[idx]?.have_items?.goods_types?.name || '',
        }));
        return {
          ...r,
          requester_name: profileMap.get(r.user_a) || 'ユーザー',
          items,
        };
      });
      setIncomingRequests(parsed);
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

  // Realtime: マッチのステータス変更 & イベント参加者の変動を即座に反映
  useEffect(() => {
    if (!user || !activeEvent) return;
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `event_id=eq.${activeEvent.id}`,
        },
        () => { findMatches(); }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_participants',
        },
        () => { findMatches(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // 受信リクエスト済みの相手をマッチ候補から除外し、取引中を上に並べる
  const incomingPartnerIds = new Set(incomingRequests.map((r) => r.user_a));
  const filteredMatches = matches
    .filter((m) => !incomingPartnerIds.has(m.partner_id))
    .sort((a, b) => {
      const statusA = existingMatches.get(a.partner_id)?.status;
      const statusB = existingMatches.get(b.partner_id)?.status;
      const order = (s?: string) => s === 'accepted' ? 0 : s === 'pending' ? 1 : 2;
      return order(statusA) - order(statusB);
    });

  const renderMatch = ({ item }: { item: BidirectionalMatch }) => {
    const existing = existingMatches.get(item.partner_id);

    const buttonLabel = existing?.status === 'accepted'
      ? '取引中 — 詳細を見る'
      : existing?.status === 'pending'
        ? 'リクエスト送信済み'
        : '交換をリクエスト';

    const buttonColor = existing?.status === 'accepted'
      ? COLORS.success
      : existing?.status === 'pending'
        ? COLORS.warning
        : colors.primary;

    const handlePress = () => {
      if (existing) {
        router.push(`/(modals)/match-detail?matchId=${existing.matchId}`);
      } else {
        handleCreateMatch(item);
      }
    };

    return (
      <Card style={[
        styles.card,
        existing?.status === 'accepted' && { borderColor: COLORS.success, borderWidth: 2 },
      ]}>
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
            buttonColor={buttonColor}
            style={styles.actionButton}
            contentStyle={{ paddingVertical: 4 }}
            labelStyle={{ fontWeight: 'bold' }}
            onPress={handlePress}
          >
            {buttonLabel}
          </Button>
        </Card.Content>
      </Card>
    );
  };

  const renderIncomingRequests = () => {
    if (incomingRequests.length === 0) return null;
    return (
      <View style={styles.incomingSection}>
        <View style={[styles.incomingHeader, { backgroundColor: colors.primary }]}>
          <Text style={styles.incomingHeaderText}>
            交換リクエストが届いています ({incomingRequests.length}件)
          </Text>
        </View>
        {incomingRequests.map((req) => (
          <TouchableOpacity
            key={req.id}
            activeOpacity={0.7}
            onPress={() => router.push(`/(modals)/match-detail?matchId=${req.id}`)}
          >
            <Card style={[styles.incomingCard, { borderColor: colors.primary, borderWidth: 2 }]}>
              <Card.Content>
                <View style={styles.partnerRow}>
                  <View style={[styles.partnerAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.partnerAvatarText, { color: colors.primaryDark }]}>
                      {(req.requester_name || '?').charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerName}>{req.requester_name}</Text>
                    <Text style={styles.incomingLabel}>からのリクエスト</Text>
                  </View>
                </View>
                {req.items.map((item, idx) => (
                  <View key={idx} style={styles.tradeRow}>
                    <View style={styles.tradeItem}>
                      <Text style={styles.tradeLabel}>あなたが渡す</Text>
                      <View style={[styles.giveTag, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.giveTagText, { color: colors.primaryDark }]}>{item.give_member}</Text>
                        <Text style={styles.goodsText}>{item.give_goods}</Text>
                      </View>
                    </View>
                    <Text style={[styles.arrow, { color: colors.primary }]}>⇄</Text>
                    <View style={styles.tradeItem}>
                      <Text style={styles.tradeLabel}>あなたがもらう</Text>
                      <View style={styles.getTag}>
                        <Text style={styles.getTagText}>{item.get_member}</Text>
                        <Text style={styles.goodsText}>{item.get_goods}</Text>
                      </View>
                    </View>
                  </View>
                ))}
                <Button
                  mode="contained"
                  buttonColor={colors.primary}
                  style={styles.actionButton}
                  contentStyle={{ paddingVertical: 4 }}
                  labelStyle={{ fontWeight: 'bold' }}
                  onPress={() => router.push(`/(modals)/match-detail?matchId=${req.id}`)}
                >
                  確認する
                </Button>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredMatches}
        renderItem={renderMatch}
        keyExtractor={(item, index) =>
          `${item.partner_id}-${item.my_have_id}-${item.their_have_id}-${index}`
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderIncomingRequests}
        ListEmptyComponent={
          loading ? (
            <View>
              <CardSkeleton variant="match" />
              <CardSkeleton variant="match" />
              <CardSkeleton variant="match" />
            </View>
          ) : incomingRequests.length > 0 ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                マッチが見つかりませんでした。{'\n'}持ち物を追加してみましょう！
              </Text>
            </View>
          )
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
    borderRadius: BORDER_RADIUS.lg,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.xl,
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
    borderRadius: BORDER_RADIUS.md,
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
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  giveTagText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  getTag: {
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.sm,
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
    borderRadius: BORDER_RADIUS.md,
  },
  incomingSection: {
    marginBottom: SPACING.lg,
  },
  incomingHeader: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  incomingHeaderText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  incomingCard: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
  },
  incomingLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
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
