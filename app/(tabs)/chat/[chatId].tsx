import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, IconButton } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../src/shared/utils/supabase';
import { useAuth } from '../../../src/providers/AuthProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../../src/shared/utils/constants';
import type { Message } from '../../../src/lib/types';

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_room_id', parseInt(chatId))
      .order('created_at', { ascending: true });

    if (data) setMessages(data);

    // Mark unread messages as read
    if (user) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_room_id', parseInt(chatId))
        .neq('sender_id', user.id)
        .is('read_at', null);
    }
  }, [chatId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`chat-room-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          // Mark as read if from partner
          if (user && newMsg.sender_id !== user.id) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  const sendMessage = async () => {
    if (!input.trim() || !user || !chatId) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    await supabase.from('messages').insert({
      chat_room_id: parseInt(chatId),
      sender_id: user.id,
      content,
    });

    setSending(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {new Date(item.created_at).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {isMe && item.read_at && (
            <Text style={styles.readLabel}>既読</Text>
          )}
        </View>
      </View>
    );
  };

  const quickReplies = [
    '会場のどこにいますか？',
    '交換しましょう！',
    'ありがとうございます！',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>メッセージを送信して交換を始めましょう</Text>
            <View style={styles.quickReplies}>
              {quickReplies.map((text) => (
                <Text
                  key={text}
                  style={styles.quickReply}
                  onPress={() => setInput(text)}
                >
                  {text}
                </Text>
              ))}
            </View>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="メッセージを入力..."
          mode="outlined"
          dense
          right={
            <TextInput.Icon
              icon="send"
              color={COLORS.primary}
              disabled={sending || !input.trim()}
              onPress={sendMessage}
            />
          }
          onSubmitEditing={sendMessage}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  messageList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: SPACING.sm,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  myMessageText: {
    color: COLORS.white,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: SPACING.xs,
  },
  messageTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  readLabel: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    backgroundColor: COLORS.white,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xl * 3,
  },
  emptyText: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  quickReplies: {
    gap: SPACING.sm,
  },
  quickReply: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
