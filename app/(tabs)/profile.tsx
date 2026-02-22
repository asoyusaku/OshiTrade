import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Avatar, Button, Card, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/shared/utils/supabase';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [tradeCount, setTradeCount] = useState(0);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <Avatar.Text
          size={80}
          label={(profile?.display_name || profile?.username || '?').charAt(0)}
          style={styles.avatar}
        />
        <Text style={styles.username}>@{profile?.username}</Text>
      </View>

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
                  buttonColor={COLORS.primary}
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
              <Text style={styles.statNumber}>{tradeCount}</Text>
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
  avatarSection: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  avatar: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.primary,
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
});
