import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const BUCKET = 'task-attachments';
const SIGNED_URL_TTL = 60 * 60; // 1 h

export interface TaskAttachment {
  id: string;
  task_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-attachments', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskAttachment[]> => {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('id, task_id, storage_path, filename, mime_type, size_bytes, uploaded_by, uploaded_at')
        .eq('task_id', taskId!)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskAttachment[];
    },
  });
}

export interface UploadInput {
  taskId: string;
  blob: Blob;
  filename: string;
  mimeType: string | null;
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, blob, filename, mimeType }: UploadInput) => {
      const safeExt = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${taskId}/${Date.now()}-${rand}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: mimeType ?? blob.type ?? `application/${safeExt}` });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error: rowErr } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          storage_path: path,
          filename,
          mime_type: mimeType,
          size_bytes: (blob as any).size ?? null,
          uploaded_by: user?.id ?? null,
        })
        .select('id, task_id, storage_path, filename, mime_type, size_bytes, uploaded_by, uploaded_at')
        .single();

      if (rowErr) {
        // rollback storage si falla la insert del row
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw rowErr;
      }
      return row as TaskAttachment;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['task-attachments', data.task_id] });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: Pick<TaskAttachment, 'id' | 'task_id' | 'storage_path'>) => {
      const { error: rowErr } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', att.id);
      if (rowErr) throw rowErr;

      // El object queda; el row no — fail silently si la policy lo bloquea
      await supabase.storage.from(BUCKET).remove([att.storage_path]).catch(() => {});
      return att;
    },
    onSuccess: (att) => {
      qc.invalidateQueries({ queryKey: ['task-attachments', att.task_id] });
    },
  });
}

/**
 * Genera un signed URL temporal para descargar / previsualizar un adjunto.
 * El bucket es privado, así que no se puede usar getPublicUrl.
 */
export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error) throw error;
  return data.signedUrl;
}
