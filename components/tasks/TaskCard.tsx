import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, Clock, AlertCircle } from 'lucide-react-native';

import { Badge } from '../ui/Badge';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';
import { isoToLocalTime } from '../../lib/dateFormat';
import { colorForLabel } from '../../lib/labelColor';
import { MyTask, TaskPriority, TaskStatus } from '../../lib/queries/tasks';

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low:    palette.slate[400],
  normal: palette.sky[500],
  high:   palette.amber[500],
  urgent: palette.red[500],
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'Por hacer',
  in_progress: 'En curso',
  in_review:   'En revisión',
  done:        'Completada',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo:        palette.slate[500],
  in_progress: palette.amber[500],
  in_review:   palette.sky[500],
  done:        palette.emerald[500],
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function isOverdue(iso: string | null, status: TaskStatus) {
  if (!iso || status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00') < today;
}

interface Props {
  task: MyTask;
  onPress?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, onPress, compact = false }: Props) {
  const due = formatDate(task.due_date);
  const overdue = isOverdue(task.due_date, task.status);
  const startTime = isoToLocalTime(task.start_at);
  const statusColor = STATUS_COLOR[task.status];
  const isDone = task.status === 'done';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { borderLeftColor: statusColor },
        isDone && styles.cardDone,
        pressed && onPress && styles.cardPressed,
      ]}
    >
      <View style={styles.headerRow}>
        {task.area ? (
          <Badge customColor={task.area.color}>{task.area.name}</Badge>
        ) : (
          <Badge tone="neutral">Sin área</Badge>
        )}
        <View style={styles.priorityRow}>
          <View
            style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]}
          />
        </View>
      </View>

      <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={2}>
        {task.title}
      </Text>

      {task.labels.length > 0 && (
        <View style={styles.labelsRow}>
          {task.labels.slice(0, 3).map((label) => {
            const c = colorForLabel(label);
            return (
              <View
                key={label}
                style={[styles.labelPill, { backgroundColor: c.bg }]}
              >
                <Text style={[styles.labelText, { color: c.fg }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
          })}
          {task.labels.length > 3 && (
            <Text style={styles.labelMore}>+{task.labels.length - 3}</Text>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {due && (
            <View style={styles.dueWrap}>
              {overdue ? (
                <AlertCircle size={12} color={palette.red[600]} strokeWidth={2.2} />
              ) : (
                <Calendar size={12} color={tokens.text.muted} strokeWidth={2} />
              )}
              <Text style={[styles.dueText, overdue && { color: palette.red[600], fontWeight: '600' }]}>
                {due}
              </Text>
            </View>
          )}
          {startTime && (
            <View style={styles.dueWrap}>
              <Clock size={12} color={tokens.text.muted} strokeWidth={2} />
              <Text style={styles.dueText}>{startTime}</Text>
            </View>
          )}
        </View>
        <Text style={styles.statusText}>{STATUS_LABEL[task.status]}</Text>
      </View>

      {task.status === 'in_progress' && (
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${task.progress}%`, backgroundColor: statusColor }]}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    borderLeftWidth: 3,
    ...shadow.soft,
  },
  cardCompact: { padding: spacing[3] },
  cardPressed: { backgroundColor: tokens.bg.subtle },
  cardDone: { opacity: 0.6 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },

  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    marginTop: spacing[2],
    letterSpacing: -0.1,
    lineHeight: 19,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: tokens.text.muted,
  },

  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing[2],
  },
  labelPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    maxWidth: 120,
  },
  labelText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold as '600',
    letterSpacing: 0.1,
  },
  labelMore: {
    fontSize: 10,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  dueText: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  statusText: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  progressTrack: {
    marginTop: spacing[3],
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.bg.subtle,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
});
