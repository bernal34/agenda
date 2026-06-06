import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, Trash2 } from 'lucide-react-native';

import { TaskAssignees } from '../../../components/tasks/TaskAssignees';
import { TaskAttachments } from '../../../components/tasks/TaskAttachments';
import { TaskComments } from '../../../components/tasks/TaskComments';
import { TaskLabels } from '../../../components/tasks/TaskLabels';
import { TaskSubtasks } from '../../../components/tasks/TaskSubtasks';
import {
  Button,
  Input,
  ScreenHeader,
  SectionHeader,
} from '../../../components/ui';
import {
  palette,
  radius,
  spacing,
  tokens,
  typography,
} from '../../../constants/theme';
import { dmyToIso, isoToDmy, isValidDmy } from '../../../lib/dateFormat';
import { notify } from '../../../lib/notify';
import { useBoardStages } from '../../../lib/queries/stages';
import {
  useDeleteTask,
  useTask,
  useUpdateTask,
} from '../../../lib/queries/taskMutations';
import { TaskPriority, TaskStatus } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Baja',    color: palette.slate[400] },
  { value: 'normal', label: 'Normal',  color: palette.sky[500] },
  { value: 'high',   label: 'Alta',    color: palette.amber[500] },
  { value: 'urgent', label: 'Urgente', color: palette.red[500] },
];

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: task, isLoading } = useTask(id);
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [dirty, setDirty] = useState(false);

  const stagesQ = useBoardStages(task?.area_id);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(isoToDmy(task.due_date));
    setProgress(task.progress);
    setDirty(false);
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    if (title.trim().length < 2) {
      notify('Título inválido', 'Mínimo 2 caracteres');
      return;
    }
    if (dueDate && !isValidDmy(dueDate)) {
      notify('Fecha inválida', 'Usá DD/MM/YYYY (ej: 31/12/2026)');
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dmyToIso(dueDate),
        progress,
      });
      setDirty(false);
    } catch (err) {
      notify('No se pudo guardar', err instanceof Error ? err.message : 'Error');
    }
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleDelete = async () => {
    if (!task) return;
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar esta tarea?')) return;
    try {
      await deleteMut.mutateAsync(task.id);
      close();
    } catch (err) {
      notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error');
    }
  };

  if (isLoading || !task) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.app, justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.brand[600]} />
      </SafeAreaView>
    );
  }

  const bump = () => setDirty(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.app }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title="Detalle de tarea"
          backLabel="Cerrar"
          onBack={close}
          right={
            <Button
              variant={dirty ? 'primary' : 'secondary'}
              size="sm"
              loading={updateMut.isPending}
              disabled={!dirty || updateMut.isPending}
              onPress={handleSave}
            >
              Guardar
            </Button>
          }
        />

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={(v) => { setTitle(v); bump(); }}
            placeholder="Título de la tarea"
            placeholderTextColor={tokens.text.muted}
          />

          <View>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={(v) => { setDescription(v); bump(); }}
              placeholder="Detalles, contexto, links..."
              placeholderTextColor={tokens.text.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Estado" />
            <View style={styles.optionsRow}>
              {(stagesQ.data ?? []).map((opt) => {
                const active = status === opt.code;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => { setStatus(opt.code); bump(); }}
                    style={[
                      styles.option,
                      active && { backgroundColor: opt.color + '14', borderColor: opt.color },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: opt.color }]} />
                    <Text
                      style={[
                        styles.optionText,
                        active && { color: opt.color, fontWeight: typography.weight.semibold as '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Prioridad" />
            <View style={styles.optionsRow}>
              {PRIORITY_OPTIONS.map((opt) => {
                const active = priority === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setPriority(opt.value); bump(); }}
                    style={[
                      styles.option,
                      active && { backgroundColor: opt.color + '14', borderColor: opt.color },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: opt.color }]} />
                    <Text
                      style={[
                        styles.optionText,
                        active && { color: opt.color, fontWeight: typography.weight.semibold as '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Fecha límite"
            icon={CalendarIcon}
            value={dueDate}
            onChangeText={(v) => { setDueDate(v); bump(); }}
            placeholder="DD/MM/YYYY"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.section}>
            <SectionHeader title={`Progreso · ${progress}%`} />
            <View style={styles.progressRow}>
              {PROGRESS_STEPS.map((p) => {
                const active = progress === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => { setProgress(p); bump(); }}
                    style={[styles.progBtn, active && styles.progBtnActive]}
                  >
                    <Text style={[styles.progBtnText, active && styles.progBtnTextActive]}>
                      {p}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TaskAssignees taskId={task.id} areaId={task.area_id} currentUserId={userId} />
          <TaskLabels taskId={task.id} areaId={task.area_id} />
          <TaskSubtasks taskId={task.id} />
          <TaskAttachments taskId={task.id} />
          <TaskComments taskId={task.id} userId={userId} />

          <Button
            variant="ghost"
            icon={Trash2}
            onPress={handleDelete}
            loading={deleteMut.isPending}
            fullWidth
            style={{ marginTop: spacing[5] }}
          >
            Eliminar tarea
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PillOption({
  label,
  badge,
  active,
  onPress,
}: {
  label: string;
  badge?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.option,
        active && { backgroundColor: palette.brand[50], borderColor: palette.brand[500] },
      ]}
    >
      {badge && (
        <Text style={[styles.optionBadge, active && { color: palette.brand[600] }]}>
          {badge}
        </Text>
      )}
      <Text
        style={[
          styles.optionText,
          active && { color: palette.brand[700], fontWeight: typography.weight.semibold as '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },

  titleInput: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.4,
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
    marginBottom: spacing[2],
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
    marginBottom: spacing[1],
  },
  textArea: {
    height: 90,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },

  section: { gap: spacing[1] },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  optionText: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  optionBadge: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  progressRow: { flexDirection: 'row', gap: spacing[2] },
  progBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    alignItems: 'center',
    backgroundColor: tokens.bg.surface,
  },
  progBtnActive: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  progBtnText: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    fontWeight: typography.weight.semibold as '600',
  },
  progBtnTextActive: { color: tokens.brand.fg },
});
