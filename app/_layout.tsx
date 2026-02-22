import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/providers/AuthProvider';
import { COLORS } from '../src/shared/utils/constants';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen
              name="(modals)/add-have"
              options={{ presentation: 'modal', headerShown: true, title: '持っているものを追加' }}
            />
            <Stack.Screen
              name="(modals)/add-want"
              options={{ presentation: 'modal', headerShown: true, title: '欲しいものを追加' }}
            />
            <Stack.Screen
              name="(modals)/match-detail"
              options={{ presentation: 'modal', headerShown: true, title: 'マッチ詳細' }}
            />
            <Stack.Screen
              name="(modals)/manage-events"
              options={{ presentation: 'modal', headerShown: true, title: 'イベント管理' }}
            />
            <Stack.Screen
              name="(modals)/suggest-event"
              options={{ presentation: 'modal', headerShown: true, title: 'イベントを提案' }}
            />
          </Stack>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
