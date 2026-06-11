import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, sbCore } from '../supabase';

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
}

export interface CommentAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, task_id, author_id, body, parent_id, created_at')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskComment[];
    },
  });
}

export function useCommentAuthors(authorIds: string[]) {
  const uniq = Array.from(new Set(authorIds)).filter(Boolean);
  return useQuery({
    queryKey: ['comment-authors', uniq.sort().join(',')],
    enabled: uniq.length > 0,
    queryFn: async (): Promise<CommentAuthor[]> => {
      const { data, error } = await sbCore()
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uniq);
      if (error) throw error;
      return (data ?? []) as CommentAuthor[];
    },
  });
}

export function useCreateComment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      parentId,
      mentions,
    }: {
      body: string;
      parentId?: string | null;
      mentions?: string[];
    }) => {
      if (!taskId) throw new Error('Missing task');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');
      const uniqueMentions = Array.from(
        new Set((mentions ?? []).filter((id) => id && id !== user.id)),
      );
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: user.id,
          body: body.trim(),
          parent_id: parentId ?? null,
          mentions: uniqueMentions,
        })
        .select('id, task_id, author_id, body, parent_id, created_at')
        .single();
      if (error) throw error;
      return data as TaskComment;
    },
    onSuccess: (row) => {
      qc.setQueryData<TaskComment[]>(['task-comments', row.task_id], (prev) => {
        if (!prev) return [row];
        if (prev.some((c) => c.id === row.id)) return prev;
        return [...prev, row];
      });
    },
  });
}

export function useDeleteComment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_comments').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<TaskComment[]>(['task-comments', taskId], (prev) =>
        prev ? prev.filter((c) => c.id !== id) : prev,
      );
    },
  });
}
