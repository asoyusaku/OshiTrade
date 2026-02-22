import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../../src/shared/utils/supabase';
import { useAuth } from '../../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../../src/shared/utils/constants';

type ChatRoomDisplay = {
  id: number;
  match_id: number;
  partner_name: string;
  partner_id: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
};

export default function ChatListScreen() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoomDisplay[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChatRooms = useCallback(async () => {
    if (!user) return;

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        match_id,
        user_a,
        user_b,
        created_at
      `)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!rooms) return;

    const displayRooms: ChatRoomDisplay[] = [];

    for (const room of rooms) {
      const partnerId = room.user_a === user.id ? room.user_b : room.user_a;

      const [profileRes, lastMsgRes, unreadRes] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', partnerId).single(),
        supabase
          .from('messages')
          .select('content, created_at')
          .eq('chat_room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('chat_room_id', room.id)
          .neq('sender_id', user.id)
          .is('read_at', null),
      ]);

      displayRooms.push({
        id: room.id,
        match_id: room.match_id,
        partner_name: profileRes.data?.display_name || 'ユーザー',
        partner_id: partnerId,
        last_message: lastMsgRes.data?.content || null,
        last_message_time: lastMsgRes.data?.created_at || null,
        unread_count: unreadRes.count || 0,
      });
    }

    setChatRooms(displayRooms);
  }, [user]);

  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchChatRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchChatRooms]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChatRooms();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderRoom = ({ item }: { item: ChatRoomDisplay }) => (
    <Pressable
      style={styles.roomItem}
      onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
    >
      <Avatar.Text
        size={48}
        label={item.partner_name.charAt(0)}
        style={styles.avatar}
      />
      <View style={styles.roomInfo}>
        <View style={styles.roomHeader}>
          <Text style={styles.partnerName}>{item.partner_name}</Text>
          <Text style={styles.time}>{formatTime(item.last_message_time)}</Text>
        </View>
        <View style={styles.roomFooter}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message || 'メッセージなし'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={chatRooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              チャットはまだありません。{'\n'}
              マッチした相手とチャットを始めましょう！
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  roomItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: COLORS.primaryLight,
    marginRight: SPACING.md,
  },
  roomInfo: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  partnerName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: SPACING.sm,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl * 3,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
});
