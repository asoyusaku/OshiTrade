import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, IconButton, Button } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../../../src/shared/utils/supabase';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useColors } from '../../../src/providers/ThemeProvider';
import { COLORS, SPACING, FONT_SIZE } from '../../../src/shared/utils/constants';
import type { Message, LocationShare } from '../../../src/lib/types';

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 位置共有
  const [sharing, setSharing] = useState(false);
  const [partnerSharing, setPartnerSharing] = useState(false);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  // 双方が共有中の時のみ地図を表示
  const bothSharing = sharing && partnerSharing;

  // ---------- メッセージ ----------
  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_room_id', parseInt(chatId))
      .order('created_at', { ascending: true });

    if (data) setMessages(data);

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

  // ---------- 位置共有 ----------
  // 初期: 相手が共有中か確認 & Realtime購読
  useEffect(() => {
    if (!chatId || !user) return;

    // 既存の共有状態を取得
    supabase
      .from('location_shares')
      .select('*')
      .eq('chat_room_id', parseInt(chatId))
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          for (const share of data) {
            if (share.user_id === user.id) {
              // 前回共有が残っていたら停止
              supabase
                .from('location_shares')
                .update({ is_active: false })
                .eq('id', share.id);
            } else {
              setPartnerSharing(true);
              setPartnerLocation({ latitude: share.latitude, longitude: share.longitude });
            }
          }
        }
      });

    // Realtime: 相手の位置更新を監視
    const channel = supabase
      .channel(`location-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_shares',
          filter: `chat_room_id=eq.${chatId}`,
        },
        (payload) => {
          const share = (payload.new || payload.old) as LocationShare;
          if (!share || share.user_id === user.id) return;

          if (payload.eventType === 'DELETE' || !share.is_active) {
            setPartnerSharing(false);
            setPartnerLocation(null);
            setShowMap(false);
          } else {
            setPartnerSharing(true);
            setPartnerLocation({ latitude: share.latitude, longitude: share.longitude });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  const startSharing = async () => {
    if (!user || !chatId) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    setSharing(true);

    // 初期位置取得
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMyLocation(coords);

    // DBにupsert
    await supabase.from('location_shares').upsert(
      {
        chat_room_id: parseInt(chatId),
        user_id: user.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chat_room_id,user_id' }
    );

    // 位置監視開始
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      async (loc) => {
        const newCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMyLocation(newCoords);
        await supabase.from('location_shares').upsert(
          {
            chat_room_id: parseInt(chatId),
            user_id: user.id,
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'chat_room_id,user_id' }
        );
      }
    );
  };

  const stopSharing = async () => {
    if (!user || !chatId) return;

    watchRef.current?.remove();
    watchRef.current = null;
    setSharing(false);
    setMyLocation(null);
    setShowMap(false);

    await supabase
      .from('location_shares')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('chat_room_id', parseInt(chatId))
      .eq('user_id', user.id);
  };

  // 画面離脱時に自動停止
  useEffect(() => {
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
      if (user && chatId) {
        supabase
          .from('location_shares')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('chat_room_id', parseInt(chatId))
          .eq('user_id', user.id);
      }
    };
  }, [user, chatId]);

  // 地図の表示領域を両方のピンに合わせる
  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    const points = [myLocation, partnerLocation].filter(Boolean) as { latitude: number; longitude: number }[];
    if (points.length === 2) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [myLocation, partnerLocation, showMap]);

  // ---------- 描画 ----------
  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? [styles.myMessage, { backgroundColor: colors.primary }] : styles.theirMessage]}>
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

  // bothSharingが変わったら地図を自動表示/非表示
  useEffect(() => {
    if (bothSharing) {
      setShowMap(true);
    } else {
      setShowMap(false);
    }
  }, [bothSharing]);

  const mapRegion = myLocation || partnerLocation;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* 地図エリア: お互いが共有中の時のみ表示 */}
      {showMap && bothSharing && mapRegion && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              ...mapRegion,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            showsUserLocation={false}
          >
            {myLocation && (
              <Marker
                coordinate={myLocation}
                title="自分"
                pinColor={colors.primary}
              />
            )}
            {partnerLocation && (
              <Marker
                coordinate={partnerLocation}
                title="相手"
                pinColor={COLORS.success}
              />
            )}
          </MapView>
          <TouchableOpacity
            style={styles.mapCloseButton}
            onPress={() => setShowMap(false)}
          >
            <Text style={styles.mapCloseText}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 位置共有バー */}
      <View style={[styles.locationBar, { borderBottomColor: COLORS.border }]}>
        {sharing ? (
          <Button
            mode="outlined"
            icon="map-marker-off"
            onPress={stopSharing}
            compact
            textColor={COLORS.error}
            style={[styles.locationButton, { borderColor: COLORS.error }]}
          >
            位置共有を停止
          </Button>
        ) : (
          <Button
            mode="outlined"
            icon="map-marker"
            onPress={startSharing}
            compact
            textColor={colors.primary}
            style={[styles.locationButton, { borderColor: colors.primary }]}
          >
            位置を共有
          </Button>
        )}
        {sharing && partnerSharing && (
          <Text style={styles.sharingStatus}>相手も共有中</Text>
        )}
        {sharing && !partnerSharing && (
          <Text style={styles.waitingStatus}>相手の共有を待っています...</Text>
        )}
      </View>

      {/* メッセージ一覧 */}
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
                  style={[styles.quickReply, { color: colors.primary, backgroundColor: colors.primaryLight }]}
                  onPress={() => setInput(text)}
                >
                  {text}
                </Text>
              ))}
            </View>
          </View>
        }
      />

      {/* 入力欄 */}
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
              color={colors.primary}
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
  // 地図
  mapContainer: {
    height: 200,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapCloseButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapCloseText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 位置共有バー
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
  },
  locationButton: {
    borderRadius: 20,
  },
  sharingStatus: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    marginLeft: SPACING.sm,
    fontWeight: '600',
  },
  waitingStatus: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  // メッセージ
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
  // 入力
  inputContainer: {
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    backgroundColor: COLORS.white,
  },
  // 空状態
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
    fontSize: FONT_SIZE.sm,
    padding: SPACING.sm,
    borderRadius: 16,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
