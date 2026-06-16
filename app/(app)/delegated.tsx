import { useMemo } from 'react';
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
import { Inbox, UserCheck } from 'lucide-react-native';

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

  const groups = useMemo(() => {
    const byStatus = new Map<TaskStatus, DelegatedTask[]>();
    STATUS_ORDER.forEach((s) => byStatus.set(s, []));
    tasks.forEach((t) => {
      const arr = byStatus.get(t.status) ?? [];
      arr.push(t);
      byStatus.set(t.status, arr);
    });
    return STATUS_ORDER.map((s) => ({ status: s, items: byStatus.get(s) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [tasks]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Tareas delegadas"
        subtitle={`${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'} con seguimiento`}
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
