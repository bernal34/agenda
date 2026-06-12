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
import { Calendar as CalendarIcon, Clock as ClockIcon, Trash2 } from 'lucide-react-native';

import { Button, Input, ScreenHeader, SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import {
  dmyAndTimeToIso,
  dmyToIso,
  isoToDmy,
  isoToLocalDmy,
  isoToLocalTime,
  isValidDmy,
  isValidTime,
} from '../../lib/dateFormat';
import { notify } from '../../lib/notify';
import { BoardStage } from '../../lib/queries/stages';
import { TaskPriority, TaskStatus } from '../../lib/queries/tasks';

const DEFAULT_STAGES: Pick<BoardStage, 'code' | 'label' | 'color'>[] = [
  { code: 'todo',        label: 'Por hacer',   color: palette.slate[500] },
  { code: 'in_progress', label: 'En progreso', color: palette.amber[500] },
  { code: 'in_review',   label: 'En revisión', color: palette.sky[500] },
  { code: 'done',        label: 'Hecho',       color: palette.emerald[500] },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Baja',    color: palette.slate[400] },
  { value: 'normal', label: 'Normal',  color: palette.sky[500] },
  { value: 'high',   label: 'Alta',    color: palette.amber[500] },
  { value: 'urgent', label: 'Urgente', color: palette.red[500] },
];

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  start_at: string | null;
  lead_time_minutes: number;
  progress: number;
}

const LEAD_TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 0,  label: 'En el momento' },
  { value: 5,  label: '5 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 h antes' },
];

interface Props {
  initial?: Partial<TaskFormValues>;
  mode: 'create' | 'edit';
  submitting?: boolean;
  showStatus?: boolean;
  showProgress?: boolean;
  stages?: Pick<BoardStage, 'code' | 'label' | 'color'>[];
  onSubmit: (values: TaskFormValues) => void | Promise<void>;
  onDelete?: () => void;
  onCancel: () => void;
}

// El form tiene dos fuentes posibles de fecha en `initial`:
// - `start_at` (timestamp completo): nueva en Fase 1, lo preferimos.
// - `due_date` (date legacy): se mantiene como fallback.
// Si llega `start_at`, parseamos fecha+hora de ahí; si no, usamos due_date sin hora.
function initialDateTime(initial: Partial<TaskFormValues> | undefined): {
  dueDate: string;
  startTime: string;
} {
  if (initial?.start_at) {
    return {
      dueDate: isoToLocalDmy(initial.start_at),
      startTime: isoToLocalTime(initial.start_at),
    };
  }
  return {
    dueDate: isoToDmy(initial?.due_date ?? ''),
    startTime: '',
  };
}

export function TaskForm({
  initial,
  mode,
  submitting = false,
  showStatus = true,
  showProgress = false,
  stages,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const stageOptions = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  const initialDt = initialDateTime(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(initialDt.dueDate);
  const [startTime, setStartTime] = useState(initialDt.startTime);
  const [leadTime, setLeadTime] = useState<number>(initial?.lead_time_minutes ?? 5);
  const [progress, setProgress] = useState<number>(initial?.progress ?? 0);

  useEffect(() => {
    if (!initial) return;
    if (initial.title !== undefined) setTitle(initial.title);
    if (initial.description !== undefined) setDescription(initial.description);
    if (initial.status !== undefined) setStatus(initial.status);
    if (initial.priority !== undefined) setPriority(initial.priority);
    if (initial.start_at !== undefined || initial.due_date !== undefined) {
      const next = initialDateTime(initial);
      setDueDate(next.dueDate);
      setStartTime(next.startTime);
    }
    if (initial.lead_time_minutes !== undefined) setLeadTime(initial.lead_time_minutes);
    if (initial.progress !== undefined) setProgress(initial.progress);
  }, [initial]);

  const handleSubmit = async () => {
    if (title.trim().length < 2) {
      notify('Título inválido', 'El título debe tener al menos 2 caracteres');
      return;
    }
    if (dueDate && !isValidDmy(dueDate)) {
      notify('Fecha inválida', 'Usá DD/MM/YYYY (ej: 31/12/2026)');
      return;
    }
    if (startTime && !isValidTime(startTime)) {
      notify('Hora inválida', 'Usá HH:MM en formato 24h (ej: 09:30)');
      return;
    }
    if (startTime && !dueDate) {
      notify('Falta la fecha', 'Para programar una hora primero captura la fecha');
      return;
    }
    if (progress < 0 || progress > 100) {
      notify('Progreso inválido', 'El progreso debe estar entre 0 y 100');
      return;
    }
    const startAtIso = dmyAndTimeToIso(dueDate, startTime);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      due_date: dmyToIso(dueDate) ?? '',
      start_at: startAtIso,
      lead_time_minutes: leadTime,
      progress,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title={mode === 'create' ? 'Nueva tarea' : 'Editar tarea'}
        backLabel="Cancelar"
        onBack={onCancel}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input
          label="Título *"
          value={title}
          onChangeText={setTitle}
          placeholder="Ej: Revisar pedidos pendientes"
          autoFocus={mode === 'create'}
        />

        <View>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalles, contexto, links..."
            placeholderTextColor={tokens.text.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {showStatus && (
          <View style={styles.section}>
            <SectionHeader title="Estado" />
            <View style={styles.optionsRow}>
              {stageOptions.map((opt) => {
                const active = status === opt.code;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => setStatus(opt.code)}
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
        )}

        <View style={styles.section}>
          <SectionHeader title="Prioridad" />
          <View style={styles.optionsRow}>
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setPriority(opt.value)}
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

        <DueDateField value={dueDate} onChange={setDueDate} />

        <StartTimeField value={startTime} onChange={setStartTime} />

        {startTime !== '' && (
          <View style={styles.section}>
            <SectionHeader title="Avisarme" />
            <View style={styles.optionsRow}>
              {LEAD_TIME_OPTIONS.map((opt) => {
                const active = leadTime === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setLeadTime(opt.value)}
                    style={[
                      styles.option,
                      active && {
                        backgroundColor: palette.brand[500] + '14',
                        borderColor: palette.brand[500],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && {
                          color: palette.brand[600],
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


        {showProgress && (
          <View style={styles.section}>
            <SectionHeader title={`Progreso · ${progress}%`} />
            <View style={styles.progressRow}>
              {[0, 25, 50, 75, 100].map((p) => {
                const active = progress === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setProgress(p)}
                    style={[styles.progBtn, active && styles.progBtnActive]}
                  >
                    <Text
                      style={[styles.progBtnText, active && styles.progBtnTextActive]}
                    >
                      {p}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Button
          onPress={handleSubmit}
          loading={submitting}
          size="lg"
          fullWidth
          style={{ marginTop: spacing[5] }}
        >
          {mode === 'create' ? 'Crear tarea' : 'Guardar cambios'}
        </Button>

        {mode === 'edit' && onDelete && (
          <Button
            variant="ghost"
            icon={Trash2}
            onPress={onDelete}
            fullWidth
            style={{ marginTop: spacing[2] }}
          >
            Eliminar tarea
          </Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Date picker: native HTML date input on web (opens browser calendar),
 * plain text input on native (DD/MM/YYYY format). Same DueDateField API.
 */
function DueDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  if (Platform.OS === 'web') {
    const isoValue = dmyToIso(value) ?? '';
    return (
      <View style={{ gap: spacing[1] }}>
        <Text style={styles.label}>Fecha límite</Text>
        {/* react-native-web renders raw React elements as DOM */}
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const InputEl: any = 'input';
          return (
            <InputEl
              type="date"
              value={isoValue}
              onChange={(e: { target: { value: string } }) => {
                const v = e.target.value;
                onChange(isoToDmy(v) ?? '');
              }}
              style={{
                height: 40,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 16,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          );
        })()}
      </View>
    );
  }

  return (
    <Input
      label="Fecha límite"
      icon={CalendarIcon}
      value={value}
      onChangeText={onChange}
      placeholder="DD/MM/YYYY"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

/**
 * Time picker: native HTML time input on web, plain text HH:MM on native.
 * Cuando se llena, el form combina (date + time) → start_at timestamp
 * para tareas estilo agenda. Sin hora, la tarea solo tiene fecha.
 */
function StartTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: spacing[1] }}>
        <Text style={styles.label}>Hora de inicio (opcional)</Text>
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const InputEl: any = 'input';
          return (
            <InputEl
              type="time"
              value={value}
              onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
              style={{
                height: 40,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 16,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          );
        })()}
      </View>
    );
  }

  return (
    <Input
      label="Hora de inicio (opcional)"
      icon={ClockIcon}
      value={value}
      onChangeText={onChange}
      placeholder="HH:MM"
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="numbers-and-punctuation"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
    marginBottom: spacing[1],
  },
  textArea: {
    height: 100,
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
