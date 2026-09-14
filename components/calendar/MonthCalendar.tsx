import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { radius, shadow, spacing, typography, type Tokens } from '../../constants/theme';
import { buildMonthCells, indexByDay, sameDay } from '../../lib/calendarGrid';
import { statusColor, statusTint } from '../../lib/statusColor';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { MyTask } from '../../lib/queries/tasks';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

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
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const today = new Date();
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();

  const monthLabel = monthAnchor.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  // Rango completo: una tarea del 14 al 18 pinta los cinco días.
  const byDay = useMemo(() => indexByDay(tasks), [tasks]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.navBtn}>
          <ChevronLeft size={18} color={t.text.secondary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.navBtn}>
          <ChevronRight size={18} color={t.text.secondary} strokeWidth={2} />
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
          const dayEntries = [...(byDay.get(cell.iso) ?? [])].sort(
            (a, b) => Number(b.isEnd) - Number(a.isEnd),
          );
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
              {dayEntries.length > 0 && (
                <View style={styles.titleList}>
                  {dayEntries.slice(0, 3).map(({ task, isEnd, spans }) => {
                    const tone = statusColor(t, task.status);
                    const ongoing = spans && !isEnd;
                    return (
                      <View
                        key={`${cell.iso}-${task.id}`}
                        style={[
                          styles.taskPill,
                          isSelected
                            ? { backgroundColor: 'rgba(255,255,255,0.18)' }
                            : { backgroundColor: statusTint(t, task.status) },
                          { borderLeftColor: isSelected ? '#fff' : tone },
                          ongoing && styles.taskPillOngoing,
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.taskPillText,
                            { color: isSelected ? '#fff' : tone },
                          ]}
                        >
                          {task.title}
                        </Text>
                      </View>
                    );
                  })}
                  {dayEntries.length > 3 && (
                    <Text
                      style={[
                        styles.more,
                        isSelected && { color: 'rgba(255,255,255,0.85)' },
                      ]}
                    >
                      +{dayEntries.length - 3}
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
    borderColor: t.border.subtle,
  },
  monthLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
  },

  weekdays: { flexDirection: 'row', paddingBottom: spacing[1] },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size['2xs'],
    color: t.text.muted,
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
  dayToday: { backgroundColor: t.brand[50] },
  daySelected: { backgroundColor: t.brand[600] },
  dayNum: {
    fontSize: typography.size.sm,
    color: t.text.primary,
    fontWeight: typography.weight.semibold as '600',
    textAlign: 'center',
    marginBottom: 3,
  },
  dayNumToday: { color: t.brand[600], fontWeight: typography.weight.bold as '700' },
  dayNumSelected: { color: t.brand.fg, fontWeight: typography.weight.bold as '700' },

  titleList: { gap: 2 },
  taskPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderLeftWidth: 2,
  },
  taskPillOngoing: { opacity: 0.7 },
  taskPillText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold as '600',
  },
  more: {
    fontSize: 9,
    color: t.text.muted,
    textAlign: 'center',
    marginTop: 1,
    fontWeight: typography.weight.semibold as '600',
  },
});
