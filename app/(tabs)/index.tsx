import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Chip, Searchbar, Snackbar } from 'react-native-paper';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { Event, IdolGroup } from '../../src/lib/types';

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeEvent, setActiveEvent } = useEventStore();
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
      setActiveEvent(null);
      setSnackMessage('イベントの参加を解除しました');
      return;
    }

    const { error } = await supabase
      .from('event_participants')
      .upsert({ event_id: event.id, user_id: user.id });

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
        <Card style={[styles.card, isActive && styles.activeCard]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={[styles.groupTag, isActive && styles.activeGroupTag]}>
                <Text style={styles.groupTagText}>
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
        <View style={styles.activeEventBanner}>
          <Text style={styles.bannerText}>
            参加中: {activeEvent.name}
          </Text>
        </View>
      )}

      <FlatList
        data={filteredEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? '読み込み中...' : 'イベントがありません'}
            </Text>
          </View>
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
    borderRadius: 8,
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
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  groupTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeGroupTag: {},
  groupTagText: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  activeTag: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  snackbar: {
    backgroundColor: COLORS.text,
  },
});
