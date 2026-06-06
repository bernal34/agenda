import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Status libre: cualquier código definido en ops.board_stages.
// Por defecto el sistema usa todo / in_progress / in_review / done.
export type TaskStatus = string;
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date: string | null;
  area: { id: string; name: string; color: string; slug: string } | null;
  labels: string[];
}

function mapTask(t: any): MyTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    progress: t.progress,
    due_date: t.due_date,
    area: t.area,
    labels: ((t.task_labels ?? []) as { label: string }[])
      .map((l) => l.label)
      .sort(),
  };
}

export function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyTask[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, progress, due_date, area:areas(id, name, color, slug), task_labels(label), assignees:task_assignees!inner(user_id)',
        )
        .eq('assignees.user_id', userId!)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []).map(mapTask);
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
          'id, title, description, status, priority, progress, due_date, area:areas(id, name, color, slug), task_labels(label)',
        )
        .eq('area_id', areaId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapTask);
    },
  });
}
