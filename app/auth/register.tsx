import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      setError('必須項目を入力してください');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUp(email, password, username, displayName || username);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>アカウント作成</Text>
          <Text style={styles.subtitle}>OshiTradeを始めよう</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            label="ユーザー名 *"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            left={<TextInput.Icon icon="at" />}
            style={styles.input}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <TextInput
            label="表示名（任意）"
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            left={<TextInput.Icon icon="account-outline" />}
            style={styles.input}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <TextInput
            label="メールアドレス *"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <TextInput
            label="パスワード *"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? 'eye-off' : 'eye'}
                onPress={() => setSecureEntry(!secureEntry)}
              />
            }
            style={styles.input}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <Text style={styles.hint}>* は必須項目です</Text>

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            buttonColor={COLORS.primary}
            labelStyle={styles.buttonLabel}
          >
            登録する
          </Button>

          <Button
            mode="text"
            onPress={() => router.back()}
            textColor={COLORS.textSecondary}
            style={styles.backButton}
          >
            ログイン画面に戻る
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.white,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: -SPACING.sm,
  },
  button: {
    marginTop: SPACING.sm,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FFF0F0',
    padding: SPACING.sm,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
  },
  backButton: {
    marginTop: SPACING.xs,
  },
});
