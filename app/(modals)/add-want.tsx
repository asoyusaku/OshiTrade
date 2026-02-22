import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { Member, GoodsType } from '../../src/lib/types';

export default function AddWantScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [goodsTypes, setGoodsTypes] = useState<GoodsType[]>([]);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [selectedGoods, setSelectedGoods] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeEvent) return;
    Promise.all([
      supabase
        .from('members')
        .select('*')
        .eq('group_id', activeEvent.group_id)
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('goods_types').select('*').order('sort_order'),
    ]).then(([membersRes, goodsRes]) => {
      if (membersRes.data) setMembers(membersRes.data);
      if (goodsRes.data) setGoodsTypes(goodsRes.data);
    });
  }, [activeEvent]);

  const handleSave = async () => {
    if (!selectedMember || !selectedGoods) {
      setError('メンバーとグッズの種類を選択してください');
      return;
    }
    if (!user || !activeEvent) return;

    setSaving(true);
    setError('');

    const { error: dbError } = await supabase.from('want_items').upsert(
      {
        user_id: user.id,
        event_id: activeEvent.id,
        member_id: selectedMember,
        goods_type_id: selectedGoods,
        quantity: parseInt(quantity) || 1,
      },
      { onConflict: 'user_id,event_id,member_id,goods_type_id' }
    );

    if (dbError) {
      setError('保存に失敗しました');
      setSaving(false);
      return;
    }

    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.stepTitle}>1. メンバーを選択</Text>
      <View style={styles.chipGrid}>
        {members.map((m) => (
          <Chip
            key={m.id}
            selected={selectedMember === m.id}
            onPress={() => setSelectedMember(m.id)}
            style={[
              styles.chip,
              selectedMember === m.id && styles.selectedChip,
            ]}
            textStyle={selectedMember === m.id ? styles.selectedChipText : undefined}
          >
            {m.name}
          </Chip>
        ))}
      </View>

      <Text style={styles.stepTitle}>2. グッズの種類を選択</Text>
      <View style={styles.chipGrid}>
        {goodsTypes.map((g) => (
          <Chip
            key={g.id}
            selected={selectedGoods === g.id}
            onPress={() => setSelectedGoods(g.id)}
            style={[
              styles.chip,
              selectedGoods === g.id && styles.selectedChip,
            ]}
            textStyle={selectedGoods === g.id ? styles.selectedChipText : undefined}
          >
            {g.name}
          </Chip>
        ))}
      </View>

      <Text style={styles.stepTitle}>3. 数量</Text>
      <View style={styles.quantityRow}>
        <Pressable
          style={styles.quantityButton}
          onPress={() => setQuantity(String(Math.max(1, parseInt(quantity) - 1)))}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </Pressable>
        <Text style={styles.quantityText}>{quantity}</Text>
        <Pressable
          style={styles.quantityButton}
          onPress={() => setQuantity(String(parseInt(quantity) + 1))}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </Pressable>
      </View>

      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving || !selectedMember || !selectedGoods}
        buttonColor={COLORS.primary}
        style={styles.saveButton}
      >
        追加する
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
  chip: {
    marginBottom: SPACING.xs,
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
  },
  selectedChipText: {
    color: COLORS.white,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    minWidth: 40,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.xs,
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
  },
});
