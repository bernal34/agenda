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

import { MonthCalendar } from '../../../components/calendar/MonthCalendar';
import { useMyTasks } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: tasks, isLoading, error } = useMyTasks(userId);

  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(todayIso());

  const dayTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.due_date === selected),
    [tasks, selected],
  );

  const onPrev = () => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const onNext = () => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const onAdd = (iso: string) => router.push(`/tasks/new?due=${iso}` as never);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
        <Pressable
          onPress={() => { setMonthAnchor(new Date()); setSelected(todayIso()); }}
          hitSlop={6}
        >
          <Text style={styles.todayBtn}>Hoy</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {error && (
          <Text style={styles.error}>
            {error instanceof Error ? error.message : 'Error cargando tareas'}
          </Text>
        )}

        {tasks && (
          <View style={styles.calendarWrap}>
            <MonthCalendar
              monthAnchor={monthAnchor}
              selected={selected}
              tasks={tasks}
              onSelect={setSelected}
              onPrev={onPrev}
              onNext={onNext}
              onAdd={onAdd}
            />
          </View>
        )}

        <View style={styles.list}>
          <Text style={styles.listHeader}>
            {dayTasks.length === 0
              ? 'Sin tareas este día'
              : `${dayTasks.length} ${dayTasks.length === 1 ? 'tarea' : 'tareas'}`}
          </Text>
          {dayTasks.map((t) => (
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  todayBtn: {
    fontSize: typography.size.sm,
    color: tokens.brand[600],
    fontWeight: typography.weight.medium as '500',
  },
  scroll: { paddingBottom: spacing[10] },
  calendarWrap: { padding: spacing[4] },
  list: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
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
