import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';

export interface AdminProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  status: string | null;
  org_id: string | null;
}

export interface AdminAreaSummary {
  id: string;
  name: string;
  color: string;
  personal: boolean;
  member_count: number;
}

export interface MemberAssignment {
  user_id: string;
  area_id: string;
  role: 'owner' | 'admin' | 'member';
}

/**
 * Lista todos los profiles de la org del usuario actual.
 * Requiere que el usuario sea super_admin o admin de ops para tener
 * permiso de lectura cruzada (sino RLS lo filtra al perfil propio).
 */
export function useAdminProfiles(orgId: string | undefined) {
  return useQuery({
    queryKey: ['admin-profiles', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<AdminProfile[]> => {
      const { data, error } = await sbCore()
        .from('profiles')
        .select('id, full_name, avatar_url, status, org_id')
        .eq('org_id', orgId!)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdminProfile[];
    },
  });
}

/**
 * Listado de áreas con conteo de miembros, para el panel admin.
 * No incluye personales (se filtran porque cada uno tiene su personal).
 */
export function useAdminAreas() {
  return useQuery({
    queryKey: ['admin-areas'],
    queryFn: async (): Promise<AdminAreaSummary[]> => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name, color, personal, area_members(count)')
        .eq('personal', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        personal: a.personal,
        member_count: a.area_members?.[0]?.count ?? 0,
      }));
    },
  });
}

/**
 * Membresías de un usuario en áreas (con rol).
 */
export function useUserAreaMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-memberships', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MemberAssignment[]> => {
      const { data, error } = await supabase
        .from('area_members')
        .select('area_id, user_id, role')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as MemberAssignment[];
    },
  });
}

export function useAssignMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MemberAssignment) => {
      const { error } = await supabase
        .from('area_members')
        .upsert(input, { onConflict: 'area_id,user_id' });
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ['user-memberships', input.user_id] });
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
      qc.invalidateQueries({ queryKey: ['my-areas'] });
      qc.invalidateQueries({ queryKey: ['area-members'] });
    },
  });
}

export function useUnassignMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; area_id: string }) => {
      const { error } = await supabase
        .from('area_members')
        .delete()
        .eq('area_id', input.area_id)
        .eq('user_id', input.user_id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ['user-memberships', input.user_id] });
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
      qc.invalidateQueries({ queryKey: ['my-areas'] });
      qc.invalidateQueries({ queryKey: ['area-members'] });
    },
  });
}

/**
 * Chequea si el usuario actual tiene permisos de administración.
 * Hoy: super_admin global. Mañana: también can_edit('ops','admin').
 */
export function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await sbCore().rpc('is_super_admin');
      if (error) return false;
      return !!data;
    },
  });
}
