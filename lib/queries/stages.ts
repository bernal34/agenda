import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface BoardStage {
  id: string;
  area_id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_done: boolean;
}

export function useBoardStages(areaId: string | undefined) {
  return useQuery({
    queryKey: ['board-stages', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<BoardStage[]> => {
      const { data, error } = await supabase
        .from('board_stages')
        .select('id, area_id, code, label, color, sort_order, is_done')
        .eq('area_id', areaId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoardStage[];
    },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function useCreateStage(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; color?: string; is_done?: boolean }) => {
      if (!areaId) throw new Error('Missing area');
      const existing = qc.getQueryData<BoardStage[]>(['board-stages', areaId]) ?? [];
      const baseCode = slugify(input.label) || 'stage';
      let code = baseCode;
      let n = 1;
      while (existing.some((s) => s.code === code)) {
        n++;
        code = `${baseCode}_${n}`;
      }
      const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from('board_stages')
        .insert({
          area_id: areaId,
          code,
          label: input.label.trim(),
          color: input.color ?? '#534AB7',
          sort_order: nextOrder,
          is_done: input.is_done ?? false,
        })
        .select('id, area_id, code, label, color, sort_order, is_done')
        .single();
      if (error) throw error;
      return data as BoardStage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-stages', areaId] });
    },
  });
}

export function useUpdateStage(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: { id: string; label?: string; color?: string; sort_order?: number; is_done?: boolean }) => {
      const { error } = await supabase.from('board_stages').update(changes).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-stages', areaId] });
    },
  });
}

export function useReorderStages(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newOrder: BoardStage[]) => {
      // Asignar sort_order según el orden del array
      await Promise.all(
        newOrder.map((s, idx) =>
          supabase.from('board_stages').update({ sort_order: idx }).eq('id', s.id),
        ),
      );
    },
    onMutate: async (newOrder) => {
      const key = ['board-stages', areaId];
      const prev = qc.getQueryData<BoardStage[]>(key);
      qc.setQueryData<BoardStage[]>(key, newOrder.map((s, idx) => ({ ...s, sort_order: idx })));
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['board-stages', areaId], ctx.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-stages', areaId] });
    },
  });
}

export function useDeleteStage(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stage: BoardStage) => {
      // Bloquear si hay tareas en esta etapa
      const { count, error: cErr } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('area_id', stage.area_id)
        .eq('status', stage.code);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`No se puede eliminar: hay ${count} tarea(s) en esta etapa. Movelas primero.`);
      }
      const { error } = await supabase.from('board_stages').delete().eq('id', stage.id);
      if (error) throw error;
      return stage.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-stages', areaId] });
    },
  });
}
