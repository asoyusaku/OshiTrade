import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Avatar, Button, Card, TextInput, Portal, Modal } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { useColors } from '../../src/providers/ThemeProvider';
import { useThemeStore } from '../../src/providers/ThemeProvider';
import { supabase } from '../../src/shared/utils/supabase';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';
import type { IdolGroup, Member } from '../../src/lib/types';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const colors = useColors();
  const setOshiColor = useThemeStore((s) => s.setOshiColor);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [tradeCount, setTradeCount] = useState(0);

  // 推し選択
  const [showOshiPicker, setShowOshiPicker] = useState(false);
  const [groups, setGroups] = useState<IdolGroup[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [oshiMember, setOshiMember] = useState<Member | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('status', 'completed')
      .then(({ count }) => setTradeCount(count || 0));
  }, [user]);

  // 推しメンバー情報を取得
  useEffect(() => {
    if (!profile?.oshi_member_id) {
      setOshiMember(null);
      return;
    }
    supabase
      .from('members')
      .select('*, idol_groups:group_id(name)')
      .eq('id', profile.oshi_member_id)
      .single()
      .then(({ data }) => {
        if (data) setOshiMember(data);
      });
  }, [profile?.oshi_member_id]);

  const openOshiPicker = async () => {
    const { data: groupsData } = await supabase
      .from('idol_groups')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (groupsData) setGroups(groupsData);
    setSelectedGroupId(null);
    setMembers([]);
    setShowOshiPicker(true);
  };

  const selectGroup = async (groupId: number) => {
    setSelectedGroupId(groupId);
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setMembers(data);
  };

  const selectOshi = async (member: Member) => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ oshi_member_id: member.id, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    // 即座にテーマカラーを反映
    setOshiColor(member.color || null);
    setShowOshiPicker(false);
    await refreshProfile();
  };

  const clearOshi = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ oshi_member_id: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setOshiColor(null);
    setOshiMember(null);
    await refreshProfile();
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    await refreshProfile();
    setEditing(false);
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <Avatar.Text
          size={80}
          label={(profile?.display_name || profile?.username || '?').charAt(0)}
          style={[styles.avatar, { backgroundColor: colors.primary }]}
        />
        <Text style={styles.username}>@{profile?.username}</Text>
      </View>

      {/* 推しメン選択カード */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>推しメン</Text>
          {oshiMember ? (
            <View>
              <View style={styles.oshiDisplay}>
                <View
                  style={[styles.oshiColorDot, { backgroundColor: oshiMember.color || colors.primary }]}
                />
                <View style={styles.oshiInfo}>
                  <Text style={styles.oshiName}>{oshiMember.name}</Text>
                  <Text style={styles.oshiGroup}>
                    {(oshiMember as any).idol_groups?.name || ''}
                  </Text>
                </View>
              </View>
              <View style={styles.oshiButtons}>
                <Button mode="outlined" onPress={openOshiPicker} style={styles.oshiChangeBtn}>
                  変更
                </Button>
                <Button mode="outlined" onPress={clearOshi} textColor={COLORS.error} style={styles.oshiClearBtn}>
                  解除
                </Button>
              </View>
            </View>
          ) : (
            <Button
              mode="contained"
              buttonColor={colors.primary}
              onPress={openOshiPicker}
              icon="heart"
            >
              推しメンを選ぶ
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>プロフィール</Text>

          {editing ? (
            <View style={styles.editForm}>
              <TextInput
                label="表示名"
                value={displayName}
                onChangeText={setDisplayName}
                mode="outlined"
                style={styles.input}
              />
              <View style={styles.editButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setEditing(false)}
                  style={styles.cancelButton}
                >
                  キャンセル
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  buttonColor={colors.primary}
                >
                  保存
                </Button>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>表示名</Text>
                <Text style={styles.value}>{profile?.display_name || '未設定'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>メール</Text>
                <Text style={styles.value}>{user?.email}</Text>
              </View>
              <Button
                mode="outlined"
                onPress={() => setEditing(true)}
                style={styles.editButton}
              >
                編集
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>取引実績</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{tradeCount}</Text>
              <Text style={styles.statLabel}>完了した取引</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {profile?.is_admin && (
        <Button
          mode="contained"
          buttonColor={COLORS.secondary}
          onPress={() => router.push('/(modals)/manage-events')}
          style={styles.adminButton}
          icon="shield-crown"
        >
          イベント管理
        </Button>
      )}

      <Button
        mode="outlined"
        onPress={handleSignOut}
        style={styles.logoutButton}
        textColor={COLORS.error}
      >
        ログアウト
      </Button>
    </ScrollView>

    {/* 推しメン選択モーダル */}
    <Portal>
      <Modal
        visible={showOshiPicker}
        onDismiss={() => setShowOshiPicker(false)}
        contentContainerStyle={styles.modal}
      >
        {/* ヘッダー */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>推しメンを選ぶ</Text>
          <Text style={styles.modalDesc}>
            {!selectedGroupId ? 'グループを選んでください' : 'メンバーを選んでください'}
          </Text>
        </View>

        {/* コンテンツ */}
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {!selectedGroupId ? (
            groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.groupItem}
                onPress={() => selectGroup(g.id)}
                activeOpacity={0.6}
              >
                <Text style={styles.groupItemText}>{g.name}</Text>
                <Text style={styles.groupItemArrow}>›</Text>
              </TouchableOpacity>
            ))
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setSelectedGroupId(null)}
                style={styles.backRow}
                activeOpacity={0.6}
              >
                <Text style={[styles.backText, { color: colors.primary }]}>← グループ選択に戻る</Text>
              </TouchableOpacity>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberItem}
                  onPress={() => selectOshi(m)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.memberColor, { backgroundColor: m.color || '#ccc' }]} />
                  <Text style={styles.memberItemText}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>

        {/* フッター */}
        <Button
          mode="outlined"
          onPress={() => setShowOshiPicker(false)}
          style={styles.modalCloseButton}
          textColor={COLORS.textSecondary}
        >
          閉じる
        </Button>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  avatar: {
    marginBottom: SPACING.sm,
  },
  username: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  oshiDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  oshiColorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
  },
  oshiInfo: {
    flex: 1,
  },
  oshiName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  oshiGroup: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  oshiButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  oshiChangeBtn: {
    flex: 1,
  },
  oshiClearBtn: {
    flex: 1,
    borderColor: COLORS.error,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  editButton: {
    marginTop: SPACING.md,
  },
  editForm: {
    gap: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.white,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  cancelButton: {
    borderColor: COLORS.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  adminButton: {
    marginTop: SPACING.md,
    borderRadius: 12,
  },
  logoutButton: {
    marginTop: SPACING.md,
    borderColor: COLORS.error,
  },
  modal: {
    backgroundColor: COLORS.white,
    margin: SPACING.lg,
    borderRadius: 20,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  modalBody: {
    paddingHorizontal: SPACING.md,
  },
  backRow: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  backText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupItemText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    fontWeight: '500',
  },
  groupItemArrow: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memberColor: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalCloseButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    borderColor: COLORS.border,
  },
});
