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
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import {
  ActivityAction,
  ActivityEntry,
  useRecentActivity,
} from '../../lib/queries/activity';
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

const ACTION_COLOR: Record<ActivityAction, string> = {
  'task.created':        palette.brand[600],
  'task.status_changed': palette.sky[600],
  'task.completed':      palette.emerald[600],
  'subtask.completed':   palette.emerald[600],
  'comment.added':       palette.slate[600],
  'attachment.added':    palette.amber[600],
  'task.assigned':       palette.brand[600],
};

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
  const { data: entries, isLoading, error } = useRecentActivity(userId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Mi actividad" subtitle="Tu historial reciente" fallbackRoute="/" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && (
          <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 32 }} />
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
          const color = ACTION_COLOR[entry.action] ?? palette.slate[600];
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    marginBottom: spacing[2],
  },
  rowPressed: { backgroundColor: tokens.bg.subtle },

  actionBadgeLeading: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  text: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    lineHeight: 19,
  },
  verb: {
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  emphasis: {
    color: tokens.text.secondary,
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
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  error: { color: palette.red[600], fontSize: typography.size.sm, padding: spacing[4] },
});
