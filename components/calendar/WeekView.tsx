import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';
import { MyTask } from '../../lib/queries/tasks';

const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function sameIso(a: Date, b: Date) { return toIso(a) === toIso(b); }
function startOfWeek(d: Date) {
  // Lunes = primer día
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

interface Props {
  weekAnchor: Date;
  tasks: MyTask[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onTaskPress: (id: string) => void;
  onAdd: (iso: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  todo:        palette.slate[500],
  in_progress: palette.amber[500],
  in_review:   palette.sky[500],
  done:        palette.emerald[500],
};

export function WeekView({
  weekAnchor,
  tasks,
  onPrev,
  onNext,
  onToday,
  onTaskPress,
  onAdd,
}: Props) {
  const today = new Date();
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const tasksByDate = useMemo(() => {
    const m = new Map<string, MyTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const list = m.get(t.due_date) ?? [];
      list.push(t);
      m.set(t.due_date, list);
    });
    return m;
  }, [tasks]);

  const weekEnd = days[6];
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeLabel = sameMonth
    ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-AR', { month: 'long' })}`
    : `${weekStart.getDate()} ${weekStart.toLocaleDateString('es-AR', { month: 'short' })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-AR', { month: 'short' })}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.navBtn}>
          <ChevronLeft size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={onToday} style={styles.todayBtn}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.navBtn}>
          <ChevronRight size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {days.map((d, idx) => {
          const iso = toIso(d);
          const isToday = sameIso(d, today);
          const isWeekend = idx >= 5;
          const dayTasks = tasksByDate.get(iso) ?? [];
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
                  {isToday && (
                    <View style={styles.todayDot} />
                  )}
                </View>
                <Pressable
                  onPress={() => onAdd(iso)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.addInline, pressed && styles.addInlinePressed]}
                >
                  <Plus size={12} color={tokens.brand[600]} strokeWidth={2.4} />
                </Pressable>
              </View>

              {dayTasks.length === 0 ? (
                <Text style={styles.empty}>—</Text>
              ) : (
                dayTasks.map((t) => {
                  const tone = STATUS_COLOR[t.status] ?? palette.slate[500];
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => onTaskPress(t.id)}
                      style={({ pressed }) => [
                        styles.taskRow,
                        { borderLeftColor: tone },
                        pressed && styles.taskRowPressed,
                      ]}
                    >
                      {t.area && (
                        <View style={[styles.areaDot, { backgroundColor: t.area.color }]} />
                      )}
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {t.title}
                      </Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    ...shadow.soft,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
    marginBottom: spacing[2],
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  todayBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  todayText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.secondary,
  },
  rangeLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
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
  dayBlockToday: { backgroundColor: palette.brand[50] },
  dayBlockWeekend: { backgroundColor: tokens.bg.subtle, opacity: 0.85 },

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
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dayNameToday: { color: palette.brand[700] },
  dayNum: {
    fontSize: typography.size.lg,
    color: tokens.text.primary,
    fontWeight: typography.weight.bold as '700',
    letterSpacing: -0.3,
  },
  dayNumToday: { color: palette.brand[700] },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.brand[600],
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
    borderColor: palette.brand[200],
    borderStyle: 'dashed',
  },
  addInlinePressed: { backgroundColor: palette.brand[100] },

  empty: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    paddingVertical: 4,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    backgroundColor: tokens.bg.surface,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    borderLeftWidth: 3,
    marginBottom: 4,
  },
  taskRowPressed: { backgroundColor: tokens.bg.subtle },
  areaDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    fontWeight: typography.weight.medium as '500',
    letterSpacing: -0.1,
  },
});
