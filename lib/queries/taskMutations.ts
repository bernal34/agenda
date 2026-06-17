import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { TaskPriority, TaskStatus } from './tasks';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
}

export interface TaskInput {
  area_id: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  start_at?: string | null;
  lead_time_minutes?: number;
  progress?: number;
  recurrence_rule?: RecurrenceRule | null;
}

export interface TaskRecord {
  id: string;
  area_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  start_at: string | null;
  lead_time_minutes: number;
  archived_at: string | null;
  recurrence_rule: RecurrenceRule | null;
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskRecord> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, area_id, title, description, status, priority, progress, start_date, due_date, start_at, lead_time_minutes, archived_at, recurrence_rule')
        .eq('id', taskId!)
        .single();
      if (error) throw error;
      return data as TaskRecord;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput & { assigneeIds?: string[] }) => {
      const { assigneeIds, ...payload } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          area_id: payload.area_id,
          title: payload.title,
          description: payload.description ?? null,
          status: payload.status ?? 'todo',
          priority: payload.priority ?? 'normal',
          start_date: payload.start_date ?? null,
          due_date: payload.due_date ?? null,
          start_at: payload.start_at ?? null,
          lead_time_minutes: payload.lead_time_minutes ?? 5,
          progress: payload.progress ?? 0,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const ids = Array.from(new Set((assigneeIds ?? []).filter(Boolean)));
      if (ids.length > 0) {
        const { error: aErr } = await supabase
          .from('task_assignees')
          .insert(ids.map((user_id) => ({ task_id: task.id, user_id })));
        if (aErr) throw aErr;
      }
      return task.id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['area-tasks', vars.area_id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['delegated-tasks'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<TaskInput> & { id: string }) => {
      const { error } = await supabase.from('tasks').update(changes).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['area-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['area-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}
