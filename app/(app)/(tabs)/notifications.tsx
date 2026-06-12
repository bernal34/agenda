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
import {
  Bell,
  CheckCheck,
  Clock,
  MessageSquare,
  AtSign,
  ListChecks,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Card, EmptyState, SectionHeader } from '../../../components/ui';
import {
  AppNotification,
  NotificationKind,
  useMarkAllRead,
  useMarkManyRead,
  useMarkRead,
  useMyNotifications,
} from '../../../lib/queries/notifications';
import { useAuthStore } from '../../../stores/authStore';
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  task_assigned:    ListChecks,
  task_due:         Clock,
  task_start_soon:  Clock,
  mention:          AtSign,
  comment:          MessageSquare,
};

const KIND_COLOR: Record<NotificationKind, string> = {
  task_assigned:    palette.brand[600],
  task_due:         palette.amber[600],
  task_start_soon:  palette.emerald[600],
  mention:          palette.sky[600],
  comment:          palette.slate[600],
};

const KIND_TITLE: Record<NotificationKind, string> = {
  task_assigned:    'Nueva tarea asignada',
  task_due:         'Tarea próxima a vencer',
  task_start_soon:  'Tarea próxima a comenzar',
  mention:          'Te mencionaron',
  comment:          'Nuevo comentario',
};

function relTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  return `hace ${d} d`;
}

function notifLink(n: AppNotification): string | null {
  const taskId = (n.payload as { task_id?: string })?.task_id;
  if (taskId) return `/tasks/${taskId}`;
  return null;
}

interface NotifGroup {
  key: string;
  taskId: string | null;
  taskTitle: string | null;
  items: AppNotification[];
  unreadIds: string[];
  lastAt: string;
}

function groupByTask(items: AppNotification[]): NotifGroup[] {
  const map = new Map<string, NotifGroup>();
  items.forEach((n) => {
    const taskId = (n.payload as { task_id?: string })?.task_id ?? null;
    const taskTitle = (n.payload as { task_title?: string })?.task_title ?? null;
    const key = taskId ?? `n:${n.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(n);
      if (!n.read_at) existing.unreadIds.push(n.id);
      if (n.created_at > existing.lastAt) existing.lastAt = n.created_at;
    } else {
      map.set(key, {
        key,
        taskId,
        taskTitle,
        items: [n],
        unreadIds: n.read_at ? [] : [n.id],
        lastAt: n.created_at,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export default function NotificationsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const { data, isLoading, error } = useMyNotifications(userId);
  const markMut = useMarkRead();
  const markAllMut = useMarkAllRead();
  const markManyMut = useMarkManyRead();

  const { nuevas, anteriores } = useMemo(() => {
    const items = data ?? [];
    return {
      nuevas: items.filter((n) => !n.read_at),
      anteriores: items.filter((n) => n.read_at),
    };
  }, [data]);

  const groupedNuevas = useMemo(() => groupByTask(nuevas), [nuevas]);

  const handlePress = (n: AppNotification) => {
    if (!n.read_at) markMut.mutate(n.id);
    const link = notifLink(n);
    if (link) router.push(link as never);
  };

  const handleGroupOpen = (g: NotifGroup) => {
    if (g.unreadIds.length > 0) markManyMut.mutate(g.unreadIds);
    if (g.taskId) router.push(`/tasks/${g.taskId}` as never);
  };

  const handleGroupMarkRead = (g: NotifGroup, e?: any) => {
    e?.stopPropagation?.();
    if (g.unreadIds.length === 0) return;
    markManyMut.mutate(g.unreadIds);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>
            {nuevas.length > 0 ? `${nuevas.length} sin leer` : 'Todo al día'}
          </Text>
        </View>
        {nuevas.length > 0 && userId && (
          <Pressable
            onPress={() => markAllMut.mutate(userId)}
            hitSlop={8}
            style={({ pressed }) => [styles.markAllBtn, pressed && styles.markAllPressed]}
          >
            <CheckCheck size={14} color={tokens.brand[600]} strokeWidth={2.2} />
            <Text style={styles.markAllText}>Marcar todas</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {error && (
          <Card style={styles.errorCard} padding="md">
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando notificaciones'}
            </Text>
          </Card>
        )}

        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Cuando algo cambie en tus tareas o canales lo vas a ver acá."
          />
        )}

        {groupedNuevas.length > 0 && (
          <>
            <SectionHeader title="Bandeja" count={nuevas.length} accent={palette.brand[500]} />
            {groupedNuevas.map((g) => (
              <NotifGroupCard
                key={g.key}
                group={g}
                onOpen={() => handleGroupOpen(g)}
                onMarkRead={(e) => handleGroupMarkRead(g, e)}
              />
            ))}
          </>
        )}

        {anteriores.length > 0 && (
          <>
            <SectionHeader
              title="Anteriores"
              count={anteriores.length}
              accent={palette.slate[300]}
            />
            {anteriores.map((n) => (
              <NotifRow key={n.id} notif={n} onPress={() => handlePress(n)} unread={false} />
            ))}
          </>
        )}

        {data && data.length > 0 && <View style={{ height: spacing[8] }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifGroupCard({
  group,
  onOpen,
  onMarkRead,
}: {
  group: NotifGroup;
  onOpen: () => void;
  onMarkRead: (e: any) => void;
}) {
  const lastKind = group.items[0]?.kind;
  const color = lastKind ? KIND_COLOR[lastKind] : palette.brand[500];
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        styles.rowUnread,
        pressed && styles.rowPressed,
        { borderLeftWidth: 3, borderLeftColor: color },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {group.taskTitle ?? 'Sin tarea'}
          </Text>
          <Text style={styles.rowTime}>{relTime(group.lastAt)}</Text>
        </View>
        <View style={styles.kindRow}>
          {summarizeKinds(group.items).map((k) => {
            const Ic = KIND_ICON[k.kind];
            return (
              <View key={k.kind} style={[styles.kindChip, { borderColor: KIND_COLOR[k.kind] + '55' }]}>
                <Ic size={11} color={KIND_COLOR[k.kind]} strokeWidth={2.2} />
                <Text style={[styles.kindChipText, { color: KIND_COLOR[k.kind] }]}>
                  {KIND_TITLE[k.kind]}{k.count > 1 ? ` ·${k.count}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
        {group.items[0]?.payload && (
          <Text style={styles.rowPreview} numberOfLines={2}>
            {(group.items[0].payload as { preview?: string }).preview ?? ''}
          </Text>
        )}
      </View>
      {group.unreadIds.length > 0 && (
        <Pressable onPress={onMarkRead} hitSlop={6} style={styles.markGroupBtn}>
          <CheckCheck size={12} color={tokens.brand[600]} strokeWidth={2.2} />
        </Pressable>
      )}
    </Pressable>
  );
}

function summarizeKinds(items: AppNotification[]) {
  const m = new Map<NotificationKind, number>();
  items.forEach((n) => m.set(n.kind, (m.get(n.kind) ?? 0) + 1));
  return Array.from(m.entries()).map(([kind, count]) => ({ kind, count }));
}

function NotifRow({
  notif,
  onPress,
  unread,
}: {
  notif: AppNotification;
  onPress: () => void;
  unread: boolean;
}) {
  const taskTitle = (notif.payload as { task_title?: string }).task_title;
  const preview = (notif.payload as { preview?: string }).preview;
  const Icon = KIND_ICON[notif.kind];
  const color = KIND_COLOR[notif.kind];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '1A' }]}>
        <Icon size={16} color={color} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {KIND_TITLE[notif.kind]}
          </Text>
          <Text style={styles.rowTime}>{relTime(notif.created_at)}</Text>
        </View>
        {taskTitle && (
          <Text style={styles.rowBody} numberOfLines={1}>
            {taskTitle}
          </Text>
        )}
        {preview && (
          <Text style={styles.rowPreview} numberOfLines={2}>
            "{preview}"
          </Text>
        )}
      </View>
      {unread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    marginTop: spacing[1],
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[100],
  },
  markAllPressed: { backgroundColor: palette.brand[100] },
  markAllText: {
    color: tokens.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },

  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[6] },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    gap: spacing[3],
  },
  rowUnread: {
    backgroundColor: palette.brand[50] + '80',
    borderColor: palette.brand[100],
  },
  rowPressed: { backgroundColor: tokens.bg.subtle },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  rowTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    flex: 1,
  },
  rowTime: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  rowBody: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  rowPreview: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.brand[500],
    marginTop: 8,
  },

  errorCard: { borderColor: palette.red[200], backgroundColor: palette.red[50] },
  errorText: { color: palette.red[700], fontSize: typography.size.sm },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kindChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
  },
  kindChipText: {
    fontSize: typography.size['2xs'],
    fontWeight: typography.weight.semibold as '600',
  },
  markGroupBtn: {
    padding: 6, borderRadius: radius.md,
    backgroundColor: palette.brand[50], borderWidth: 1, borderColor: palette.brand[200],
    alignSelf: 'center',
  },
});
