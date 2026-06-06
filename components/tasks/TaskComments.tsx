import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, X } from 'lucide-react-native';

import { Avatar, SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import {
  CommentAuthor,
  TaskComment,
  useCommentAuthors,
  useCreateComment,
  useDeleteComment,
  useTaskComments,
} from '../../lib/queries/comments';

function formatStamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderBody(body: string) {
  const parts = body.split(/(@[\w.-]+)/g);
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <Text key={i} style={styles.mention}>
        {p}
      </Text>
    ) : (
      <Text key={i}>{p}</Text>
    ),
  );
}

export function TaskComments({ taskId, userId }: { taskId: string; userId: string | undefined }) {
  const { data: comments, isLoading, error } = useTaskComments(taskId);
  const authorIds = (comments ?? []).map((c) => c.author_id);
  const { data: authors } = useCommentAuthors(authorIds);
  const createMut = useCreateComment(taskId);
  const deleteMut = useDeleteComment(taskId);

  const authorMap = useMemo(() => {
    const m = new Map<string, CommentAuthor>();
    (authors ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [authors]);

  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    const t = draft.trim();
    if (t.length < 1) return;
    setDraft('');
    try {
      await createMut.mutateAsync({ body: t });
    } catch (err) {
      setDraft(t);
      notify('No se pudo enviar', err instanceof Error ? err.message : 'Error');
    }
  };

  const canSend = !createMut.isPending && draft.trim().length > 0;

  return (
    <View style={styles.section}>
      <SectionHeader title="Comentarios" count={comments?.length} />

      {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 8 }} />}
      {error && (
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Error cargando comentarios'}
        </Text>
      )}

      {comments?.length === 0 && !isLoading && (
        <Text style={styles.empty}>Sé el primero en comentar.</Text>
      )}

      {comments?.map((c) => {
        const isMine = c.author_id === userId;
        const author = authorMap.get(c.author_id);
        return (
          <CommentRow
            key={c.id}
            comment={c}
            authorName={isMine ? 'Vos' : author?.full_name?.trim() || 'Miembro'}
            authorAvatar={author?.avatar_url ?? null}
            canDelete={isMine}
            onDelete={() => deleteMut.mutate(c.id)}
          />
        );
      })}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribí un comentario... usá @ para mencionar"
          placeholderTextColor={tokens.text.muted}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            !canSend && styles.sendDisabled,
            pressed && canSend && styles.sendPressed,
          ]}
        >
          {createMut.isPending ? (
            <ActivityIndicator color={tokens.brand.fg} size="small" />
          ) : (
            <Send size={14} color={tokens.brand.fg} strokeWidth={2.2} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function CommentRow({
  comment,
  authorName,
  authorAvatar,
  canDelete,
  onDelete,
}: {
  comment: TaskComment;
  authorName: string;
  authorAvatar: string | null;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.commentRow}>
      <Avatar name={authorName} uri={authorAvatar} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={styles.commentHead}>
          <Text style={styles.author}>{authorName}</Text>
          <Text style={styles.stamp}>{formatStamp(comment.created_at)}</Text>
          {canDelete && (
            <Pressable onPress={onDelete} hitSlop={6} style={styles.deleteBtn}>
              <X size={12} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        <Text style={styles.body}>{renderBody(comment.body)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[1] },

  commentRow: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: spacing[2],
  },
  author: {
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    fontSize: typography.size.sm,
  },
  stamp: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  deleteBtn: { marginLeft: 'auto', padding: 2 },
  body: {
    color: tokens.text.primary,
    fontSize: typography.size.sm,
    lineHeight: 19,
  },
  mention: {
    color: palette.brand[600],
    fontWeight: typography.weight.semibold as '600',
  },

  composer: { marginTop: spacing[3], gap: spacing[2] },
  input: {
    minHeight: 60,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    textAlignVertical: 'top',
    backgroundColor: tokens.bg.surface,
  },
  sendBtn: {
    backgroundColor: palette.brand[600],
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  sendDisabled: { backgroundColor: palette.brand[300] },
  sendPressed: { backgroundColor: palette.brand[700] },

  empty: {
    color: tokens.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[3],
  },
  error: { color: palette.red[600], fontSize: typography.size.sm },
});
