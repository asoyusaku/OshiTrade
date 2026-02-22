import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { IdolGroup } from '../../src/lib/types';

export default function SuggestEventScreen() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<IdolGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('idol_groups')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setGroups(data);
      });
  }, []);

  const handleSubmit = async () => {
    if (!selectedGroupId || !name.trim() || !eventDate.trim()) {
      Alert.alert('入力エラー', 'グループ、イベント名、日付は必須です');
      return;
    }
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from('event_suggestions').insert({
      user_id: user.id,
      group_id: selectedGroupId,
      name: name.trim(),
      venue: venue.trim() || null,
      event_date: eventDate.trim(),
      note: note.trim() || null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('エラー', '提案の送信に失敗しました: ' + error.message);
      return;
    }

    Alert.alert('送信完了', 'イベントの提案を送信しました。管理者が確認します。', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.description}>
        イベント情報を提案してください。管理者が確認後、イベント一覧に追加されます。
      </Text>

      <Text style={styles.stepTitle}>1. グループを選択</Text>
      <View style={styles.chipGrid}>
        {groups.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[
              styles.groupChip,
              selectedGroupId === g.id && styles.selectedGroupChip,
            ]}
            onPress={() => setSelectedGroupId(g.id)}
          >
            <Text
              style={[
                styles.groupChipText,
                selectedGroupId === g.id && styles.selectedGroupChipText,
              ]}
            >
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.stepTitle}>2. イベント名</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        mode="outlined"
        placeholder="例：櫻坂46 5th ANNIVERSARY LIVE DAY1"
        style={styles.input}
      />

      <Text style={styles.stepTitle}>3. 会場（任意）</Text>
      <TextInput
        value={venue}
        onChangeText={setVenue}
        mode="outlined"
        placeholder="例：東京ドーム"
        style={styles.input}
      />

      <Text style={styles.stepTitle}>4. 日付</Text>
      <TextInput
        value={eventDate}
        onChangeText={setEventDate}
        mode="outlined"
        placeholder="YYYY-MM-DD（例：2026-04-11）"
        style={styles.input}
      />

      <Text style={styles.stepTitle}>5. メモ（任意）</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        mode="outlined"
        placeholder="補足情報があれば記入してください"
        multiline
        numberOfLines={3}
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={saving}
        disabled={saving || !selectedGroupId || !name.trim() || !eventDate.trim()}
        buttonColor={COLORS.primary}
        style={styles.submitButton}
        contentStyle={{ paddingVertical: SPACING.xs }}
      >
        提案を送信
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  stepTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
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
  input: {
    backgroundColor: COLORS.white,
  },
  submitButton: {
    marginTop: SPACING.xl,
    borderRadius: 12,
  },
});
