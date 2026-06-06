import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, sbCore } from '../supabase';

export interface MyChannel {
  id: string;
  name: string;
  kind: 'area' | 'direct' | 'group';
  area: { id: string; name: string; color: string } | null;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  task_ref: string | null;
  created_at: string;
}

export interface MemberProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useMyChannels(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-channels', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyChannel[]> => {
      const { data, error } = await supabase
        .from('channel_members')
        .select('channel:channels(id, name, kind, area:areas(id, name, color))')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.channel)
        .filter(Boolean)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          area: c.area ?? null,
        }));
    },
  });
}

export function useChannelMessages(channelId: string | undefined) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['channel-messages', channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<ChannelMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, channel_id, author_id, body, parent_id, task_ref, created_at')
        .eq('channel_id', channelId!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChannelMessage[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const sub = supabase
      .channel(`channel-messages-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'ops', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const newRow = payload.new as ChannelMessage;
          qc.setQueryData<ChannelMessage[]>(['channel-messages', channelId], (prev) => {
            if (!prev) return [newRow];
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, newRow];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, qc]);

  return q;
}

export function useChannelMembers(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channel-members', channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<MemberProfile[]> => {
      const { data: members, error: mErr } = await supabase
        .from('channel_members')
        .select('user_id')
        .eq('channel_id', channelId!);
      if (mErr) throw mErr;
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await sbCore()
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as MemberProfile[];
    },
  });
}

export function useSendMessage(channelId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: string | null }) => {
      if (!channelId) throw new Error('Missing channel');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          author_id: user.id,
          body: body.trim(),
          parent_id: parentId ?? null,
        })
        .select('id, channel_id, author_id, body, parent_id, task_ref, created_at')
        .single();
      if (error) throw error;
      return data as ChannelMessage;
    },
    onSuccess: (msg) => {
      qc.setQueryData<ChannelMessage[]>(['channel-messages', msg.channel_id], (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
  });
}
