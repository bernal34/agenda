import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { mapTask } from '../taskModel';
import type { MyTask, TaskPriority, TaskStatus } from '../taskModel';

export type { MyTask, TaskPriority, TaskStatus };

export function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyTask[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, progress, due_date, start_at, area:areas(id, name, color, slug), task_labels(label), assignees:task_assignees!inner(user_id, snoozed_until)',
        )
        .eq('assignees.user_id', userId!)
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      const nowIso = new Date().toISOString();
      return (data ?? [])
        .map(mapTask)
        .filter((t) => !t.snoozed_until || t.snoozed_until <= nowIso);
    },
  });
}

export function useAreaTasks(areaId: string | undefined) {
  return useQuery({
    queryKey: ['area-tasks', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<MyTask[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, progress, due_date, start_at, area:areas(id, name, color, slug), task_labels(label)',
        )
        .eq('area_id', areaId!)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapTask);
    },
  });
}
