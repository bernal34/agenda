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
import {
  Calendar as CalendarIcon,
  CalendarRange,
  List,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Inbox,
  Activity as ActivityIcon,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';

import { signOut } from '../../../lib/auth';

import { MonthCalendar } from '../../../components/calendar/MonthCalendar';
import { WeekView } from '../../../components/calendar/WeekView';
import { TaskCard } from '../../../components/tasks/TaskCard';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  StatCard,
} from '../../../components/ui';
import { useMyAreas } from '../../../lib/queries/areas';
import { useMyTasks, MyTask, TaskStatus } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';
import {
  palette,
  radius,
  shadow,
  spacing,
  tokens,
  typography,
} from '../../../constants/theme';

type ViewMode = 'list' | 'week' | 'calendar';

const STATUS_LABELS: Record<TaskStatus, string> = {
  in_progress: 'En curso',
  todo:        'Por hacer',
  in_review:   'En revisión',
  done:        'Completadas',
};

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'in_review', 'done'];

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo:        palette.slate[500],
  in_progress: palette.amber[500],
  in_review:   palette.sky[500],
  done:        palette.emerald[500],
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function greetingForHour() {
  const h = new Date().getHours();
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
function formatLongDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
function todayHeadline() {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const router = useRouter();

  const tasksQ = useMyTasks(userId);
  const areasQ = useMyAreas(userId);

  const [view, setView] = useState<ViewMode>('list');
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());

  const allTasks = tasksQ.data ?? [];
  const filtered = useMemo(
    () => (areaFilter ? allTasks.filter((t) => t.area?.id === areaFilter) : allTasks),
    [allTasks, areaFilter],
  );

  const today = todayIso();
  const todayCount = allTasks.filter((t) => t.due_date === today && t.status !== 'done').length;
  const overdueCount = allTasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== 'done',
  ).length;
  const doneTodayCount = allTasks.filter(
    (t) => t.status === 'done' && t.due_date === today,
  ).length;

  const grouped: Record<TaskStatus, MyTask[]> = useMemo(() => {
    const g: Record<TaskStatus, MyTask[]> = { in_progress: [], todo: [], in_review: [], done: [] };
    filtered.forEach((t) => g[t.status].push(t));
    return g;
  }, [filtered]);

  const dayTasks = useMemo(
    () => filtered.filter((t) => t.due_date === selectedDay),
    [filtered, selectedDay],
  );

  const displayName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split('@')[0] ??
    'equipo';

  const prevMonth = () =>
    setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const goAdd = (iso: string) => router.push(`/tasks/new?date=${iso}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingForHour()},</Text>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.date}>{todayHeadline()}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onPress={() => router.push('/tasks/new')}
            >
              Nueva
            </Button>
            <Pressable
              onPress={() => signOut()}
              style={styles.logoutBtn}
              accessibilityLabel="Cerrar sesión"
            >
              <LogOut size={18} color={tokens.text.muted as string} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            label="Hoy"
            value={todayCount}
            icon={CalendarIcon}
            accent={palette.brand[600]}
          />
          <StatCard
            label="Vencidas"
            value={overdueCount}
            icon={AlertTriangle}
            accent={palette.red[600]}
          />
          <StatCard
            label="Hechas"
            value={doneTodayCount}
            icon={CheckCircle2}
            accent={palette.emerald[600]}
          />
        </View>

        {/* Activity link */}
        <Pressable
          onPress={() => router.push('/activity' as never)}
          style={({ pressed }) => [styles.activityLink, pressed && styles.activityLinkPressed]}
        >
          <View style={styles.activityIcon}>
            <ActivityIcon size={16} color={palette.brand[600]} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.activityTitle}>Actividad reciente</Text>
            <Text style={styles.activitySubtitle}>Qué pasó en tus áreas</Text>
          </View>
          <ChevronRight size={16} color={tokens.text.muted} strokeWidth={2} />
        </Pressable>

        {/* View toggle */}
        <View style={styles.toggle}>
          <ToggleBtn
            label="Lista"
            icon={List}
            active={view === 'list'}
            onPress={() => setView('list')}
          />
          <ToggleBtn
            label="Semana"
            icon={CalendarRange}
            active={view === 'week'}
            onPress={() => setView('week')}
          />
          <ToggleBtn
            label="Mes"
            icon={CalendarIcon}
            active={view === 'calendar'}
            onPress={() => setView('calendar')}
          />
        </View>

        {/* Area filter */}
        {areasQ.data && areasQ.data.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <Chip
              label="Todas las áreas"
              active={areaFilter === null}
              onPress={() => setAreaFilter(null)}
            />
            {areasQ.data.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={areaFilter === a.id}
                onPress={() => router.push(`/boards/${a.id}` as never)}
                color={a.color}
              />
            ))}
          </ScrollView>
        )}

        {/* States */}
        {tasksQ.isLoading && (
          <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />
        )}
        {tasksQ.error && (
          <Card padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>
              {tasksQ.error instanceof Error ? tasksQ.error.message : 'Error cargando tareas'}
            </Text>
          </Card>
        )}

        {/* Week view */}
        {view === 'week' && tasksQ.data && (
          <WeekView
            weekAnchor={weekAnchor}
            tasks={filtered}
            onPrev={() => setWeekAnchor((d) => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; })}
            onNext={() => setWeekAnchor((d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; })}
            onToday={() => setWeekAnchor(new Date())}
            onTaskPress={(id) => router.push(`/tasks/${id}` as never)}
            onAdd={goAdd}
          />
        )}

        {/* Calendar view */}
        {view === 'calendar' && tasksQ.data && (
          <>
            <MonthCalendar
              monthAnchor={monthAnchor}
              selected={selectedDay}
              tasks={filtered}
              onSelect={setSelectedDay}
              onPrev={prevMonth}
              onNext={nextMonth}
              onAdd={goAdd}
            />

            <View style={styles.daySection}>
              <View style={styles.daySectionHeader}>
                <Text style={styles.daySectionTitle}>{formatLongDate(selectedDay)}</Text>
                <Text style={styles.daySectionCount}>
                  {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                </Text>
              </View>

              {dayTasks.length === 0 ? (
                <Text style={styles.dayEmpty}>Sin tareas en este día.</Text>
              ) : (
                dayTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onPress={() => router.push(`/tasks/${t.id}` as never)}
                  />
                ))
              )}

              <Pressable
                onPress={() => goAdd(selectedDay)}
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              >
                <Plus size={14} color={tokens.brand[600]} strokeWidth={2.2} />
                <Text style={styles.addBtnText}>Agregar tarea</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* List view */}
        {view === 'list' && tasksQ.data && (
          <View style={{ marginTop: spacing[2] }}>
            {STATUS_ORDER.map((status) => {
              const group = grouped[status];
              if (group.length === 0) return null;
              return (
                <View key={status} style={styles.section}>
                  <SectionHeader
                    title={STATUS_LABELS[status]}
                    count={group.length}
                    accent={STATUS_COLOR[status]}
                  />
                  {group.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onPress={() => router.push(`/tasks/${t.id}` as never)}
                    />
                  ))}
                </View>
              );
            })}

            {filtered.length === 0 && allTasks.length > 0 && (
              <EmptyState
                icon={Inbox}
                title="Nada en este filtro"
                description="Probá con otra área o quitá el filtro."
              />
            )}

            {allTasks.length === 0 && !tasksQ.isLoading && (
              <EmptyState
                icon={Inbox}
                title="Sin tareas asignadas"
                description="Cuando te asignen tareas, las vas a ver acá."
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleBtn({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof List;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
    >
      <Icon
        size={14}
        color={active ? tokens.text.primary : tokens.text.muted}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  scroll: { padding: spacing[5], paddingBottom: spacing[10] },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg.surface,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  greeting: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  name: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.6,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  date: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 4,
    textTransform: 'capitalize',
    fontWeight: typography.weight.medium as '500',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },

  // Activity link
  activityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    marginBottom: spacing[4],
    ...shadow.soft,
  },
  activityLinkPressed: { backgroundColor: tokens.bg.subtle },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: palette.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  activitySubtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: tokens.bg.subtle,
    padding: 3,
    borderRadius: radius.lg,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  toggleBtnActive: { backgroundColor: tokens.bg.surface, ...shadow.soft },
  toggleText: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
  },
  toggleTextActive: { color: tokens.text.primary },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[4],
    paddingRight: spacing[2],
  },

  // Section
  section: { marginBottom: spacing[2] },

  // Calendar day section
  daySection: { marginTop: spacing[5] },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  daySectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.2,
  },
  daySectionCount: { fontSize: typography.size.xs, color: tokens.text.muted },
  dayEmpty: {
    color: tokens.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    backgroundColor: tokens.bg.surface,
  },
  addBtnPressed: { backgroundColor: palette.brand[50], borderColor: palette.brand[300] },
  addBtnText: {
    color: tokens.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },

  // Errors / empty
  errorCard: { marginTop: spacing[3], borderColor: palette.red[200], backgroundColor: palette.red[50] },
  errorText: { color: palette.red[700], fontSize: typography.size.sm },
});
