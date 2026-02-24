import { Tabs } from 'expo-router';
// @ts-expect-error - vector-icons types not separately installed
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/providers/ThemeProvider';
import { COLORS } from '../../src/shared/utils/constants';
import { useUnreadChatCount } from '../../src/shared/hooks/useUnreadChatCount';
import { useIncomingMatchCount } from '../../src/shared/hooks/useIncomingMatchCount';

export default function TabsLayout() {
  const colors = useColors();
  const unreadChatCount = useUnreadChatCount();
  const incomingMatchCount = useIncomingMatchCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: '持ち物',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'マッチ',
          tabBarBadge: incomingMatchCount > 0 ? incomingMatchCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'チャット',
          headerShown: false,
          tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
