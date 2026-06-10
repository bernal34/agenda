import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'url';

export interface CustomField {
  id: string;
  area_id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[] | null;
  position: number;
  required: boolean;
}

export interface CustomValue {
  task_id: string;
  field_id: string;
  value: unknown;
}

export function useAreaCustomFields(areaId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<CustomField[]> => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id, area_id, key, label, type, options, position, required')
        .eq('area_id', areaId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        options: r.options ?? null,
      })) as CustomField[];
    },
  });
}

export function useTaskCustomValues(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-custom-values', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase
        .from('task_custom_values')
        .select('field_id, value')
        .eq('task_id', taskId!);
      if (error) throw error;
      const m: Record<string, unknown> = {};
      (data ?? []).forEach((r: any) => { m[r.field_id] = r.value; });
      return m;
    },
  });
}

function slugify(s: string) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)+/g, '').slice(0, 40) || `f_${Date.now()}`;
}

export function useCreateCustomField(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      label, type, options, required,
    }: { label: string; type: CustomFieldType; options?: string[] | null; required?: boolean }) => {
      if (!areaId) throw new Error('Sin tablero');
      const key = `${slugify(label)}_${Math.random().toString(36).slice(2, 5)}`;
      const { data, error } = await supabase
        .from('custom_fields')
        .insert({
          area_id: areaId,
          key,
          label: label.trim(),
          type,
          options: type === 'select' ? options ?? [] : null,
          required: !!required,
        })
        .select('id, area_id, key, label, type, options, position, required')
        .single();
      if (error) throw error;
      return data as CustomField;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields', areaId] }); },
  });
}

export function useDeleteCustomField(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields', areaId] }); },
  });
}

export function useSetCustomValue(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fieldId, value }: { fieldId: string; value: unknown }) => {
      if (!taskId) throw new Error('Sin tarea');
      if (value === null || value === undefined || value === '') {
        const { error } = await supabase
          .from('task_custom_values')
          .delete()
          .eq('task_id', taskId)
          .eq('field_id', fieldId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('task_custom_values')
        .upsert({
          task_id: taskId,
          field_id: fieldId,
          value,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-custom-values', taskId] }); },
  });
}
