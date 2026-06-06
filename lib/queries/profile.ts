import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sbCore, supabase } from '../supabase';

export interface MyProfile {
  id: string;
  org_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: string | null;
}

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await sbCore()
        .from('profiles')
        .select('id, org_id, full_name, avatar_url, phone, status')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as MyProfile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; full_name?: string; phone?: string; avatar_url?: string | null }) => {
      const { id, ...changes } = input;
      const { error } = await sbCore().from('profiles').update(changes).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['my-profile', id] });
    },
  });
}

export interface UploadAvatarInput {
  userId: string;
  blob: Blob;
  ext: string;
}

export async function uploadAvatar({ userId, blob, ext }: UploadAvatarInput): Promise<string> {
  const safeExt = (ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: blob.type || `image/${safeExt}`,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
