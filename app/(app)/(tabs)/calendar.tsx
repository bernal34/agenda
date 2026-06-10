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
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useMyTasks, MyTask } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Devuelve la primera celda visible del grid (lunes anterior o igual al día 1).
function firstCellOfMonth(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const day = first.getDay(); // 0=Dom..6=Sáb
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(year, month, 1 - offsetToMonday);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

export default function CalendarScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: tasks, isLoading, error } = useMyTasks(userId);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedIso, setSelectedIso] = useState<string>(isoDate(today));

  const grid = useMemo(() => {
    const start = firstCellOfMonth(cursor.year, cursor.month);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, MyTask[]>();
    (tasks ?? []).forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      const arr = m.get(key);
      if (arr) arr.push(t);
      else m.set(key, [t]);
    });
    return m;
  }, [tasks]);

  const selectedTasks = byDay.get(selectedIso) ?? [];

  const prevMonth = () => {
    const m = cursor.month - 1;
    setCursor(m < 0
      ? { year: cursor.year - 1, month: 11 }
      : { year: cursor.year, month: m });
  };
  const nextMonth = () => {
    const m = cursor.month + 1;
    setCursor(m > 11
      ? { year: cursor.year + 1, month: 0 }
      : { year: cursor.year, month: m });
  };
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedIso(isoDate(today));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={prevMonth} hitSlop={6} style={styles.navBtn}>
          <ChevronLeft size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{MONTH_NAMES[cursor.month]} {cursor.year}</Text>
          <Pressable onPress={goToday} hitSlop={6}>
            <Text style={styles.todayBtn}>Hoy</Text>
          </Pressable>
        </View>
        <Pressable onPress={nextMonth} hitSlop={6} style={styles.navBtn}>
          <ChevronRight size={18} color={tokens.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
      {error && (
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Error cargando tareas'}
        </Text>
      )}

      <View style={styles.weekHeader}>
        {WEEKDAY_HEADERS.map((d) => (
          <Text key={d} style={styles.weekHeaderText}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === cursor.month;
          const isToday = sameDay(d, today);
          const selected = iso === selectedIso;
          const items = byDay.get(iso) ?? [];
          const dots = items.slice(0, 3);
          return (
            <Pressable
              key={iso}
              onPress={() => setSelectedIso(iso)}
              style={[
                styles.cell,
                !inMonth && styles.cellOutside,
                selected && styles.cellSelected,
              ]}
            >
              <View style={[styles.dayNumWrap, isToday && styles.dayNumToday]}>
                <Text style={[
                  styles.dayNum,
                  !inMonth && styles.dayNumOutside,
                  isToday && styles.dayNumTextToday,
                ]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {dots.map((t, i) => (
                  <View
                    key={t.id}
                    style={[styles.dot, { backgroundColor: t.area?.color ?? palette.brand[500] }]}
                  />
                ))}
                {items.length > 3 && <Text style={styles.moreCount}>+{items.length - 3}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.listHeader}>
          {selectedTasks.length === 0
            ? 'Sin tareas este día'
            : `${selectedTasks.length} ${selectedTasks.length === 1 ? 'tarea' : 'tareas'}`}
        </Text>
        {selectedTasks.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/tasks/${t.id}` as never)}
            style={({ pressed }) => [styles.taskRow, pressed && styles.taskRowPressed]}
          >
            <View style={[styles.areaStripe, { backgroundColor: t.area?.color ?? palette.brand[500] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.taskMeta} numberOfLines={1}>
                {t.area?.name ?? '—'} · {t.status}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
    gap: spacing[2],
  },
  navBtn: {
    padding: 6,
    borderRadius: radius.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  todayBtn: {
    fontSize: typography.size.xs,
    color: tokens.brand[600],
    fontWeight: typography.weight.medium as '500',
    marginTop: 1,
  },

  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: radius.sm,
  },
  cellOutside: { opacity: 0.4 },
  cellSelected: {
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[300],
  },
  dayNumWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  dayNumToday: { backgroundColor: palette.brand[600] },
  dayNum: {
    fontSize: typography.size.xs,
    color: tokens.text.primary,
    fontWeight: typography.weight.medium as '500',
  },
  dayNumOutside: { color: tokens.text.muted },
  dayNumTextToday: { color: tokens.brand.fg, fontWeight: typography.weight.bold as '700' },
  dotsRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  moreCount: {
    fontSize: 9,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    marginLeft: 2,
  },

  list: {
    padding: spacing[4],
    paddingBottom: spacing[10],
    gap: spacing[2],
  },
  listHeader: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing[1],
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  taskRowPressed: { backgroundColor: palette.brand[50] },
  areaStripe: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  taskTitle: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    fontWeight: typography.weight.semibold as '600',
  },
  taskMeta: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 2,
  },

  error: { color: palette.red[600], fontSize: typography.size.sm, padding: spacing[4] },
});
