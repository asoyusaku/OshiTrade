import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Pressable, Modal, Dimensions } from 'react-native';
import { Text, Button, Card, Chip, Divider, IconButton } from 'react-native-paper';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/shared/utils/constants';
import type { Match, MatchItem, Profile } from '../../src/lib/types';

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  const fetchMatch = useCallback(async () => {
    if (!matchId || !user) return;

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
          have_items(*, members(*), goods_types(*), goods_variants(*)),
          want_items(*, members(*), goods_types(*), goods_variants(*))
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
  }, [matchId, user]);

  useFocusEffect(
    useCallback(() => {
      fetchMatch();
    }, [fetchMatch])
  );

  // リアルタイムでステータス変更を監視
  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const updated = payload.new as Match;
          setMatch((prev) => prev ? { ...prev, status: updated.status, updated_at: updated.updated_at } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const handleAccept = async () => {
    if (!match || !user) return;

    // 自分が渡すアイテムの在庫チェック
    const myGiveItems = matchItems.filter((i) => i.giver_id === user.id);
    for (const item of myGiveItems) {
      if (!item.have_items) continue;
      // 同じ have_item が他の承認済みマッチで使用されている数を確認
      const { data: usedMatches } = await supabase
        .from('match_items')
        .select('id, matches!inner(status)')
        .eq('have_item_id', item.have_item_id)
        .eq('giver_id', user.id)
        .eq('matches.status', 'accepted');

      const usedCount = usedMatches?.length ?? 0;
      const quantity = item.have_items.quantity ?? 1;
      if (usedCount >= quantity) {
        Alert.alert(
          '在庫不足',
          `${item.have_items.members?.name} ${item.have_items.goods_types?.name} の在庫がありません。先に承認済みの取引を完了またはキャンセルしてください。`
        );
        return;
      }
    }

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

          // have_items/want_itemsの更新はDBトリガー(on_match_completed)が自動実行

          // チャットルーム・位置共有をクリーンアップ
          const { data: chatRoom } = await supabase
            .from('chat_rooms')
            .select('id')
            .eq('match_id', match.id)
            .maybeSingle();

          if (chatRoom) {
            // 位置共有を停止
            await supabase
              .from('location_shares')
              .update({ is_active: false })
              .eq('chat_room_id', chatRoom.id);
            // メッセージ削除 → チャットルーム削除
            await supabase
              .from('messages')
              .delete()
              .eq('chat_room_id', chatRoom.id);
            await supabase
              .from('chat_rooms')
              .delete()
              .eq('id', chatRoom.id);
          }

          setMatch({ ...match, status: 'completed' });
          Alert.alert('完了', '取引が完了しました！', [
            { text: 'OK', onPress: () => router.back() },
          ]);
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

          // チャットルーム・位置共有をクリーンアップ
          const { data: chatRoom } = await supabase
            .from('chat_rooms')
            .select('id')
            .eq('match_id', match.id)
            .maybeSingle();

          if (chatRoom) {
            await supabase
              .from('location_shares')
              .update({ is_active: false })
              .eq('chat_room_id', chatRoom.id);
            await supabase
              .from('messages')
              .delete()
              .eq('chat_room_id', chatRoom.id);
            await supabase
              .from('chat_rooms')
              .delete()
              .eq('id', chatRoom.id);
          }

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
      router.dismiss();
      setTimeout(() => {
        router.navigate('/(tabs)/chat');
        setTimeout(() => router.push(`/(tabs)/chat/${existing.id}`), 50);
      }, 100);
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
      router.dismiss();
      setTimeout(() => {
        router.navigate('/(tabs)/chat');
        setTimeout(() => router.push(`/(tabs)/chat/${newRoom.id}`), 50);
      }, 100);
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
              {item.have_items?.photo_url && (
                <Pressable onPress={() => setZoomPhoto(item.have_items!.photo_url!)}>
                  <Image source={{ uri: item.have_items.photo_url }} style={styles.tradePhoto} />
                </Pressable>
              )}
              <View>
                <Text style={styles.memberName}>
                  {item.have_items?.members?.name}
                </Text>
                <Text style={styles.goodsName}>
                  {item.have_items?.goods_types?.name}
                  {item.have_items?.goods_variants?.variant_name ? ` (${item.have_items.goods_variants.variant_name})` : ''}
                </Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>あなたがもらうもの</Text>
          {theirItems.map((item) => (
            <View key={item.id} style={styles.tradeItemRow}>
              {item.have_items?.photo_url && (
                <Pressable onPress={() => setZoomPhoto(item.have_items!.photo_url!)}>
                  <Image source={{ uri: item.have_items.photo_url }} style={styles.tradePhoto} />
                </Pressable>
              )}
              <View>
                <Text style={styles.memberName}>
                  {item.have_items?.members?.name}
                </Text>
                <Text style={styles.goodsName}>
                  {item.have_items?.goods_types?.name}
                  {item.have_items?.goods_variants?.variant_name ? ` (${item.have_items.goods_variants.variant_name})` : ''}
                </Text>
              </View>
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

      <Modal
        visible={!!zoomPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomPhoto(null)}
      >
        <Pressable style={styles.zoomOverlay} onPress={() => setZoomPhoto(null)}>
          <View style={styles.zoomContainer}>
            {zoomPhoto && (
              <Image
                source={{ uri: zoomPhoto }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            )}
            <IconButton
              icon="close"
              iconColor={COLORS.white}
              size={28}
              style={styles.zoomClose}
              onPress={() => setZoomPhoto(null)}
            />
          </View>
        </Pressable>
      </Modal>
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
  tradePhoto: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
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
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').width,
  },
  zoomClose: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
