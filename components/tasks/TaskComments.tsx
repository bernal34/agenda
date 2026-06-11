import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import { Send, X } from 'lucide-react-native';

import { Avatar, SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import { useAreaMembers, AreaMember } from '../../lib/queries/assignees';
import {
  CommentAuthor,
  TaskComment,
  useCommentAuthors,
  useCreateComment,
  useDeleteComment,
  useTaskComments,
} from '../../lib/queries/comments';

// El token que se inserta en el body al elegir un miembro.
// Usamos el primer nombre (sin espacios). Si dos miembros del área
// tienen el mismo primer nombre, agregamos el inicial del apellido.
function mentionToken(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}

function displayHandle(member: AreaMember, all: AreaMember[]): string {
  const name = member.full_name?.trim() || 'usuario';
  const first = firstWord(name);
  const others = all.filter(
    (m) => m.id !== member.id && firstWord(m.full_name?.trim() || '') === first,
  );
  if (others.length === 0) return mentionToken(first);
  const rest = name.slice(first.length).trim();
  const initial = rest ? rest[0] : '';
  return mentionToken(`${first}${initial}`);
}

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

// Mismo regex (con acentos) que se usa al guardar para resolver los handles
// en IDs de miembros y al render para resaltar.
const MENTION_TOKEN = /@[A-Za-zÀ-ÿ0-9._-]+/g;

function renderBody(body: string) {
  const parts = body.split(/(@[A-Za-zÀ-ÿ0-9._-]+)/g);
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

interface Props {
  taskId: string;
  areaId: string | undefined;
  userId: string | undefined;
}

export function TaskComments({ taskId, areaId, userId }: Props) {
  const { data: comments, isLoading, error } = useTaskComments(taskId);
  const authorIds = (comments ?? []).map((c) => c.author_id);
  const { data: authors } = useCommentAuthors(authorIds);
  const { data: members } = useAreaMembers(areaId);
  const createMut = useCreateComment(taskId);
  const deleteMut = useDeleteComment(taskId);

  const authorMap = useMemo(() => {
    const m = new Map<string, CommentAuthor>();
    (authors ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [authors]);

  // Mapa handle -> id para resolver menciones al enviar.
  const handleMap = useMemo(() => {
    const m = new Map<string, string>();
    const all = members ?? [];
    all.forEach((mem) => {
      const handle = displayHandle(mem, all).toLowerCase();
      if (handle) m.set(handle, mem.id);
    });
    return m;
  }, [members]);

  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);

  // Detecta el token @parcial inmediatamente a la izquierda del caret.
  const trigger = useMemo(() => {
    if (selection.start !== selection.end) return null;
    const upto = draft.slice(0, selection.start);
    const m = upto.match(/(?:^|\s)@([A-Za-zÀ-ÿ0-9._-]*)$/);
    if (!m) return null;
    return { query: m[1] ?? '', start: selection.start - (m[1]?.length ?? 0) - 1 };
  }, [draft, selection]);

  const suggestions = useMemo(() => {
    if (!trigger || !members) return [];
    const q = trigger.query.toLowerCase();
    const pool = members.filter((m) => m.id !== userId);
    if (!q) return pool.slice(0, 5);
    return pool
      .filter((m) => (m.full_name ?? '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [trigger, members, userId]);

  const insertMention = useCallback(
    (member: AreaMember) => {
      if (!trigger || !members) return;
      const handle = displayHandle(member, members);
      const before = draft.slice(0, trigger.start);
      const after = draft.slice(selection.start);
      const insert = `@${handle} `;
      const next = before + insert + after;
      setDraft(next);
      const caret = (before + insert).length;
      // Sync selection state inmediatamente para no reabrir el popup.
      setSelection({ start: caret, end: caret });
      requestAnimationFrame(() => inputRef.current?.setSelection?.(caret, caret));
    },
    [draft, members, selection.start, trigger],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelection(e.nativeEvent.selection);
    },
    [],
  );

  const handleSend = async () => {
    const t = draft.trim();
    if (t.length < 1) return;
    // Resolver los handles presentes en el body a IDs de miembros.
    const matched = Array.from(new Set(t.match(MENTION_TOKEN) ?? []))
      .map((tok) => handleMap.get(tok.slice(1).toLowerCase()))
      .filter((id): id is string => !!id && id !== userId);
    setDraft('');
    try {
      await createMut.mutateAsync({ body: t, mentions: matched });
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
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => insertMention(m)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
              >
                <Avatar name={m.full_name ?? 'Miembro'} uri={m.avatar_url} size="xs" />
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {m.full_name?.trim() || 'Miembro'}
                </Text>
                <Text style={styles.suggestionHandle} numberOfLines={1}>
                  @{members ? displayHandle(m, members) : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSelectionChange={handleSelectionChange}
          selection={selection}
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
  suggestions: {
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    borderRadius: radius.md,
    backgroundColor: tokens.bg.surface,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
  },
  suggestionPressed: { backgroundColor: palette.brand[50] },
  suggestionName: {
    flex: 1,
    color: tokens.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
  },
  suggestionHandle: {
    color: tokens.text.muted,
    fontSize: typography.size.xs,
  },
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
