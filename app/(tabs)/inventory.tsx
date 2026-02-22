import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, FAB, SegmentedButtons, Card, IconButton } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { HaveItem, WantItem } from '../../src/lib/types';

type Tab = 'have' | 'want';

export default function InventoryScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const [tab, setTab] = useState<Tab>('have');
  const [haveItems, setHaveItems] = useState<HaveItem[]>([]);
  const [wantItems, setWantItems] = useState<WantItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user || !activeEvent) return;

    const [haveRes, wantRes] = await Promise.all([
      supabase
        .from('have_items')
        .select('*, members(*), goods_types(*)')
        .eq('user_id', user.id)
        .eq('event_id', activeEvent.id)
        .eq('is_available', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('want_items')
        .select('*, members(*), goods_types(*)')
        .eq('user_id', user.id)
        .eq('event_id', activeEvent.id)
        .eq('is_fulfilled', false)
        .order('created_at', { ascending: false }),
    ]);
    if (haveRes.data) setHaveItems(haveRes.data);
    if (wantRes.data) setWantItems(wantRes.data);
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
          await supabase.from('have_items').delete().eq('id', id);
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
          await supabase.from('want_items').delete().eq('id', id);
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
        <View style={styles.itemInfo}>
          <Text style={styles.memberName}>{item.members?.name}</Text>
          <Text style={styles.goodsType}>{item.goods_types?.name}</Text>
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
          <Text style={styles.goodsType}>{item.goods_types?.name}</Text>
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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>持っているグッズを追加しましょう</Text>
            </View>
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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>欲しいグッズを追加しましょう</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
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
