import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../src/shared/utils/constants';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'ログインに失敗しました');
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
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>推</Text>
          </View>
          <Text style={styles.title}>OshiTrade</Text>
          <Text style={styles.subtitle}>推しグッズ交換を、もっとスマートに</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            label="メールアドレス"
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
            label="パスワード"
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

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            buttonColor={COLORS.primary}
            labelStyle={styles.buttonLabel}
          >
            ログイン
          </Button>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            mode="outlined"
            onPress={() => router.push('/auth/register')}
            style={styles.registerButton}
            contentStyle={styles.buttonContent}
            textColor={COLORS.primary}
            labelStyle={styles.registerLabel}
          >
            新規アカウントを作成
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
    marginBottom: SPACING.xl + 8,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 36,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
  registerButton: {
    borderColor: COLORS.primary,
    borderRadius: 12,
  },
  registerLabel: {
    fontSize: FONT_SIZE.md,
  },
});
