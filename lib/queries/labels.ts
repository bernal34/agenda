import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useTaskLabels(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-labels', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('task_labels')
        .select('label')
        .eq('task_id', taskId!)
        .order('label', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => r.label as string);
    },
  });
}

/**
 * Devuelve todas las labels distintas usadas en tareas del área del usuario.
 * Útil para autocompletar y reutilizar etiquetas existentes.
 */
export function useAreaLabels(areaId: string | undefined) {
  return useQuery({
    queryKey: ['area-labels', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('task_labels')
        .select('label, task:tasks!inner(area_id)')
        .eq('task.area_id', areaId!);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => set.add(r.label));
      return Array.from(set).sort();
    },
  });
}

function normalize(label: string) {
  return label.trim().toLowerCase().slice(0, 32);
}

export function useAddLabel(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      if (!taskId) throw new Error('Missing task');
      const norm = normalize(label);
      if (norm.length < 1) throw new Error('Etiqueta vacía');
      const { error } = await supabase
        .from('task_labels')
        .insert({ task_id: taskId, label: norm });
      if (error) throw error;
      return norm;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-labels', taskId] });
      qc.invalidateQueries({ queryKey: ['area-labels'] });
    },
  });
}

export function useRemoveLabel(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      if (!taskId) throw new Error('Missing task');
      const { error } = await supabase
        .from('task_labels')
        .delete()
        .eq('task_id', taskId)
        .eq('label', label);
      if (error) throw error;
      return label;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-labels', taskId] });
      qc.invalidateQueries({ queryKey: ['area-labels'] });
    },
  });
}
