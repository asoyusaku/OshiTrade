import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, FAB, Portal, Modal, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { Event, IdolGroup, EventSuggestion } from '../../src/lib/types';

type Tab = 'events' | 'suggestions';

export default function ManageEventsScreen() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [groups, setGroups] = useState<IdolGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formGroupId, setFormGroupId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formDate, setFormDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [eventsRes, groupsRes, suggestionsRes] = await Promise.all([
      supabase
        .from('events')
        .select('*, idol_groups(*)')
        .order('event_date', { ascending: false }),
      supabase
        .from('idol_groups')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('event_suggestions')
        .select('*, idol_groups(*), profiles:user_id(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (groupsRes.data) setGroups(groupsRes.data);
    if (suggestionsRes.error) {
      console.warn('suggestions fetch error:', suggestionsRes.error.message);
    }
    if (suggestionsRes.data) setSuggestions(suggestionsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormGroupId(null);
    setFormName('');
    setFormVenue('');
    setFormDate('');
    setEditingEvent(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (event: Event) => {
    setEditingEvent(event);
    setFormGroupId(event.group_id);
    setFormName(event.name);
    setFormVenue(event.venue || '');
    setFormDate(event.event_date);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formGroupId || !formName.trim() || !formDate.trim()) {
      Alert.alert('入力エラー', 'グループ、イベント名、日付は必須です');
      return;
    }

    setSaving(true);

    if (editingEvent) {
      const { error } = await supabase
        .from('events')
        .update({
          group_id: formGroupId,
          name: formName.trim(),
          venue: formVenue.trim() || null,
          event_date: formDate.trim(),
        })
        .eq('id', editingEvent.id);

      if (error) {
        Alert.alert('エラー', '更新に失敗しました: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('events').insert({
        group_id: formGroupId,
        name: formName.trim(),
        venue: formVenue.trim() || null,
        event_date: formDate.trim(),
      });

      if (error) {
        Alert.alert('エラー', '追加に失敗しました: ' + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    resetForm();
    fetchData();
  };

  const handleDelete = (event: Event) => {
    Alert.alert(
      'イベント削除',
      `「${event.name}」を削除しますか？\n関連するデータも全て削除されます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('events')
              .delete()
              .eq('id', event.id);
            if (error) {
              Alert.alert('エラー', '削除に失敗しました: ' + error.message);
            } else {
              fetchData();
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (event: Event) => {
    const { error } = await supabase
      .from('events')
      .update({ is_active: !event.is_active })
      .eq('id', event.id);
    if (!error) fetchData();
  };

  const handleApproveSuggestion = async (suggestion: EventSuggestion) => {
    if (!user) return;

    // Create event from suggestion
    const { error: insertError } = await supabase.from('events').insert({
      group_id: suggestion.group_id,
      name: suggestion.name,
      venue: suggestion.venue,
      event_date: suggestion.event_date,
    });

    if (insertError) {
      Alert.alert('エラー', 'イベント作成に失敗しました: ' + insertError.message);
      return;
    }

    // Update suggestion status
    const { error: updateError } = await supabase
      .from('event_suggestions')
      .update({ status: 'approved', reviewed_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', suggestion.id);

    if (updateError) {
      Alert.alert('エラー', 'ステータス更新に失敗しました: ' + updateError.message);
      return;
    }

    fetchData();
  };

  const handleRejectSuggestion = async (suggestion: EventSuggestion) => {
    if (!user) return;

    const { error } = await supabase
      .from('event_suggestions')
      .update({ status: 'rejected', reviewed_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', suggestion.id);

    if (!error) fetchData();
  };

  const renderEvent = ({ item }: { item: Event }) => (
    <Card style={[styles.card, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <View style={styles.groupTag}>
              <Text style={styles.groupTagText}>{item.idol_groups?.name || ''}</Text>
            </View>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventDetail}>
              {item.event_date} {item.venue ? `@ ${item.venue}` : ''}
            </Text>
            {!item.is_active && (
              <Text style={styles.inactiveLabel}>非公開</Text>
            )}
          </View>
          <View style={styles.cardActions}>
            <IconButton
              icon={item.is_active ? 'eye-off' : 'eye'}
              size={20}
              onPress={() => handleToggleActive(item)}
            />
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => openEditForm(item)}
            />
            <IconButton
              icon="delete"
              size={20}
              iconColor={COLORS.error}
              onPress={() => handleDelete(item)}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderSuggestion = ({ item }: { item: EventSuggestion }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.groupTag}>
          <Text style={styles.groupTagText}>{item.idol_groups?.name || ''}</Text>
        </View>
        <Text style={styles.eventName}>{item.name}</Text>
        <Text style={styles.eventDetail}>
          {item.event_date} {item.venue ? `@ ${item.venue}` : ''}
        </Text>
        <Text style={styles.suggestedBy}>
          提案者: {item.profiles?.display_name || item.profiles?.username || '不明'}
        </Text>
        {item.note && <Text style={styles.noteText}>メモ: {item.note}</Text>}
        <View style={styles.suggestionActions}>
          <Button
            mode="contained"
            buttonColor={COLORS.success}
            onPress={() => handleApproveSuggestion(item)}
            style={styles.approveButton}
          >
            承認
          </Button>
          <Button
            mode="outlined"
            textColor={COLORS.error}
            onPress={() => handleRejectSuggestion(item)}
            style={styles.rejectButton}
          >
            却下
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'events' && styles.activeTab]}
          onPress={() => setTab('events')}
        >
          <Text style={[styles.tabText, tab === 'events' && styles.activeTabText]}>
            イベント一覧
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'suggestions' && styles.activeTab]}
          onPress={() => setTab('suggestions')}
        >
          <Text style={[styles.tabText, tab === 'suggestions' && styles.activeTabText]}>
            提案 ({suggestions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'events' ? (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading ? '読み込み中...' : 'イベントがありません'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={suggestions}
          renderItem={renderSuggestion}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading ? '読み込み中...' : '保留中の提案はありません'}
              </Text>
            </View>
          }
        />
      )}

      {tab === 'events' && (
        <FAB
          icon="plus"
          style={styles.fab}
          color={COLORS.white}
          onPress={openAddForm}
        />
      )}

      <Portal>
        <Modal
          visible={showForm}
          onDismiss={resetForm}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>
            {editingEvent ? 'イベント編集' : 'イベント追加'}
          </Text>

          <Text style={styles.formLabel}>グループ</Text>
          <View style={styles.chipGrid}>
            {groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.groupChip,
                  formGroupId === g.id && styles.selectedGroupChip,
                ]}
                onPress={() => setFormGroupId(g.id)}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    formGroupId === g.id && styles.selectedGroupChipText,
                  ]}
                >
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            label="イベント名"
            value={formName}
            onChangeText={setFormName}
            mode="outlined"
            style={styles.formInput}
          />
          <TextInput
            label="会場（任意）"
            value={formVenue}
            onChangeText={setFormVenue}
            mode="outlined"
            style={styles.formInput}
          />
          <TextInput
            label="日付 (YYYY-MM-DD)"
            value={formDate}
            onChangeText={setFormDate}
            mode="outlined"
            placeholder="2026-04-11"
            style={styles.formInput}
          />

          <View style={styles.formButtons}>
            <Button mode="outlined" onPress={resetForm} style={styles.formCancelBtn}>
              キャンセル
            </Button>
            <Button
              mode="contained"
              buttonColor={COLORS.primary}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            >
              {editingEvent ? '更新' : '追加'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  card: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  groupTagText: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  eventName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  eventDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  inactiveLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: 2,
  },
  suggestedBy: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  noteText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  approveButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
    borderColor: COLORS.error,
  },
  empty: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
  },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  modal: {
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedGroupChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  groupChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  selectedGroupChipText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  formInput: {
    backgroundColor: COLORS.white,
    marginBottom: SPACING.sm,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  formCancelBtn: {
    borderColor: COLORS.border,
  },
});
