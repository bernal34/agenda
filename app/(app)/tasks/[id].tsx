import { useEffect, useState } from 'react';
import {
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
import { Archive, ArchiveRestore, BellOff, Clock as ClockIcon, Trash2 } from 'lucide-react-native';

import { TaskAssignees } from '../../../components/tasks/TaskAssignees';
import { TaskAttachments } from '../../../components/tasks/TaskAttachments';
import { TaskComments } from '../../../components/tasks/TaskComments';
import { TaskCustomFields } from '../../../components/tasks/TaskCustomFields';
import { TaskDependencies } from '../../../components/tasks/TaskDependencies';
import { TaskLabels } from '../../../components/tasks/TaskLabels';
import { TaskSubtasks } from '../../../components/tasks/TaskSubtasks';
import { useMySnooze, useSnoozeTask } from '../../../lib/queries/assignees';
import {
  Button,
  DateField,
  EmptyState,
  Input,
  ModalScreen,
  ScreenHeader,
  SectionHeader,
  SkeletonList,
} from '../../../components/ui';
import { radius, spacing, typography, type Tokens } from '../../../constants/theme';
import {
  dmyAndTimeToIso,
  dmyToIso,
  isoToDmy,
  isoToLocalTime,
  isValidDmy,
  isValidTime,
} from '../../../lib/dateFormat';
import { confirmAction, notify } from '../../../lib/notify';
import { useBoardStages } from '../../../lib/queries/stages';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import {
  RecurrenceFreq,
  RecurrenceRule,
  useArchiveTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from '../../../lib/queries/taskMutations';
import { TaskPriority, TaskStatus } from '../../../lib/queries/tasks';
import { useAuthStore } from '../../../stores/authStore';

/** El color de prioridad sale del tema en render, no de un const de módulo. */
function priorityOptions(t: Tokens): { value: TaskPriority; label: string; color: string }[] {
  return [
    { value: 'low',    label: 'Baja',    color: t.text.muted },
    { value: 'normal', label: 'Normal',  color: t.status.review },
    { value: 'high',   label: 'Alta',    color: t.status.progress },
    { value: 'urgent', label: 'Urgente', color: t.status.urgent },
  ];
}

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

const RECURRENCE_OPTIONS: { value: RecurrenceFreq | 'none'; label: string }[] = [
  { value: 'none',    label: 'No se repite' },
  { value: 'daily',   label: 'Diaria' },
  { value: 'weekly',  label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const { data: task, isLoading } = useTask(id);
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();
  const archiveMut = useArchiveTask();
  const snoozeMut = useSnoozeTask(id);
  const snoozeQ = useMySnooze(id, userId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [leadTime, setLeadTime] = useState(5);
  const [progress, setProgress] = useState(0);
  const [recFreq, setRecFreq] = useState<RecurrenceFreq | 'none'>('none');
  const [recInterval, setRecInterval] = useState('1');
  const [dirty, setDirty] = useState(false);

  const stagesQ = useBoardStages(task?.area_id);
  const priorities = priorityOptions(t);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setStartDate(isoToDmy(task.start_date));
    setDueDate(isoToDmy(task.due_date));
    setStartTime(task.start_at ? isoToLocalTime(task.start_at) : '');
    setLeadTime(task.lead_time_minutes ?? 5);
    setProgress(task.progress);
    setRecFreq(task.recurrence_rule?.freq ?? 'none');
    setRecInterval(String(task.recurrence_rule?.interval ?? 1));
    setDirty(false);
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    if (title.trim().length < 2) {
      notify('Título inválido', 'Mínimo 2 caracteres');
      return;
    }
    if (startDate && !isValidDmy(startDate)) {
      notify('Fecha de inicio inválida', 'Usá DD/MM/YYYY (ej: 31/12/2026)');
      return;
    }
    if (dueDate && !isValidDmy(dueDate)) {
      notify('Fecha final inválida', 'Usá DD/MM/YYYY (ej: 31/12/2026)');
      return;
    }
    if (startDate && dueDate) {
      const a = dmyToIso(startDate);
      const b = dmyToIso(dueDate);
      if (a && b && a > b) {
        notify('Rango inválido', 'La fecha de inicio no puede ser posterior a la final');
        return;
      }
    }
    if (startTime && !isValidTime(startTime)) {
      notify('Hora inválida', 'Usá HH:MM en formato 24h (ej: 09:30)');
      return;
    }
    if (startTime && !startDate) {
      notify('Falta la fecha', 'Para programar una hora primero captura la fecha de inicio');
      return;
    }
    const parsedInterval = Math.max(1, parseInt(recInterval || '1', 10) || 1);
    const rule: RecurrenceRule | null =
      recFreq === 'none' ? null : { freq: recFreq, interval: parsedInterval };
    try {
      await updateMut.mutateAsync({
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        start_date: dmyToIso(startDate),
        due_date: dmyToIso(dueDate),
        start_at: dmyAndTimeToIso(startDate, startTime),
        lead_time_minutes: leadTime,
        progress,
        recurrence_rule: rule,
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
    if (!(await confirmAction('¿Eliminar esta tarea?', 'Esta acción no se puede deshacer.', 'Eliminar'))) return;
    try {
      await deleteMut.mutateAsync(task.id);
      close();
    } catch (err) {
      notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleSnooze = async (kind: '+1d' | '+1w' | 'clear') => {
    if (kind === 'clear') {
      try { await snoozeMut.mutateAsync(null); }
      catch (err) { notify('No se pudo quitar', err instanceof Error ? err.message : 'Error'); }
      return;
    }
    const d = new Date();
    if (kind === '+1d') d.setDate(d.getDate() + 1);
    if (kind === '+1w') d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    try { await snoozeMut.mutateAsync(d); }
    catch (err) { notify('No se pudo posponer', err instanceof Error ? err.message : 'Error'); }
  };

  const handleArchiveToggle = async () => {
    if (!task) return;
    const archive = !task.archived_at;
    try {
      await archiveMut.mutateAsync({ id: task.id, archive });
      if (archive) close();
    } catch (err) {
      notify('No se pudo archivar', err instanceof Error ? err.message : 'Error');
    }
  };

  // Con el header puesto desde el vamos, abrir una tarea ya no parpadea en
  // blanco: se ve la ventana y adentro la silueta del contenido.
  if (isLoading) {
    return (
      <ModalScreen onClose={close} maxWidth={760}>
        <SafeAreaView style={styles.screen} edges={['top']}>
          <ScreenHeader title="Tarea" backLabel="Cerrar" onBack={close} />
          <View style={styles.body}>
            <SkeletonList count={2} variant="row" />
          </View>
        </SafeAreaView>
      </ModalScreen>
    );
  }

  // La tarea no está: la borraron, o el aviso que abrió esta pantalla apunta a
  // una tarea vieja. Antes esto caía en la misma rama que "cargando", así que
  // la pantalla se quedaba girando para siempre sin explicar nada.
  if (!task) {
    return (
      <ModalScreen onClose={close} maxWidth={560}>
        <SafeAreaView style={styles.screen} edges={['top']}>
          <ScreenHeader title="Tarea" backLabel="Cerrar" onBack={close} />
          <EmptyState
            icon={Trash2}
            title="Esta tarea ya no existe"
            description="La eliminaron, o el aviso que abriste apunta a una tarea vieja."
            action={
              <Button variant="secondary" onPress={close}>
                Volver
              </Button>
            }
          />
        </SafeAreaView>
      </ModalScreen>
    );
  }

  const bump = () => setDirty(true);

  return (
    <ModalScreen onClose={close} maxWidth={760}>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title="Tarea"
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
            placeholderTextColor={t.text.muted}
          />

          <View>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={(v) => { setDescription(v); bump(); }}
              placeholder="Detalles, contexto, links..."
              placeholderTextColor={t.text.muted}
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
                      active && { backgroundColor: opt.color + '22', borderColor: opt.color },
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
              {priorities.map((opt) => {
                const active = priority === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setPriority(opt.value); bump(); }}
                    style={[
                      styles.option,
                      active && { backgroundColor: opt.color + '22', borderColor: opt.color },
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

          <DateField
            label="Fecha de inicio"
            value={startDate}
            onChange={(v) => { setStartDate(v); bump(); }}
          />

          <DateField
            label="Fecha final"
            value={dueDate}
            onChange={(v) => { setDueDate(v); bump(); }}
          />

          <Input
            label="Hora de inicio (opcional)"
            icon={ClockIcon}
            value={startTime}
            onChangeText={(v) => { setStartTime(v); bump(); }}
            placeholder="HH:MM"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
          />

          {startTime !== '' && (
            <View style={styles.section}>
              <SectionHeader title="Avisarme" />
              <View style={styles.optionsRow}>
                {[
                  { value: 0,  label: 'En el momento' },
                  { value: 5,  label: '5 min antes' },
                  { value: 15, label: '15 min antes' },
                  { value: 30, label: '30 min antes' },
                  { value: 60, label: '1 h antes' },
                ].map((opt) => {
                  const active = leadTime === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => { setLeadTime(opt.value); bump(); }}
                      style={[styles.option, active && styles.optionActiveBrand]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && {
                            color: t.brand[600],
                            fontWeight: typography.weight.semibold as '600',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title="Recurrencia" />
            <View style={styles.optionsRow}>
              {RECURRENCE_OPTIONS.map((opt) => {
                const active = recFreq === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setRecFreq(opt.value); bump(); }}
                    style={[styles.option, active && styles.optionActiveBrand]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && { color: t.brand[700], fontWeight: typography.weight.semibold as '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {recFreq !== 'none' && (
              <View style={styles.recIntervalRow}>
                <Text style={styles.recIntervalLabel}>Cada</Text>
                <TextInput
                  style={styles.recIntervalInput}
                  value={recInterval}
                  onChangeText={(v) => { setRecInterval(v.replace(/[^0-9]/g, '')); bump(); }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.recIntervalLabel}>
                  {recFreq === 'daily' ? 'día(s)' : recFreq === 'weekly' ? 'semana(s)' : 'mes(es)'}
                </Text>
                <Text style={styles.recHint}>
                  Se crea una nueva instancia al marcarla como hecha.
                </Text>
              </View>
            )}
          </View>

          <SnoozeSection
            value={snoozeQ.data ?? null}
            pending={snoozeMut.isPending}
            onPick={handleSnooze}
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
          <TaskCustomFields taskId={task.id} areaId={task.area_id} />
          <TaskDependencies taskId={task.id} areaId={task.area_id} />
          <TaskSubtasks taskId={task.id} />
          <TaskAttachments taskId={task.id} />
          <TaskComments taskId={task.id} areaId={task.area_id} userId={userId} />

          <Button
            variant="secondary"
            icon={task.archived_at ? ArchiveRestore : Archive}
            onPress={handleArchiveToggle}
            loading={archiveMut.isPending}
            fullWidth
            style={{ marginTop: spacing[5] }}
          >
            {task.archived_at ? 'Restaurar tarea' : 'Archivar tarea'}
          </Button>

          <Button
            variant="ghost"
            icon={Trash2}
            onPress={handleDelete}
            loading={deleteMut.isPending}
            fullWidth
            style={{ marginTop: spacing[2] }}
          >
            Eliminar tarea
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ModalScreen>
  );
}

function SnoozeSection({
  value,
  pending,
  onPick,
}: {
  value: string | null;
  pending: boolean;
  onPick: (kind: '+1d' | '+1w' | 'clear') => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const active = value && new Date(value) > new Date();
  const label = active
    ? new Date(value!).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <View style={styles.section}>
      <SectionHeader title="Posponer" />
      {active && (
        <View style={styles.snoozeBanner}>
          <BellOff size={12} color={t.feedback.warningFg} strokeWidth={2.2} />
          <Text style={styles.snoozeBannerText}>Oculta de Mis tareas hasta {label}</Text>
        </View>
      )}
      <View style={styles.optionsRow}>
        <Pressable
          onPress={() => onPick('+1d')}
          disabled={pending}
          style={[styles.option, pending && { opacity: 0.6 }]}
        >
          <Text style={styles.optionText}>+1 día</Text>
        </Pressable>
        <Pressable
          onPress={() => onPick('+1w')}
          disabled={pending}
          style={[styles.option, pending && { opacity: 0.6 }]}
        >
          <Text style={styles.optionText}>+1 semana</Text>
        </Pressable>
        {active && (
          <Pressable
            onPress={() => onPick('clear')}
            disabled={pending}
            style={[styles.option, { borderColor: t.feedback.errorFg }, pending && { opacity: 0.6 }]}
          >
            <Text style={[styles.optionText, { color: t.feedback.errorFg }]}>Quitar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg.app },
  body: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },

  titleInput: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold as '700',
    color: t.text.primary,
    letterSpacing: -0.4,
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
    marginBottom: spacing[2],
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
    marginBottom: spacing[1],
  },
  textArea: {
    height: 90,
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    color: t.text.primary,
    backgroundColor: t.bg.surface,
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
    borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  optionActiveBrand: { backgroundColor: t.brand[50], borderColor: t.brand[500] },
  optionText: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  progressRow: { flexDirection: 'row', gap: spacing[2] },
  progBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.strong,
    alignItems: 'center',
    backgroundColor: t.bg.surface,
  },
  progBtnActive: {
    backgroundColor: t.brand[600],
    borderColor: t.brand[600],
  },
  progBtnText: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    fontWeight: typography.weight.semibold as '600',
  },
  progBtnTextActive: { color: t.brand.fg },

  recIntervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
    marginTop: spacing[2],
  },
  recIntervalLabel: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
  },
  recIntervalInput: {
    width: 56,
    paddingVertical: 6,
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    backgroundColor: t.bg.surface,
    color: t.text.primary,
    textAlign: 'center',
    fontSize: typography.size.sm,
  },
  recHint: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    flexBasis: '100%',
  },

  snoozeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.feedback.warningBg,
    borderWidth: 1,
    borderColor: t.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  snoozeBannerText: {
    fontSize: typography.size.xs,
    color: t.feedback.warningFg,
    fontWeight: typography.weight.medium as '500',
  },
});
