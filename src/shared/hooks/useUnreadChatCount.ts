import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../../providers/AuthProvider';

export function useUnreadChatCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (!rooms || rooms.length === 0) {
      setUnreadCount(0);
      return;
    }

    const roomIds = rooms.map((r) => r.id);
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('chat_room_id', roomIds)
      .neq('sender_id', user.id)
      .is('read_at', null);

    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();

    if (!user) return;

    const channel = supabase
      .channel('tab-unread-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return unreadCount;
}
