import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type NotificationKind =
  | 'task_assigned'
  | 'task_due'
  | 'mention'
  | 'comment';

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function useMyNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, kind, payload, read_at, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

// Mount once at the root of the authenticated app (e.g. TabsLayout).
// It owns the realtime subscription and updates the shared React Query cache
// so any consumer of useMyNotifications/useUnreadCount sees new rows live.
export function useNotificationsRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const sub = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'ops', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          qc.setQueryData<AppNotification[]>(['notifications', userId], (prev) => {
            if (!prev) return [row];
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId, qc]);
}

export function useUnreadCount(userId: string | undefined) {
  const q = useMyNotifications(userId);
  const count = (q.data ?? []).filter((n) => !n.read_at).length;
  return count;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
