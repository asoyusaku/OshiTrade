import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { Text, Button, Chip, TextInput, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../src/shared/utils/supabase';
import { useEventStore } from '../../src/providers/EventProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/shared/utils/constants';
import type { Member, GoodsType, GoodsVariant } from '../../src/lib/types';

export default function AddHaveScreen() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const colors = useColors();
  const [members, setMembers] = useState<Member[]>([]);
  const [goodsTypes, setGoodsTypes] = useState<GoodsType[]>([]);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [selectedGoods, setSelectedGoods] = useState<number | null>(null);
  const [variants, setVariants] = useState<GoodsVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  // グッズ種類が変わったらバリエーション取得（グループ単位）
  useEffect(() => {
    if (!activeEvent || !selectedGoods) {
      setVariants([]);
      setSelectedVariant(null);
      return;
    }
    supabase
      .from('goods_variants')
      .select('*')
      .eq('group_id', activeEvent.group_id)
      .eq('goods_type_id', selectedGoods)
      .order('variant_name')
      .then(({ data }) => {
        if (data) setVariants(data);
      });
  }, [activeEvent, selectedGoods]);

  const pickImage = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('権限エラー', 'カメラまたはギャラリーへのアクセスを許可してください');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });

    if (!result.canceled && result.assets[0]) {
      // リサイズ・圧縮
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhotoUri(manipulated.uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert('写真を追加', '方法を選択してください', [
      { text: 'カメラで撮影', onPress: () => pickImage('camera') },
      { text: 'ギャラリーから選択', onPress: () => pickImage('library') },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoUri || !user || !activeEvent) return null;

    const fileName = `${user.id}/${activeEvent.id}/${Date.now()}.jpg`;

    const response = await fetch(photoUri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('have-item-photos')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Upload error:', uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('have-item-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!selectedMember || !selectedGoods) {
      setError('メンバーとグッズの種類を選択してください');
      return;
    }
    if (!user || !activeEvent) return;

    setSaving(true);
    setError('');

    let photoUrl: string | null = null;
    if (photoUri) {
      photoUrl = await uploadPhoto();
      if (!photoUrl) {
        setError('写真のアップロードに失敗しました。写真なしで保存します。');
      }
    }

    const { error: dbError } = await supabase.from('have_items').upsert(
      {
        user_id: user.id,
        event_id: activeEvent.id,
        member_id: selectedMember,
        goods_type_id: selectedGoods,
        variant_id: selectedVariant,
        quantity: parseInt(quantity) || 1,
        note: note || null,
        photo_url: photoUrl,
        is_available: true,
      },
      { onConflict: 'user_id,event_id,member_id,goods_type_id,variant_id' }
    );

    if (dbError) {
      setError('保存に失敗しました: ' + dbError.message);
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
              selectedMember === m.id && { backgroundColor: colors.primary },
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
              selectedGoods === g.id && { backgroundColor: colors.primary },
            ]}
            textStyle={selectedGoods === g.id ? styles.selectedChipText : undefined}
          >
            {g.name}
          </Chip>
        ))}
      </View>

      {selectedGoods && variants.length > 0 && (
        <>
          <Text style={styles.stepTitle}>3. バリエーション（任意）</Text>
          <View style={styles.chipGrid}>
            <Chip
              selected={selectedVariant === null}
              onPress={() => setSelectedVariant(null)}
              style={[
                styles.chip,
                selectedVariant === null && { backgroundColor: colors.primary },
              ]}
              textStyle={selectedVariant === null ? styles.selectedChipText : undefined}
            >
              指定なし
            </Chip>
            {variants.map((v) => (
              <Chip
                key={v.id}
                selected={selectedVariant === v.id}
                onPress={() => setSelectedVariant(v.id)}
                style={[
                  styles.chip,
                  selectedVariant === v.id && { backgroundColor: colors.primary },
                ]}
                textStyle={selectedVariant === v.id ? styles.selectedChipText : undefined}
              >
                {v.variant_name}
              </Chip>
            ))}
          </View>
        </>
      )}

      <Text style={styles.stepTitle}>4. 数量</Text>
      <View style={styles.quantityRow}>
        <Pressable
          style={[styles.quantityButton, { backgroundColor: colors.primary }]}
          onPress={() => setQuantity(String(Math.max(1, parseInt(quantity) - 1)))}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </Pressable>
        <Text style={styles.quantityText}>{quantity}</Text>
        <Pressable
          style={[styles.quantityButton, { backgroundColor: colors.primary }]}
          onPress={() => setQuantity(String(parseInt(quantity) + 1))}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.stepTitle}>5. 写真（任意）</Text>
      {photoUri ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <IconButton
              icon="camera-retake"
              size={24}
              onPress={showImageOptions}
              iconColor={colors.primary}
            />
            <IconButton
              icon="delete"
              size={24}
              onPress={() => setPhotoUri(null)}
              iconColor={COLORS.error}
            />
          </View>
        </View>
      ) : (
        <Pressable style={styles.photoPlaceholder} onPress={showImageOptions}>
          <Text style={styles.photoPlaceholderIcon}>📷</Text>
          <Text style={styles.photoPlaceholderText}>タップして写真を追加</Text>
        </Pressable>
      )}

      <Text style={styles.stepTitle}>6. メモ（任意）</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        mode="outlined"
        placeholder="例：少し傷あり"
        style={styles.noteInput}
      />

      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving || !selectedMember || !selectedGoods}
        buttonColor={colors.primary}
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
    borderRadius: BORDER_RADIUS.xl,
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
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  photoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  photoPlaceholderIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  photoPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  noteInput: {
    backgroundColor: COLORS.white,
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
