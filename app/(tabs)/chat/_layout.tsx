import { Stack } from 'expo-router';
import { useColors } from '../../../src/providers/ThemeProvider';
import { COLORS } from '../../../src/shared/utils/constants';

export default function ChatLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'チャット' }} />
      <Stack.Screen name="[chatId]" options={{ title: 'チャット' }} />
    </Stack>
  );
}
