import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AreaMemberRole = 'owner' | 'admin' | 'member';

export interface AreaCandidate {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_member: boolean;
  member_role: AreaMemberRole | null;
}

export function useAreaCandidates(areaId: string | undefined) {
  return useQuery({
    queryKey: ['area-candidates', areaId],
    enabled: !!areaId,
    queryFn: async (): Promise<AreaCandidate[]> => {
      const { data, error } = await supabase.rpc('list_org_users_for_area', {
        p_area: areaId!,
      });
      if (error) throw error;
      return (data ?? []) as AreaCandidate[];
    },
  });
}

function invalidateAreaCaches(qc: ReturnType<typeof useQueryClient>, areaId: string) {
  qc.invalidateQueries({ queryKey: ['area-candidates', areaId] });
  qc.invalidateQueries({ queryKey: ['area-members', areaId] });
}

export function useAddAreaMember(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AreaMemberRole }) => {
      if (!areaId) throw new Error('Sin área');
      const { error } = await supabase.rpc('add_area_member', {
        p_area: areaId,
        p_user: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (areaId) invalidateAreaCaches(qc, areaId);
    },
  });
}

export function useRemoveAreaMember(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!areaId) throw new Error('Sin área');
      const { error } = await supabase.rpc('remove_area_member', {
        p_area: areaId,
        p_user: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (areaId) invalidateAreaCaches(qc, areaId);
    },
  });
}

export function useUpdateAreaMemberRole(areaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AreaMemberRole }) => {
      if (!areaId) throw new Error('Sin área');
      const { error } = await supabase.rpc('update_area_member_role', {
        p_area: areaId,
        p_user: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (areaId) invalidateAreaCaches(qc, areaId);
    },
  });
}
