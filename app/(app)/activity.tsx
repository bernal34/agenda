import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Activity as ActivityIcon,
  CheckCircle2,
  CircleDot,
  MessageSquare,
  Paperclip,
  Plus,
  UserPlus,
  ListChecks,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Badge, EmptyState, ScreenHeader } from '../../components/ui';
import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import {
  ActivityAction,
  ActivityEntry,
  useRecentActivity,
} from '../../lib/queries/activity';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';

const ACTION_ICON: Record<ActivityAction, LucideIcon> = {
  'task.created':         Plus,
  'task.status_changed':  CircleDot,
  'task.completed':       CheckCircle2,
  'subtask.completed':    ListChecks,
  'comment.added':        MessageSquare,
  'attachment.added':     Paperclip,
  'task.assigned':        UserPlus,
};

/**
 * El color sale del tema en render, no de un const de módulo: los tonos 600
 * de la paleta quedaban apagados sobre fondo oscuro.
 */
function actionColor(t: Tokens, action: ActivityAction): string {
  switch (action) {
    case 'task.created':        return t.brand[600];
    case 'task.assigned':       return t.brand[600];
    case 'task.status_changed': return t.status.review;
    case 'task.completed':      return t.status.done;
    case 'subtask.completed':   return t.status.done;
    case 'attachment.added':    return t.feedback.warningFg;
    case 'comment.added':       return t.text.secondary;
    default:                    return t.text.secondary;
  }
}

function relTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  return `hace ${w} sem`;
}

// La query ya filtra por user_id = auth.uid(), así que todo lo que llega acá
// lo hizo el propio usuario → segunda persona, sin actor.
function describe(entry: ActivityEntry): { verb: string; emphasis?: string } {
  const taskTitle = entry.task?.title;
  const p = entry.payload as any;

  switch (entry.action) {
    case 'task.created':
      return { verb: 'Creaste la tarea', emphasis: taskTitle ?? p.title };
    case 'task.completed':
      return { verb: 'Completaste', emphasis: taskTitle ?? p.title };
    case 'task.status_changed':
      return { verb: `Moviste a ${p.to}`, emphasis: taskTitle ?? p.title };
    case 'subtask.completed':
      return { verb: 'Terminaste la subtarea', emphasis: p.title };
    case 'comment.added':
      return { verb: 'Comentaste:', emphasis: p.preview ? `"${p.preview}"` : taskTitle ?? undefined };
    case 'attachment.added':
      return { verb: 'Adjuntaste', emphasis: p.filename };
    case 'task.assigned':
      return { verb: 'Asignaste la tarea', emphasis: taskTitle ?? undefined };
    default:
      return { verb: entry.action };
  }
}

export default function ActivityScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const { data: entries, isLoading, error } = useRecentActivity(userId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Mi actividad" subtitle="Tu historial reciente" fallbackRoute="/" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <ActivityIndicator color={t.brand[600]} style={{ marginTop: 32 }} />
        )}

        {error && (
          <Text style={styles.error}>
            {error instanceof Error ? error.message : 'Error cargando actividad'}
          </Text>
        )}

        {!isLoading && (entries?.length ?? 0) === 0 && (
          <EmptyState
            icon={ActivityIcon}
            title="Sin actividad reciente"
            description="Cuando crees, comentes o completes tareas, lo vas a ver acá."
          />
        )}

        {entries?.map((entry) => {
          const Icon = ACTION_ICON[entry.action] ?? CircleDot;
          const color = actionColor(t, entry.action);
          const { verb, emphasis } = describe(entry);
          const goToTask = entry.task_id
            ? () => router.push(`/tasks/${entry.task_id}` as never)
            : undefined;

          return (
            <Pressable
              key={entry.id}
              onPress={goToTask}
              disabled={!goToTask}
              style={({ pressed }) => [styles.row, pressed && goToTask && styles.rowPressed]}
            >
              {/* Action icon — sustituye al avatar redundante del propio user */}
              <View style={[styles.actionBadgeLeading, { backgroundColor: color + '1A' }]}>
                <Icon size={14} color={color} strokeWidth={2.2} />
              </View>

              {/* Body */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.text} numberOfLines={3}>
                  <Text style={styles.verb}>{verb}</Text>
                  {emphasis && <Text style={styles.emphasis}> {emphasis}</Text>}
                </Text>
                <View style={styles.meta}>
                  {entry.task?.area && (
                    <Badge customColor={entry.task.area.color}>{entry.task.area.name}</Badge>
                  )}
                  <Text style={styles.time}>{relTime(entry.created_at)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },
  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: t.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border.subtle,
    marginBottom: spacing[2],
  },
  rowPressed: { backgroundColor: t.bg.subtle },

  actionBadgeLeading: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  text: {
    fontSize: typography.size.sm,
    color: t.text.primary,
    lineHeight: 19,
  },
  verb: {
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
  },
  emphasis: {
    color: t.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
    flexWrap: 'wrap',
  },
  time: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  error: { color: t.feedback.errorFg, fontSize: typography.size.sm, padding: spacing[4] },
});
