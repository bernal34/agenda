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
  due_date?: string | null;
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
  due_date: string | null;
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
        .select('id, area_id, title, description, status, priority, progress, due_date, archived_at, recurrence_rule')
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
    mutationFn: async (input: TaskInput & { assignTo?: string }) => {
      const { assignTo, ...payload } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          area_id: payload.area_id,
          title: payload.title,
          description: payload.description ?? null,
          status: payload.status ?? 'todo',
          priority: payload.priority ?? 'normal',
          due_date: payload.due_date ?? null,
          progress: payload.progress ?? 0,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (assignTo) {
        const { error: aErr } = await supabase
          .from('task_assignees')
          .insert({ task_id: task.id, user_id: assignTo });
        if (aErr) throw aErr;
      }
      return task.id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['area-tasks', vars.area_id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
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
