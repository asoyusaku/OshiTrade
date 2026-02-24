import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Card, Chip, Searchbar, Snackbar, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/shared/utils/constants';
import type { Event, IdolGroup } from '../../src/lib/types';

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeEvent, setActiveEvent } = useEventStore();
  const colors = useColors();
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<IdolGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snackMessage, setSnackMessage] = useState('');

  const fetchData = useCallback(async () => {
    const [eventsRes, groupsRes] = await Promise.all([
      supabase
        .from('events')
        .select('*, idol_groups(*)')
        .eq('is_active', true)
        .order('event_date', { ascending: true }),
      supabase
        .from('idol_groups')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (groupsRes.data) setGroups(groupsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleJoinEvent = async (event: Event) => {
    if (!user) {
      Alert.alert('ログインが必要です', 'イベントに参加するにはログインしてください。');
      return;
    }

    // 既に参加中のイベントをタップした場合は解除
    if (activeEvent?.id === event.id) {
      await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', user.id);
      setActiveEvent(null);
      setSnackMessage('イベントの参加を解除しました');
      return;
    }

    const { error } = await supabase
      .from('event_participants')
      .upsert(
        { event_id: event.id, user_id: user.id },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true }
      );

    if (error) {
      Alert.alert('エラー', 'イベントへの参加に失敗しました。\n' + error.message);
      return;
    }

    setActiveEvent(event);
    setSnackMessage(`「${event.name}」に参加しました！`);
  };

  const filteredEvents = events.filter((e) => {
    if (selectedGroup && e.group_id !== selectedGroup) return false;
    if (searchQuery && !e.name.includes(searchQuery)) return false;
    return true;
  });

  const renderEvent = ({ item }: { item: Event }) => {
    const isActive = activeEvent?.id === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleJoinEvent(item)}
      >
        <Card style={[styles.card, isActive && { borderColor: colors.primary, borderWidth: 2 }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={[styles.groupTag, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.groupTagText, { color: colors.primaryDark }]}>
                  {item.idol_groups?.name || ''}
                </Text>
              </View>
              {isActive && (
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>参加中</Text>
                </View>
              )}
            </View>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventDetail}>
              {item.event_date} {item.venue ? `@ ${item.venue}` : ''}
            </Text>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="イベントを検索..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      <View style={styles.filterRow}>
        <Chip
          selected={selectedGroup === null}
          onPress={() => setSelectedGroup(null)}
          style={styles.filterChip}
        >
          すべて
        </Chip>
        {groups.map((g) => (
          <Chip
            key={g.id}
            selected={selectedGroup === g.id}
            onPress={() => setSelectedGroup(g.id)}
            style={styles.filterChip}
          >
            {g.name}
          </Chip>
        ))}
      </View>

      {activeEvent && (
        <View style={[styles.activeEventBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.bannerText}>
            参加中: {activeEvent.name}
          </Text>
        </View>
      )}

      <View style={styles.suggestRow}>
        <Button
          mode="outlined"
          icon="lightbulb-on-outline"
          onPress={() => router.push('/(modals)/suggest-event')}
          style={[styles.suggestButton, { borderColor: colors.primary }]}
          textColor={colors.primary}
        >
          イベントを提案する
        </Button>
      </View>

      <FlatList
        data={filteredEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { marginTop: SPACING.md }]}>読み込み中...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>イベントがありません</Text>
            </View>
          )
        }
      />

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={2500}
        style={styles.snackbar}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    margin: SPACING.md,
    backgroundColor: COLORS.white,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    marginBottom: SPACING.xs,
  },
  activeEventBanner: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  bannerText: {
    color: COLORS.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  list: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  card: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  activeCard: {
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  groupTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.md,
  },
  activeGroupTag: {},
  groupTagText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  activeTag: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.md,
  },
  activeTagText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  eventName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  eventDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  empty: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
  },
  suggestRow: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  suggestButton: {
    borderRadius: BORDER_RADIUS.md,
  },
  snackbar: {
    backgroundColor: COLORS.text,
  },
});
