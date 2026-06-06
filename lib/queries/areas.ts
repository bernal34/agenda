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

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 40) || `area-${Date.now()}`;
}

export interface CreateAreaInput {
  name: string;
  color: string;
  orgId: string;
  userId: string;
  personal?: boolean;
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color, orgId, userId, personal }: CreateAreaInput) => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error('Nombre demasiado corto');

      // Tableros personales: ruta vía RPC SECURITY DEFINER, así cualquier user
      // (no solo admin de ops) puede crear el suyo.
      if (personal) {
        const { data, error } = await supabase.rpc('create_personal_area', {
          p_name: trimmed,
          p_color: color,
        });
        if (error) throw error;
        return { id: data as string };
      }

      // Tableros compartidos: flujo clásico (requiere admin de ops por RLS).
      const baseSlug = slugify(trimmed);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: area, error: areaErr } = await supabase
        .from('areas')
        .insert({ name: trimmed, color, slug, org_id: orgId })
        .select('id')
        .single();
      if (areaErr) throw areaErr;

      const { error: memberErr } = await supabase
        .from('area_members')
        .insert({ area_id: area.id, user_id: userId, role: 'owner' });

      if (memberErr) {
        await supabase.from('areas').delete().eq('id', area.id);
        throw memberErr;
      }

      return { id: area.id as string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['my-areas', vars.userId] });
    },
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (areaId: string) => {
      const { error } = await supabase.from('areas').delete().eq('id', areaId);
      if (error) throw error;
      return areaId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-areas'] });
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
