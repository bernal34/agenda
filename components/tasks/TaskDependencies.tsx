import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, GitBranch, Plus, Search, X } from 'lucide-react-native';

import { SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import {
  DependencyRef,
  useAddDependency,
  useRemoveDependency,
  useTaskDependencies,
} from '../../lib/queries/dependencies';
import { useAreaTasks } from '../../lib/queries/tasks';

interface Props {
  taskId: string;
  areaId: string | undefined;
}

export function TaskDependencies({ taskId, areaId }: Props) {
  const router = useRouter();
  const depsQ = useTaskDependencies(taskId);
  const areaTasksQ = useAreaTasks(areaId);
  const addMut = useAddDependency(taskId);
  const removeMut = useRemoveDependency(taskId);

  const [pickerOpen, setPickerOpen] = useState<null | 'blockedBy' | 'blocks'>(null);
  const [q, setQ] = useState('');

  const exclude = useMemo(() => {
    const s = new Set<string>([taskId]);
    depsQ.data?.blockedBy.forEach((t) => s.add(t.id));
    depsQ.data?.blocks.forEach((t) => s.add(t.id));
    return s;
  }, [depsQ.data, taskId]);

  const candidates = useMemo(() => {
    const pool = areaTasksQ.data ?? [];
    const filt = q.trim().toLowerCase();
    return pool
      .filter((t) => !exclude.has(t.id))
      .filter((t) => !filt || t.title.toLowerCase().includes(filt))
      .slice(0, 12);
  }, [areaTasksQ.data, exclude, q]);

  const handlePick = async (other: { id: string }) => {
    try {
      await addMut.mutateAsync({ otherId: other.id, reverse: pickerOpen === 'blocks' });
      setPickerOpen(null);
      setQ('');
    } catch (err) {
      notify('No se pudo vincular', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleRemove = async (ref: DependencyRef, reverse: boolean) => {
    try {
      await removeMut.mutateAsync({ dependsOn: ref.id, reverse });
    } catch (err) {
      notify('No se pudo quitar', err instanceof Error ? err.message : 'Error');
    }
  };

  const renderRow = (ref: DependencyRef, reverse: boolean) => {
    const isDone = ref.status === 'done' || ref.archived_at;
    return (
      <Pressable
        key={ref.id}
        onPress={() => router.push(`/tasks/${ref.id}` as never)}
        style={({ pressed }) => [styles.depRow, pressed && styles.depRowPressed]}
      >
        {isDone ? (
          <CircleCheck size={14} color={palette.emerald[600]} strokeWidth={2.2} />
        ) : (
          <GitBranch size={14} color={tokens.text.muted} strokeWidth={2} />
        )}
        <Text style={[styles.depTitle, isDone && styles.depTitleDone]} numberOfLines={1}>
          {ref.title}
        </Text>
        <Pressable
          onPress={() => handleRemove(ref, reverse)}
          hitSlop={6}
          style={styles.depRemove}
        >
          <X size={12} color={tokens.text.muted} strokeWidth={2} />
        </Pressable>
      </Pressable>
    );
  };

  const data = depsQ.data;

  return (
    <View style={styles.section}>
      <SectionHeader title="Dependencias" />

      {depsQ.isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 4 }} />}
      {depsQ.error && (
        <Text style={styles.error}>
          {depsQ.error instanceof Error ? depsQ.error.message : 'Error cargando dependencias'}
        </Text>
      )}

      <View style={styles.subBlock}>
        <View style={styles.subHeader}>
          <Text style={styles.subLabel}>Depende de</Text>
          <Pressable
            onPress={() => { setPickerOpen('blockedBy'); setQ(''); }}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            hitSlop={6}
          >
            <Plus size={12} color={tokens.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Agregar</Text>
          </Pressable>
        </View>
        {data && data.blockedBy.length === 0 && (
          <Text style={styles.empty}>Sin bloqueos.</Text>
        )}
        {data?.blockedBy.map((r) => renderRow(r, false))}
      </View>

      <View style={styles.subBlock}>
        <View style={styles.subHeader}>
          <Text style={styles.subLabel}>Bloquea a</Text>
          <Pressable
            onPress={() => { setPickerOpen('blocks'); setQ(''); }}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            hitSlop={6}
          >
            <Plus size={12} color={tokens.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Agregar</Text>
          </Pressable>
        </View>
        {data && data.blocks.length === 0 && (
          <Text style={styles.empty}>No bloquea a ninguna.</Text>
        )}
        {data?.blocks.map((r) => renderRow(r, true))}
      </View>

      {pickerOpen && (
        <View style={styles.picker}>
          <View style={styles.searchBar}>
            <Search size={14} color={tokens.text.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder={pickerOpen === 'blockedBy' ? 'Buscar tarea que bloquea' : 'Buscar tarea bloqueada'}
              placeholderTextColor={tokens.text.muted}
              autoFocus
            />
            <Pressable onPress={() => { setPickerOpen(null); setQ(''); }} hitSlop={6}>
              <X size={14} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
          {candidates.length === 0 && (
            <Text style={styles.empty}>
              {areaTasksQ.isLoading ? 'Cargando...' : 'Sin coincidencias en el tablero.'}
            </Text>
          )}
          {candidates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => handlePick(t)}
              style={({ pressed }) => [styles.candRow, pressed && styles.candRowPressed]}
            >
              <Text style={styles.candTitle} numberOfLines={1}>{t.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[2] },
  subBlock: { gap: spacing[1] },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  subLabel: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  depRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  depRowPressed: { backgroundColor: palette.brand[50], borderColor: palette.brand[200] },
  depTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
  },
  depTitleDone: {
    color: tokens.text.muted,
    textDecorationLine: 'line-through',
  },
  depRemove: {
    padding: 4,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[200],
  },
  addBtnPressed: { backgroundColor: palette.brand[100] },
  addBtnText: {
    color: tokens.brand[600],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
  },

  picker: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: palette.brand[200],
    borderRadius: radius.md,
    padding: spacing[2],
    gap: spacing[1],
    backgroundColor: palette.brand[50],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    backgroundColor: tokens.bg.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
  },
  candRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.sm,
  },
  candRowPressed: { backgroundColor: palette.brand[100] },
  candTitle: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
  },

  empty: {
    color: tokens.text.muted,
    fontSize: typography.size.xs,
    paddingVertical: 4,
  },
  error: { color: palette.red[600], fontSize: typography.size.sm },
});
