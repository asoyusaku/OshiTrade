import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useEventStore } from '../../providers/EventProvider';

export function useIncomingMatchCount() {
  const { user } = useAuth();
  const { activeEvent } = useEventStore();
  const [incomingCount, setIncomingCount] = useState(0);

  const fetchIncomingCount = useCallback(async () => {
    if (!user || !activeEvent) {
      setIncomingCount(0);
      return;
    }

    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_b', user.id)
      .eq('event_id', activeEvent.id)
      .eq('status', 'pending');

    setIncomingCount(count || 0);
  }, [user, activeEvent]);

  useEffect(() => {
    fetchIncomingCount();

    if (!user || !activeEvent) return;

    const channel = supabase
      .channel('tab-incoming-matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => fetchIncomingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeEvent, fetchIncomingCount]);

  return incomingCount;
}
