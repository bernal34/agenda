import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  Calendar as CalendarIcon,
  CalendarRange,
  List,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Inbox,
  CalendarOff,
  Activity as ActivityIcon,
  ChevronRight,
  LogOut,
  UserCheck,
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
  SkeletonList,
} from '../../../components/ui';
import { useMyAreas } from '../../../lib/queries/areas';
import { useMyTasks, MyTask, TaskStatus } from '../../../lib/queries/tasks';
import {
  countDoneToday,
  countDueToday,
  countOverdue,
  groupByStatus,
} from '../../../lib/taskStats';
import { useAuthStore } from '../../../stores/authStore';
import {
  palette,
  radius,
  spacing,
  typography,
  type Tokens,
} from '../../../constants/theme';
import { useTheme, useThemedStyles } from '../../../lib/theme';

type ViewMode = 'list' | 'week' | 'calendar';

const STATUS_LABELS: Record<TaskStatus, string> = {
  in_progress: 'En curso',
  todo:        'Por hacer',
  in_review:   'En revisión',
  done:        'Completadas',
};

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'in_review', 'done'];

/** El color sale del tema en render, no de un const de módulo. */
const STATUS_KEY: Record<TaskStatus, keyof Tokens['status']> = {
  todo:        'todo',
  in_progress: 'progress',
  in_review:   'review',
  done:        'done',
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
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();

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
    () => (areaFilter ? allTasks.filter((t2) => t2.area?.id === areaFilter) : allTasks),
    [allTasks, areaFilter],
  );

  const today = todayIso();
  const todayCount = countDueToday(allTasks, today);
  const overdueCount = countOverdue(allTasks, today);
  const doneTodayCount = countDoneToday(allTasks, today);

  const grouped: Record<TaskStatus, MyTask[]> = useMemo(
    () => groupByStatus(filtered, STATUS_ORDER),
    [filtered],
  );

  const dayTasks = useMemo(
    () => filtered.filter((t2) => t2.due_date === selectedDay),
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
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.heroSafe} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: saludo, fecha y el pulso del día, sobre la banda de marca */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.greeting}>{greetingForHour()},</Text>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.date}>{todayHeadline()}</Text>
            </View>
            <Pressable
              onPress={() => signOut()}
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
              accessibilityLabel="Cerrar sesión"
            >
              <LogOut size={18} color={palette.white} strokeWidth={1.8} />
            </Pressable>
          </View>

          <View style={styles.heroStats}>
            <HeroStat label="Hoy" value={todayCount} icon={CalendarIcon} styles={styles} />
            <View style={styles.heroDivider} />
            <HeroStat
              label="Vencidas"
              value={overdueCount}
              icon={AlertTriangle}
              alert={overdueCount > 0}
              styles={styles}
            />
            <View style={styles.heroDivider} />
            <HeroStat label="Hechas" value={doneTodayCount} icon={CheckCircle2} styles={styles} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Accesos */}
          <View style={styles.linksRow}>
            <QuickLink
              icon={ActivityIcon}
              title="Mi actividad"
              subtitle="Tu historial"
              onPress={() => router.push('/activity' as never)}
              styles={styles}
              t={t}
            />
            <QuickLink
              icon={UserCheck}
              title="Delegadas"
              subtitle="Las que asignaste"
              onPress={() => router.push('/delegated' as never)}
              styles={styles}
              t={t}
            />
          </View>

          {/* View toggle */}
          <View style={styles.toggle}>
            <ToggleBtn
              label="Lista"
              icon={List}
              active={view === 'list'}
              onPress={() => setView('list')}
              styles={styles}
              t={t}
            />
            <ToggleBtn
              label="Semana"
              icon={CalendarRange}
              active={view === 'week'}
              onPress={() => setView('week')}
              styles={styles}
              t={t}
            />
            <ToggleBtn
              label="Mes"
              icon={CalendarIcon}
              active={view === 'calendar'}
              onPress={() => setView('calendar')}
              styles={styles}
              t={t}
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
          {tasksQ.isLoading && <SkeletonList count={3} />}
          {tasksQ.error && (
            <Card padding="md" style={styles.errorCard}>
              <Text style={styles.errorText}>
                {tasksQ.error instanceof Error ? tasksQ.error.message : 'Error cargando tareas'}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => tasksQ.refetch()}
                style={{ marginTop: spacing[3], alignSelf: 'flex-start' }}
              >
                Reintentar
              </Button>
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
                  <EmptyState
                    icon={CalendarOff}
                    title="Día libre"
                    description="No hay tareas con fecha en este día."
                  />
                ) : (
                  dayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onPress={() => router.push(`/tasks/${task.id}` as never)}
                    />
                  ))
                )}

                <Pressable
                  onPress={() => goAdd(selectedDay)}
                  style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
                >
                  <Plus size={14} color={t.brand[600]} strokeWidth={2.2} />
                  <Text style={styles.addBtnText}>Agregar tarea</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* List view */}
          {view === 'list' && tasksQ.data && (
            <View>
              {STATUS_ORDER.map((status) => {
                const group = grouped[status];
                if (group.length === 0) return null;
                return (
                  <View key={status} style={styles.section}>
                    <SectionHeader
                      title={STATUS_LABELS[status]}
                      count={group.length}
                      accent={t.status[STATUS_KEY[status]]}
                    />
                    {group.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onPress={() => router.push(`/tasks/${task.id}` as never)}
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
        </View>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function HeroStat({
  label,
  value,
  icon: Icon,
  alert,
  styles,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  alert?: boolean;
  styles: Styles;
}) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatTop}>
        <Icon size={13} color={alert ? palette.amber[200] : palette.brand[200]} strokeWidth={2.2} />
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
      <Text style={[styles.heroStatValue, alert && { color: palette.amber[200] }]}>{value}</Text>
    </View>
  );
}

function QuickLink({
  icon: Icon,
  title,
  subtitle,
  onPress,
  styles,
  t,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  styles: Styles;
  t: Tokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
    >
      <View style={styles.quickIcon}>
        <Icon size={15} color={t.brand[600]} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.quickTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.quickSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <ChevronRight size={14} color={t.text.muted} strokeWidth={2} />
    </Pressable>
  );
}

function ToggleBtn({
  label,
  icon: Icon,
  active,
  onPress,
  styles,
  t,
}: {
  label: string;
  icon: typeof List;
  active: boolean;
  onPress: () => void;
  styles: Styles;
  t: Tokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleBtn,
        active && styles.toggleBtnActive,
        pressed && !active && styles.toggleBtnPressed,
      ]}
    >
      <Icon
        size={14}
        color={active ? t.text.primary : t.text.muted}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },
  // El hero es superficie de marca, no de tema: el púrpura se mantiene en los
  // dos esquemas y el texto de arriba siempre va en claro.
  heroSafe: { backgroundColor: palette.brand[600] },
  scroll: { paddingBottom: spacing[10] },

  // Hero
  hero: {
    backgroundColor: palette.brand[600],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  greeting: {
    fontSize: typography.size.sm,
    color: palette.brand[200],
    fontWeight: typography.weight.medium as '500',
  },
  name: {
    fontSize: typography.size['4xl'],
    fontWeight: typography.weight.bold as '700',
    color: palette.white,
    letterSpacing: -0.8,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  date: {
    fontSize: typography.size.sm,
    color: palette.brand[200],
    marginTop: spacing[1],
    textTransform: 'capitalize',
    fontWeight: typography.weight.medium as '500',
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand[700],
  },
  logoutBtnPressed: { backgroundColor: palette.brand[800] },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.brand[700],
    borderRadius: radius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    marginTop: spacing[5],
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  heroStatLabel: {
    fontSize: typography.size.xs,
    color: palette.brand[200],
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroStatValue: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold as '700',
    color: palette.white,
    letterSpacing: -0.5,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: palette.brand[600],
  },

  // Body
  body: { paddingHorizontal: spacing[5], paddingTop: spacing[5] },

  // Accesos rápidos
  linksRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: t.bg.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  quickLinkPressed: { backgroundColor: t.bg.subtle },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: t.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
  },
  quickSubtitle: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    marginTop: 1,
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: t.bg.subtle,
    padding: spacing[1],
    borderRadius: radius.xl,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: t.border.subtle,
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
  toggleBtnActive: { backgroundColor: t.bg.surface },
  toggleBtnPressed: { backgroundColor: t.bg.muted },
  toggleText: {
    fontSize: typography.size.sm,
    color: t.text.muted,
    fontWeight: typography.weight.semibold as '600',
  },
  toggleTextActive: { color: t.text.primary },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[4],
    paddingRight: spacing[2],
  },

  // Section
  section: { marginBottom: spacing[4] },

  // Calendar day section
  daySection: { marginTop: spacing[5] },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  daySectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.2,
  },
  daySectionCount: { fontSize: typography.size.xs, color: t.text.muted },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    backgroundColor: t.bg.surface,
  },
  addBtnPressed: { backgroundColor: t.brand[50], borderColor: t.border.focus },
  addBtnText: {
    color: t.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },

  // Errors
  errorCard: {
    backgroundColor: t.feedback.errorBg,
    borderColor: t.border.default,
  },
  errorText: { color: t.feedback.errorFg, fontSize: typography.size.sm },
});
