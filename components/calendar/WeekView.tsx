import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

import { radius, shadow, spacing, typography, type Tokens } from '../../constants/theme';
import { indexByDay, sameDay as sameIso, startOfWeek, toIso } from '../../lib/calendarGrid';
import { statusColor } from '../../lib/statusColor';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { MyTask } from '../../lib/queries/tasks';

const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Props {
  weekAnchor: Date;
  tasks: MyTask[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onTaskPress: (id: string) => void;
  onAdd: (iso: string) => void;
}

export function WeekView({
  weekAnchor,
  tasks,
  onPrev,
  onNext,
  onToday,
  onTaskPress,
  onAdd,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const today = new Date();
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Cada tarea ocupa todos los días de su rango, así que el lunes muestra lo
  // que está en curso el lunes y no solo lo que vence ese día.
  const byDay = useMemo(() => indexByDay(tasks), [tasks]);

  const weekEnd = days[6];
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeLabel = sameMonth
    ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-AR', { month: 'long' })}`
    : `${weekStart.getDate()} ${weekStart.toLocaleDateString('es-AR', { month: 'short' })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-AR', { month: 'short' })}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.navBtn}>
          <ChevronLeft size={18} color={t.text.secondary} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={onToday} style={styles.todayBtn}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.navBtn}>
          <ChevronRight size={18} color={t.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {days.map((d, idx) => {
          const iso = toIso(d);
          const isToday = sameIso(d, today);
          const isWeekend = idx >= 5;
          // Lo que vence ese día va primero: es lo que hay que mirar.
          const dayEntries = [...(byDay.get(iso) ?? [])].sort(
            (a, b) => Number(b.isEnd) - Number(a.isEnd),
          );
          return (
            <View
              key={iso}
              style={[
                styles.dayBlock,
                isToday && styles.dayBlockToday,
                isWeekend && !isToday && styles.dayBlockWeekend,
              ]}
            >
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                    {WEEKDAYS_SHORT[idx]}
                  </Text>
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                    {d.getDate()}
                  </Text>
                  {isToday && <View style={styles.todayDot} />}
                </View>
                <Pressable
                  onPress={() => onAdd(iso)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.addInline, pressed && styles.addInlinePressed]}
                >
                  <Plus size={12} color={t.brand[600]} strokeWidth={2.4} />
                </Pressable>
              </View>

              {dayEntries.length === 0 ? (
                <Text style={styles.empty}>—</Text>
              ) : (
                dayEntries.map(({ task, isEnd, spans }) => {
                  const tone = statusColor(t, task.status);
                  // Un día intermedio de un rango se atenúa para que cinco días
                  // de la misma tarea no se lean como cinco tareas distintas.
                  const ongoing = spans && !isEnd;
                  return (
                    <Pressable
                      key={`${iso}-${task.id}`}
                      onPress={() => onTaskPress(task.id)}
                      style={({ pressed }) => [
                        styles.taskRow,
                        { borderLeftColor: tone },
                        ongoing && styles.taskRowOngoing,
                        pressed && styles.taskRowPressed,
                      ]}
                    >
                      {task.area && (
                        <View style={[styles.areaDot, { backgroundColor: task.area.color }]} />
                      )}
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
                      {spans && isEnd && (
                        <View style={[styles.dueTag, { borderColor: tone }]}>
                          <Text style={[styles.dueTagText, { color: tone }]}>vence</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: {
    backgroundColor: t.bg.surface,
    borderRadius: radius.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: t.border.subtle,
    ...shadow.soft,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
    marginBottom: spacing[2],
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  todayBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  todayText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.secondary,
  },
  rangeLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
    textAlign: 'center',
  },

  dayBlock: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[1],
  },
  dayBlockToday: { backgroundColor: t.brand[50] },
  dayBlockWeekend: { backgroundColor: t.bg.subtle },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dayName: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dayNameToday: { color: t.brand[600] },
  dayNum: {
    fontSize: typography.size.lg,
    color: t.text.primary,
    fontWeight: typography.weight.bold as '700',
    letterSpacing: -0.3,
  },
  dayNumToday: { color: t.brand[600] },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.brand[600],
    alignSelf: 'center',
  },

  addInline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.brand[100],
    borderStyle: 'dashed',
  },
  addInlinePressed: { backgroundColor: t.brand[50] },

  empty: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    paddingVertical: 4,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: t.bg.surface,
    borderWidth: 1,
    borderColor: t.border.subtle,
    borderLeftWidth: 3,
    marginBottom: 4,
  },
  taskRowOngoing: { opacity: 0.7 },
  taskRowPressed: { backgroundColor: t.bg.subtle },
  areaDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    color: t.text.primary,
    fontWeight: typography.weight.medium as '500',
    letterSpacing: -0.1,
  },
  dueTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  dueTagText: {
    fontSize: typography.size['2xs'],
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
