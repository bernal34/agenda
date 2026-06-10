import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';
import { buildMonthCells, sameDay } from '../../lib/calendarGrid';
import { MyTask, TaskStatus } from '../../lib/queries/tasks';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo:        palette.slate[500],
  in_progress: palette.amber[500],
  in_review:   palette.sky[500],
  done:        palette.emerald[500],
};

interface Props {
  monthAnchor: Date;
  selected: string | null;
  tasks: MyTask[];
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onAdd: (iso: string) => void;
}

export function MonthCalendar({
  monthAnchor,
  selected,
  tasks,
  onSelect,
  onPrev,
  onNext,
  onAdd,
}: Props) {
  const today = new Date();
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();

  const monthLabel = monthAnchor.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.navBtn}>
          <ChevronLeft size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.navBtn}>
          <ChevronRight size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.date || !cell.iso) {
            return <View key={`empty-${idx}`} style={styles.dayCell} />;
          }
          const dayTasks = tasksByDate.get(cell.iso) ?? [];
          const isToday = sameDay(cell.date, today);
          const isSelected = selected === cell.iso;
          return (
            <Pressable
              key={cell.iso}
              onPress={() => (isSelected ? onAdd(cell.iso!) : onSelect(cell.iso!))}
              onLongPress={() => onAdd(cell.iso!)}
              style={[
                styles.dayCell,
                isToday && !isSelected && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  isSelected && styles.dayNumSelected,
                  isToday && !isSelected && styles.dayNumToday,
                ]}
              >
                {cell.date.getDate()}
              </Text>
              {dayTasks.length > 0 && (
                <View style={styles.titleList}>
                  {dayTasks.slice(0, 3).map((t) => {
                    const tone = STATUS_COLOR[t.status];
                    return (
                      <View
                        key={t.id}
                        style={[
                          styles.taskPill,
                          isSelected
                            ? { backgroundColor: 'rgba(255,255,255,0.18)' }
                            : { backgroundColor: tone + '15' },
                          { borderLeftColor: isSelected ? '#fff' : tone },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.taskPillText,
                            { color: isSelected ? '#fff' : tone },
                          ]}
                        >
                          {t.title}
                        </Text>
                      </View>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <Text
                      style={[
                        styles.more,
                        isSelected && { color: 'rgba(255,255,255,0.85)' },
                      ]}
                    >
                      +{dayTasks.length - 3}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
    paddingBottom: spacing[2],
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
  monthLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
  },

  weekdays: { flexDirection: 'row', paddingBottom: spacing[1] },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 110,
    paddingTop: 4,
    paddingHorizontal: 2,
    paddingBottom: 4,
    borderRadius: radius.sm,
  },
  dayToday: { backgroundColor: palette.brand[50] },
  daySelected: { backgroundColor: palette.brand[600] },
  dayNum: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    fontWeight: typography.weight.semibold as '600',
    textAlign: 'center',
    marginBottom: 3,
  },
  dayNumToday: { color: palette.brand[700], fontWeight: typography.weight.bold as '700' },
  dayNumSelected: { color: tokens.brand.fg, fontWeight: typography.weight.bold as '700' },

  titleList: { gap: 2 },
  taskPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderLeftWidth: 2,
  },
  taskPillText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold as '600',
  },
  more: {
    fontSize: 9,
    color: tokens.text.muted,
    textAlign: 'center',
    marginTop: 1,
    fontWeight: typography.weight.semibold as '600',
  },
});
