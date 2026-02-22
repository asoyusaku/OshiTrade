import { Stack } from 'expo-router';
import { COLORS } from '../../../src/shared/utils/constants';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'チャット' }} />
      <Stack.Screen name="[chatId]" options={{ title: 'チャット' }} />
    </Stack>
  );
}
