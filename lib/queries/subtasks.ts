import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
}

export function useTaskSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-subtasks', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<Subtask[]> => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('id, task_id, title, done, sort_order')
        .eq('task_id', taskId!)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Subtask[];
    },
  });
}

export function useCreateSubtask(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      if (!taskId) throw new Error('Missing task');
      const current = qc.getQueryData<Subtask[]>(['task-subtasks', taskId]) ?? [];
      const nextOrder = current.length;
      const { data, error } = await supabase
        .from('subtasks')
        .insert({ task_id: taskId, title: title.trim(), sort_order: nextOrder })
        .select('id, task_id, title, done, sort_order')
        .single();
      if (error) throw error;
      return data as Subtask;
    },
    onSuccess: (row) => {
      qc.setQueryData<Subtask[]>(['task-subtasks', row.task_id], (prev) =>
        prev ? [...prev, row] : [row],
      );
    },
  });
}

export function useToggleSubtask(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('subtasks').update({ done }).eq('id', id);
      if (error) throw error;
      return { id, done };
    },
    onMutate: async ({ id, done }) => {
      if (!taskId) return;
      const key = ['task-subtasks', taskId];
      const prev = qc.getQueryData<Subtask[]>(key);
      qc.setQueryData<Subtask[]>(key, (curr) =>
        curr ? curr.map((s) => (s.id === id ? { ...s, done } : s)) : curr,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && taskId) {
        qc.setQueryData(['task-subtasks', taskId], ctx.prev);
      }
    },
  });
}

export function useDeleteSubtask(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Subtask[]>(['task-subtasks', taskId], (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
    },
  });
}
