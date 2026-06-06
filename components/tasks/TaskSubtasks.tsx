import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';

import { SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import {
  Subtask,
  useCreateSubtask,
  useDeleteSubtask,
  useTaskSubtasks,
  useToggleSubtask,
} from '../../lib/queries/subtasks';

export function TaskSubtasks({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskSubtasks(taskId);
  const createMut = useCreateSubtask(taskId);
  const toggleMut = useToggleSubtask(taskId);
  const deleteMut = useDeleteSubtask(taskId);

  const [draft, setDraft] = useState('');

  const handleAdd = async () => {
    const t = draft.trim();
    if (t.length < 2) return;
    setDraft('');
    try {
      await createMut.mutateAsync(t);
    } catch (err) {
      setDraft(t);
      notify('No se pudo agregar', err instanceof Error ? err.message : 'Error');
    }
  };

  const total = data?.length ?? 0;
  const done = (data ?? []).filter((s) => s.done).length;
  const canAdd = !createMut.isPending && draft.trim().length >= 2;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Subtareas"
        count={total > 0 ? done : undefined}
        right={total > 0 ? <Text style={styles.fraction}>de {total}</Text> : undefined}
      />

      {isLoading && <ActivityIndicator color={tokens.brand[600]} />}
      <View style={styles.list}>
        {data?.map((s) => (
          <SubtaskRow
            key={s.id}
            subtask={s}
            onToggle={() => toggleMut.mutate({ id: s.id, done: !s.done })}
            onDelete={() => deleteMut.mutate(s.id)}
          />
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Nueva subtarea..."
          placeholderTextColor={tokens.text.muted}
          onSubmitEditing={handleAdd}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleAdd}
          disabled={!canAdd}
          style={({ pressed }) => [
            styles.addBtn,
            !canAdd && styles.addBtnDisabled,
            pressed && canAdd && styles.addBtnPressed,
          ]}
        >
          <Plus size={16} color={tokens.brand.fg} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onDelete,
}: {
  subtask: Subtask;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={[styles.checkbox, subtask.done && styles.checkboxDone]}
      >
        {subtask.done && <Check size={12} color={tokens.brand.fg} strokeWidth={3} />}
      </Pressable>
      <Text style={[styles.rowTitle, subtask.done && styles.rowTitleDone]}>
        {subtask.title}
      </Text>
      <Pressable onPress={onDelete} hitSlop={6} style={styles.deleteBtn}>
        <X size={14} color={tokens.text.muted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[1] },
  fraction: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    gap: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: tokens.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg.surface,
  },
  checkboxDone: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  rowTitle: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    flex: 1,
  },
  rowTitleDone: {
    color: tokens.text.muted,
    textDecorationLine: 'line-through',
  },
  deleteBtn: { padding: 4 },

  addRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },
  addBtn: {
    backgroundColor: palette.brand[600],
    width: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: palette.brand[300] },
  addBtnPressed: { backgroundColor: palette.brand[700] },
});
