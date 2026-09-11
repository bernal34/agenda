import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface MyArea {
  id: string;
  name: string;
  color: string;
  slug: string;
  personal: boolean;
  role: 'owner' | 'admin' | 'member';
}

export function useMyAreas(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-areas', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyArea[]> => {
      const { data, error } = await supabase
        .from('area_members')
        .select('role, area:areas(id, name, color, slug, personal)')
        .eq('user_id', userId!);

      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.area)
        .map((r: any) => ({
          id: r.area.id,
          name: r.area.name,
          color: r.area.color,
          slug: r.area.slug,
          personal: !!r.area.personal,
          role: r.role,
        }));
    },
  });
}

export interface CreateAreaInput {
  name: string;
  color: string;
  userId: string;
  personal?: boolean;
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color, personal }: CreateAreaInput) => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error('Nombre demasiado corto');

      // Los dos tipos van por RPC SECURITY DEFINER (050 y 260): la policy
      // "areas write" solo deja escribir ops.areas a un admin de ops. El slug
      // y el alta del creador como owner los resuelve el server.
      const { data, error } = await supabase.rpc(
        personal ? 'create_personal_area' : 'create_area',
        { p_name: trimmed, p_color: color },
      );
      if (error) throw error;
      return { id: data as string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['my-areas', vars.userId] });
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
    },
  });
}

export interface RenameAreaInput {
  areaId: string;
  name: string;
}

/** Renombra un tablero. El server exige owner/admin del área (260). */
export function useRenameArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ areaId, name }: RenameAreaInput) => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error('Nombre demasiado corto');

      const { error } = await supabase.rpc('rename_area', {
        p_area: areaId,
        p_name: trimmed,
      });
      if (error) throw error;
      return { areaId, name: trimmed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-areas'] });
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
    },
  });
}

/** Borra un tablero y todo lo suyo. El server exige owner/admin del área (270). */
export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (areaId: string) => {
      const { error } = await supabase.rpc('delete_area', { p_area: areaId });
      if (error) throw error;
      return areaId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-areas'] });
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
    },
  });
}

/**
 * Asegura que el usuario actual tenga al menos un tablero personal.
 * Llama al RPC idempotente del lado server. Es red de seguridad por si
 * el trigger de profile-insert no corrió.
 */
export function useEnsurePersonalBoard(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.rpc('ensure_my_personal_board');
      if (!cancelled && !error) {
        qc.invalidateQueries({ queryKey: ['my-areas', userId] });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, qc]);
}
