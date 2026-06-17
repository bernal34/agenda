import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, Inbox, UserCheck } from 'lucide-react-native';

import { Avatar, Badge, EmptyState, ScreenHeader } from '../../components/ui';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';
import { useDelegatedTasks, type DelegatedTask } from '../../lib/queries/tasks';
import type { TaskStatus } from '../../lib/taskModel';
import { isoToLocalTime } from '../../lib/dateFormat';
import { useAuthStore } from '../../stores/authStore';

// Mismo orden de columnas que en el Kanban del área.
const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'in_review', 'done'];

const STATUS_LABEL: Record<string, string> = {
  todo:        'Por hacer',
  in_progress: 'En curso',
  in_review:   'En revisión',
  done:        'Completadas',
};

const STATUS_COLOR: Record<string, string> = {
  todo:        palette.slate[500],
  in_progress: palette.amber[500],
  in_review:   palette.sky[500],
  done:        palette.emerald[500],
};

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function DelegatedScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: tasks = [], isLoading } = useDelegatedTasks(userId);

  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Pools de filtros derivados del dataset actual (no extra queries).
  const assigneePool = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();
    tasks.forEach((t) => t.assignedTo.forEach((u) => map.set(u.id, u)));
    return Array.from(map.values()).sort((a, b) =>
      (a.full_name ?? '').localeCompare(b.full_name ?? ''),
    );
  }, [tasks]);

  const areaPool = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    tasks.forEach((t) => {
      if (t.area) map.set(t.area.id, { id: t.area.id, name: t.area.name, color: t.area.color });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (assigneeFilter && !t.assignedTo.some((u) => u.id === assigneeFilter)) return false;
      if (areaFilter && t.area?.id !== areaFilter) return false;
      if (overdueOnly) {
        if (t.status === 'done') return false;
        if (!t.due_date || t.due_date >= today) return false;
      }
      return true;
    });
  }, [tasks, assigneeFilter, areaFilter, overdueOnly, today]);

  const groups = useMemo(() => {
    const byStatus = new Map<TaskStatus, DelegatedTask[]>();
    STATUS_ORDER.forEach((s) => byStatus.set(s, []));
    filtered.forEach((t) => {
      const arr = byStatus.get(t.status) ?? [];
      arr.push(t);
      byStatus.set(t.status, arr);
    });
    return STATUS_ORDER.map((s) => ({ status: s, items: byStatus.get(s) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [filtered]);

  const anyFilterActive = !!assigneeFilter || !!areaFilter || overdueOnly;
  const clearFilters = () => {
    setAssigneeFilter(null);
    setAreaFilter(null);
    setOverdueOnly(false);
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Tareas delegadas"
        subtitle={
          anyFilterActive
            ? `${filtered.length} de ${tasks.length} (filtrado)`
            : `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'} con seguimiento`
        }
        backLabel="Atrás"
        onBack={close}
      />

      {isLoading ? (
        <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: spacing[10] }} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin tareas delegadas"
          description={
            'Cuando crees tareas y se las pases a otras personas, aparecen acá para que puedas seguir su avance.'
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {(assigneePool.length > 1 || areaPool.length > 1 || tasks.length > 0) && (
            <View style={styles.filters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable
                  onPress={() => setOverdueOnly((v) => !v)}
                  style={[styles.filterChip, overdueOnly && styles.filterChipActiveDanger]}
                >
                  <AlertTriangle
                    size={12}
                    color={overdueOnly ? palette.red[600] : tokens.text.muted}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.filterChipText, overdueOnly && { color: palette.red[600] }]}>
                    Vencidas
                  </Text>
                </Pressable>
                {areaPool.length > 1 &&
                  areaPool.map((a) => {
                    const active = areaFilter === a.id;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => setAreaFilter(active ? null : a.id)}
                        style={[
                          styles.filterChip,
                          active && { backgroundColor: a.color + '14', borderColor: a.color },
                        ]}
                      >
                        <View style={[styles.areaDot, { backgroundColor: a.color }]} />
                        <Text style={[styles.filterChipText, active && { color: a.color }]}>
                          {a.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                {assigneePool.map((u) => {
                  const active = assigneeFilter === u.id;
                  const name = u.full_name?.trim() || 'Miembro';
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => setAssigneeFilter(active ? null : u.id)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Avatar name={name} uri={u.avatar_url} size="xs" />
                      <Text style={[styles.filterChipText, active && { color: tokens.brand[600] }]}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
                {anyFilterActive && (
                  <Pressable onPress={clearFilters} style={styles.clearChip}>
                    <Text style={styles.clearChipText}>Limpiar</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}
          {groups.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="Nada coincide con el filtro"
              description="Probá quitar algún filtro o limpiar todo."
            />
          )}
          {groups.map((g) => (
            <View key={g.status} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[g.status] }]} />
                <Text style={styles.sectionTitle}>{STATUS_LABEL[g.status] ?? g.status}</Text>
                <Text style={styles.sectionCount}>{g.items.length}</Text>
              </View>
              {g.items.map((t) => (
                <DelegatedRow
                  key={t.id}
                  task={t}
                  onPress={() => router.push(`/tasks/${t.id}` as never)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DelegatedRow({
  task,
  onPress,
}: {
  task: DelegatedTask;
  onPress: () => void;
}) {
  const start = formatDateShort(task.start_date);
  const due = formatDateShort(task.due_date);
  const dateLabel =
    start && due && task.start_date !== task.due_date
      ? `${start} – ${due}`
      : due ?? start ?? null;
  const time = isoToLocalTime(task.start_at);
  const statusColor = STATUS_COLOR[task.status] ?? palette.slate[500];
  const isDone = task.status === 'done';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: statusColor },
        isDone && styles.cardDone,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.row}>
        {task.area ? (
          <Badge customColor={task.area.color}>{task.area.name}</Badge>
        ) : (
          <Badge tone="neutral">Sin área</Badge>
        )}
        {dateLabel && <Text style={styles.dateText}>{dateLabel}{time ? ` · ${time}` : ''}</Text>}
      </View>

      <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={2}>
        {task.title}
      </Text>

      {task.assignedTo.length > 0 && (
        <View style={styles.assigneesRow}>
          <UserCheck size={12} color={tokens.text.muted} strokeWidth={2} />
          <View style={styles.avatars}>
            {task.assignedTo.slice(0, 4).map((u) => (
              <Avatar key={u.id} name={u.full_name ?? '?'} uri={u.avatar_url} size="xs" />
            ))}
            {task.assignedTo.length > 4 && (
              <Text style={styles.extraAssignees}>+{task.assignedTo.length - 4}</Text>
            )}
          </View>
          <Text style={styles.assigneesText} numberOfLines={1}>
            {task.assignedTo.map((u) => u.full_name ?? 'Sin nombre').join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${task.progress}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: statusColor }]}>{task.progress}%</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[5] },

  filters: { marginHorizontal: -spacing[5] },
  filterRow: {
    paddingHorizontal: spacing[5],
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  filterChipActive: {
    backgroundColor: palette.brand[500] + '14',
    borderColor: palette.brand[500],
  },
  filterChipActiveDanger: {
    backgroundColor: palette.red[500] + '14',
    borderColor: palette.red[500],
  },
  filterChipText: {
    fontSize: typography.size.xs,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  areaDot: { width: 8, height: 8, borderRadius: 4 },
  clearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  clearChipText: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textDecorationLine: 'underline',
  },

  section: { gap: spacing[2] },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCount: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  card: {
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    borderLeftWidth: 3,
    gap: spacing[2],
    ...shadow.soft,
  },
  cardPressed: { backgroundColor: tokens.bg.subtle },
  cardDone: { opacity: 0.7 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  dateText: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    lineHeight: 19,
  },
  titleDone: { textDecorationLine: 'line-through', color: tokens.text.muted },

  assigneesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatars: { flexDirection: 'row', gap: -6 },
  extraAssignees: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    marginLeft: 2,
  },
  assigneesText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: tokens.text.secondary,
  },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.bg.subtle,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    minWidth: 32,
    textAlign: 'right',
  },
});
