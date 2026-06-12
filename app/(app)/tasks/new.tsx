import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Inbox, LayoutGrid } from 'lucide-react-native';

import { TaskForm } from '../../../components/tasks/TaskForm';
import { Card, EmptyState, ScreenHeader } from '../../../components/ui';
import { notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import { useBoardStages } from '../../../lib/queries/stages';
import { useCreateTask } from '../../../lib/queries/taskMutations';
import { TaskStatus } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';
import { radius, spacing, tokens, typography } from '../../../constants/theme';

export default function NewTaskScreen() {
  const { area, status, date } = useLocalSearchParams<{
    area?: string;
    status?: TaskStatus;
    date?: string;
  }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const createMut = useCreateTask();
  const { data: areas } = useMyAreas(userId);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(area);
  const stagesQ = useBoardStages(selectedArea);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!selectedArea) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Nueva tarea" backLabel="Cancelar" onBack={close} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Elegí el área donde va la tarea</Text>
          {areas?.map((a) => (
            <Card
              key={a.id}
              onPress={() => setSelectedArea(a.id)}
              accent={a.color}
              padding="md"
              style={styles.areaCard}
            >
              <View style={[styles.iconBox, { backgroundColor: a.color + '1A' }]}>
                <LayoutGrid size={18} color={a.color} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.areaName}>{a.name}</Text>
                <Text style={styles.areaRole}>{a.role}</Text>
              </View>
              <ChevronRight size={18} color={tokens.text.muted} strokeWidth={2} />
            </Card>
          ))}
          {areas && areas.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="Sin áreas"
              description="Todavía no sos miembro de ningún área."
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TaskForm
        mode="create"
        submitting={createMut.isPending}
        initial={{
          status: (status as TaskStatus) ?? 'todo',
          due_date: date ?? '',
        }}
        stages={stagesQ.data}
        showStatus
        showProgress={false}
        onCancel={close}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({
              area_id: selectedArea,
              title: values.title,
              description: values.description || null,
              status: values.status,
              priority: values.priority,
              due_date: values.due_date || null,
              start_at: values.start_at,
              lead_time_minutes: values.lead_time_minutes,
              assignTo: userId,
            });
            close();
          } catch (err) {
            notify('No se pudo crear', err instanceof Error ? err.message : 'Error');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[5], paddingBottom: spacing[8] },
  intro: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    marginBottom: spacing[3],
  },
  areaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  areaRole: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    textTransform: 'capitalize',
    marginTop: 2,
    fontWeight: typography.weight.medium as '500',
  },
});
