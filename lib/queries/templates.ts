import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { TaskPriority } from '../taskModel';

export interface TaskTemplate {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  position: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  labels: string[];
}

export function useAreaTemplates(areaId: string | undefined) {
  return useQuery({
    queryKey: ['templates', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<TaskTemplate[]> => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('id, area_id, name, description, created_at')
        .eq('area_id', areaId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskTemplate[];
    },
  });
}

export function useTemplateItems(templateId: string | undefined) {
  return useQuery({
    queryKey: ['template-items', templateId],
    enabled: !!templateId,
    queryFn: async (): Promise<TemplateItem[]> => {
      const { data, error } = await supabase
        .from('task_template_items')
        .select('id, template_id, position, title, description, priority, labels')
        .eq('template_id', templateId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateItem[];
    },
  });
}

export function useCreateTemplate(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string | null }) => {
      if (!areaId) throw new Error('Sin tablero');
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('task_templates')
        .insert({ area_id: areaId, name: name.trim(), description: description?.trim() || null, created_by: user?.id ?? null })
        .select('id, area_id, name, description, created_at')
        .single();
      if (error) throw error;
      return data as TaskTemplate;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates', areaId] }); },
  });
}

export function useDeleteTemplate(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates', areaId] }); },
  });
}

export function useAddTemplateItem(templateId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title, description, priority, labels, position,
    }: { title: string; description?: string | null; priority: TaskPriority; labels: string[]; position: number }) => {
      if (!templateId) throw new Error('Sin plantilla');
      const { data, error } = await supabase
        .from('task_template_items')
        .insert({
          template_id: templateId,
          position,
          title: title.trim(),
          description: description?.trim() || null,
          priority,
          labels,
        })
        .select('id, template_id, position, title, description, priority, labels')
        .single();
      if (error) throw error;
      return data as TemplateItem;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['template-items', templateId] }); },
  });
}

export function useRemoveTemplateItem(templateId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_template_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['template-items', templateId] }); },
  });
}

export function useApplyTemplate(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, initialStatus }: { templateId: string; initialStatus: string }) => {
      if (!areaId) throw new Error('Sin tablero');
      const { data: items, error: itemsErr } = await supabase
        .from('task_template_items')
        .select('title, description, priority, labels')
        .eq('template_id', templateId)
        .order('position', { ascending: true });
      if (itemsErr) throw itemsErr;
      if (!items || items.length === 0) throw new Error('La plantilla no tiene items');

      const { data: { user } } = await supabase.auth.getUser();
      const rows = items.map((it) => ({
        area_id: areaId,
        title: it.title,
        description: it.description ?? null,
        priority: it.priority,
        status: initialStatus,
        progress: 0,
        created_by: user?.id ?? null,
      }));
      const { data: createdTasks, error: insErr } = await supabase
        .from('tasks')
        .insert(rows)
        .select('id');
      if (insErr) throw insErr;

      const labelRows: { task_id: string; label: string }[] = [];
      createdTasks?.forEach((t, idx) => {
        const labels = items[idx]?.labels ?? [];
        labels.forEach((l: string) => labelRows.push({ task_id: t.id, label: l }));
      });
      if (labelRows.length > 0) {
        const { error: lErr } = await supabase.from('task_labels').insert(labelRows);
        if (lErr) throw lErr;
      }
      return createdTasks?.length ?? 0;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area-tasks', areaId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}
