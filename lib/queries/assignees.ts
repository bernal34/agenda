import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';

export interface AssigneeProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface AreaMember extends AssigneeProfile {
  role: 'owner' | 'admin' | 'member';
}

/**
 * Asignados actuales de una tarea, con su profile resuelto.
 * Hace dos round-trips: task_assignees y luego profiles, igual que
 * useChannelMembers — necesario porque profiles vive en core (otro schema).
 */
export function useTaskAssignees(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-assignees', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<AssigneeProfile[]> => {
      const { data: rows, error } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', taskId!);
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await sbCore()
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as AssigneeProfile[];
    },
  });
}

/**
 * Miembros del área (con rol), usados como pool de elegibles
 * para asignar a una tarea de esa área.
 */
export function useAreaMembers(areaId: string | undefined) {
  return useQuery({
    queryKey: ['area-members', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<AreaMember[]> => {
      const { data: rows, error } = await supabase
        .from('area_members')
        .select('user_id, role')
        .eq('area_id', areaId!);
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.user_id);
      const roleMap = new Map<string, AreaMember['role']>(
        (rows ?? []).map((r: any) => [r.user_id, r.role]),
      );
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await sbCore()
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: roleMap.get(p.id) ?? 'member',
      }));
    },
  });
}

export function useAddAssignee(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!taskId) throw new Error('Missing task');
      const { error } = await supabase
        .from('task_assignees')
        .insert({ task_id: taskId, user_id: userId });
      if (error) throw error;
      return userId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['area-tasks'] });
    },
  });
}

export function useSnoozeTask(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (until: Date | null) => {
      if (!taskId) throw new Error('Sin tarea');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');
      const { error } = await supabase
        .from('task_assignees')
        .update({ snoozed_until: until ? until.toISOString() : null })
        .eq('task_id', taskId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['task-snooze', taskId] });
    },
  });
}

export function useMySnooze(taskId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['task-snooze', taskId, userId],
    enabled: !!taskId && !!userId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('task_assignees')
        .select('snoozed_until')
        .eq('task_id', taskId!)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.snoozed_until ?? null) as string | null;
    },
  });
}

export function useRemoveAssignee(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!taskId) throw new Error('Missing task');
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);
      if (error) throw error;
      return userId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['area-tasks'] });
    },
  });
}
