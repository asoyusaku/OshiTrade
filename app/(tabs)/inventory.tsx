import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Image } from 'react-native';
import { Text, FAB, SegmentedButtons, Card, IconButton } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/shared/utils/constants';
import { CardSkeleton } from '../../src/shared/components/CardSkeleton';
import type { HaveItem, WantItem } from '../../src/lib/types';

type Tab = 'have' | 'want';

export default function InventoryScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('have');
  const [haveItems, setHaveItems] = useState<HaveItem[]>([]);
  const [wantItems, setWantItems] = useState<WantItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user || !activeEvent) {
      setLoading(false);
      return;
    }

    const [haveRes, wantRes] = await Promise.all([
      supabase
        .from('have_items')
        .select('*, members(*), goods_types(*), goods_variants(*)')
        .eq('user_id', user.id)
        .eq('event_id', activeEvent.id)
        .eq('is_available', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('want_items')
        .select('*, members(*), goods_types(*), goods_variants(*)')
        .eq('user_id', user.id)
        .eq('event_id', activeEvent.id)
        .eq('is_fulfilled', false)
        .order('created_at', { ascending: false }),
    ]);
    if (haveRes.data) setHaveItems(haveRes.data);
    if (wantRes.data) setWantItems(wantRes.data);
    setLoading(false);
  }, [user, activeEvent]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const deleteHaveItem = async (id: number) => {
    Alert.alert('削除確認', 'このアイテムを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          // まずdeleteを試み、外部キー制約エラーならis_available=falseに更新
          const { error } = await supabase.from('have_items').delete().eq('id', id);
          if (error) {
            const { error: updateError } = await supabase
              .from('have_items')
              .update({ is_available: false })
              .eq('id', id);
            if (updateError) {
              Alert.alert('エラー', '削除に失敗しました: ' + updateError.message);
              return;
            }
          }
          setHaveItems((prev) => prev.filter((item) => item.id !== id));
        },
      },
    ]);
  };

  const deleteWantItem = async (id: number) => {
    Alert.alert('削除確認', 'このアイテムを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('want_items').delete().eq('id', id);
          if (error) {
            const { error: updateError } = await supabase
              .from('want_items')
              .update({ is_fulfilled: true })
              .eq('id', id);
            if (updateError) {
              Alert.alert('エラー', '削除に失敗しました: ' + updateError.message);
              return;
            }
          }
          setWantItems((prev) => prev.filter((item) => item.id !== id));
        },
      },
    ]);
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

  const renderHaveItem = ({ item }: { item: HaveItem }) => (
    <Card style={styles.itemCard}>
      <Card.Content style={styles.itemContent}>
        {item.photo_url && (
          <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.memberName}>{item.members?.name}</Text>
          <Text style={styles.goodsType}>
            {item.goods_types?.name}
            {item.goods_variants?.variant_name ? ` (${item.goods_variants.variant_name})` : ''}
          </Text>
          {item.quantity > 1 && (
            <Text style={styles.quantity}>x{item.quantity}</Text>
          )}
        </View>
        <IconButton
          icon="delete-outline"
          iconColor={COLORS.error}
          size={20}
          onPress={() => deleteHaveItem(item.id)}
        />
      </Card.Content>
    </Card>
  );

  const renderWantItem = ({ item }: { item: WantItem }) => (
    <Card style={styles.itemCard}>
      <Card.Content style={styles.itemContent}>
        <View style={styles.itemInfo}>
          <Text style={styles.memberName}>{item.members?.name}</Text>
          <Text style={styles.goodsType}>
            {item.goods_types?.name}
            {item.goods_variants?.variant_name ? ` (${item.goods_variants.variant_name})` : ''}
          </Text>
          {item.quantity > 1 && (
            <Text style={styles.quantity}>x{item.quantity}</Text>
          )}
        </View>
        <IconButton
          icon="delete-outline"
          iconColor={COLORS.error}
          size={20}
          onPress={() => deleteWantItem(item.id)}
        />
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        buttons={[
          { value: 'have', label: `持っている (${haveItems.length})` },
          { value: 'want', label: `欲しい (${wantItems.length})` },
        ]}
        style={styles.segmented}
      />

      {tab === 'have' ? (
        <FlatList
          data={haveItems}
          renderItem={renderHaveItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.list}>
                <CardSkeleton variant="list" />
                <CardSkeleton variant="list" />
                <CardSkeleton variant="list" />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>持っているグッズを追加しましょう</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={wantItems}
          renderItem={renderWantItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.list}>
                <CardSkeleton variant="list" />
                <CardSkeleton variant="list" />
                <CardSkeleton variant="list" />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>欲しいグッズを追加しましょう</Text>
              </View>
            )
          }
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color={COLORS.white}
        onPress={() =>
          router.push(tab === 'have' ? '/(modals)/add-have' : '/(modals)/add-want')
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
  segmented: {
    margin: SPACING.md,
  },
  list: {
    padding: SPACING.md,
    paddingTop: 0,
    paddingBottom: 80,
  },
  itemCard: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  goodsType: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  quantity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    backgroundColor: COLORS.primary,
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
