import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { TaskStatus } from '../taskModel';

export interface DependencyRef {
  id: string;
  title: string;
  status: TaskStatus;
  area_id: string;
  archived_at: string | null;
}

export interface TaskDependencies {
  blockedBy: DependencyRef[]; // tareas que ESTA tarea necesita esperar
  blocks: DependencyRef[];    // tareas que dependen de ESTA
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-deps', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskDependencies> => {
      const [bq, fq] = await Promise.all([
        supabase
          .from('task_dependencies')
          .select('depends_on, blocker:tasks!task_dependencies_depends_on_fkey(id, title, status, area_id, archived_at)')
          .eq('task_id', taskId!),
        supabase
          .from('task_dependencies')
          .select('task_id, blocked:tasks!task_dependencies_task_id_fkey(id, title, status, area_id, archived_at)')
          .eq('depends_on', taskId!),
      ]);
      if (bq.error) throw bq.error;
      if (fq.error) throw fq.error;

      const blockedBy: DependencyRef[] = (bq.data ?? [])
        .map((r: any) => r.blocker)
        .filter(Boolean);
      const blocks: DependencyRef[] = (fq.data ?? [])
        .map((r: any) => r.blocked)
        .filter(Boolean);
      return { blockedBy, blocks };
    },
  });
}

export function useAddDependency(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ otherId, reverse }: { otherId: string; reverse?: boolean }) => {
      if (!taskId) throw new Error('Sin tarea');
      if (otherId === taskId) throw new Error('Una tarea no puede depender de sí misma');
      const { data: { user } } = await supabase.auth.getUser();
      const taskCol = reverse ? otherId : taskId;
      const depCol  = reverse ? taskId : otherId;
      const { error } = await supabase
        .from('task_dependencies')
        .insert({ task_id: taskCol, depends_on: depCol, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-deps', taskId] });
    },
  });
}

export function useRemoveDependency(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dependsOn, reverse }: { dependsOn: string; reverse?: boolean }) => {
      if (!taskId) throw new Error('Sin tarea');
      const a = reverse ? dependsOn : taskId;
      const b = reverse ? taskId : dependsOn;
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('task_id', a)
        .eq('depends_on', b);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-deps', taskId] });
    },
  });
}
