import { useQuery } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';
import { mapTask } from '../taskModel';
import type { MyTask, TaskPriority, TaskStatus } from '../taskModel';

export type { MyTask, TaskPriority, TaskStatus };

export interface DelegatedTask extends MyTask {
  /** Lista de usuarios actualmente asignados a la tarea (sin contar al creador). */
  assignedTo: Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
}

export function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyTask[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, progress, start_date, due_date, start_at, area:areas(id, name, color, slug), task_labels(label), assignees:task_assignees!inner(user_id, snoozed_until)',
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

/**
 * Tareas que el usuario delegó: las creó y tiene a alguien (no a sí mismo)
 * como asignado. Sirve para el tablero de seguimiento: "qué le pedí a quién
 * y cómo va". Se excluyen las cerradas hace más de 30 días para no inflar
 * la lista con historia vieja.
 */
export function useDelegatedTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['delegated-tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DelegatedTask[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, progress, start_date, due_date, start_at, area:areas(id, name, color, slug), task_labels(label), task_assignees(user_id)',
        )
        .eq('created_by', userId!)
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // Solo conservamos tareas donde hay al menos un assignee distinto del creador.
      const withOthers = rows.filter((r) => {
        const ids = ((r.task_assignees ?? []) as { user_id: string }[]).map((a) => a.user_id);
        return ids.some((id) => id !== userId);
      });

      // Resolver profiles de los assignees (excluyendo al propio user)
      const otherIds = Array.from(
        new Set(
          withOthers.flatMap((r) =>
            ((r.task_assignees ?? []) as { user_id: string }[])
              .map((a) => a.user_id)
              .filter((id) => id !== userId),
          ),
        ),
      );
      const profileMap = new Map<string, DelegatedTask['assignedTo'][number]>();
      if (otherIds.length > 0) {
        const { data: profiles, error: pErr } = await sbCore()
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', otherIds);
        if (pErr) throw pErr;
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      return withOthers.map((r): DelegatedTask => {
        const base = mapTask(r);
        const assignedTo = ((r.task_assignees ?? []) as { user_id: string }[])
          .filter((a) => a.user_id !== userId)
          .map((a) => profileMap.get(a.user_id))
          .filter((p): p is DelegatedTask['assignedTo'][number] => !!p);
        return { ...base, assignedTo };
      });
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
          'id, title, description, status, priority, progress, start_date, due_date, start_at, area:areas(id, name, color, slug), task_labels(label)',
        )
        .eq('area_id', areaId!)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapTask);
    },
  });
}
