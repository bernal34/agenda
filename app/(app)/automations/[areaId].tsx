import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, Zap } from 'lucide-react-native';

import { Button, Card, ScreenHeader } from '../../../components/ui';
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';
import { notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import { useAreaMembers } from '../../../lib/queries/assignees';
import { useBoardStages } from '../../../lib/queries/stages';
import {
  ActionKind,
  AutomationRule,
  TriggerKind,
  useAreaAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useToggleAutomation,
} from '../../../lib/queries/automations';
import { useAuthStore } from '../../../stores/authStore';

const TRIGGER_LABEL: Record<TriggerKind, string> = {
  created: 'Cuando se crea una tarea',
  status_changed_to: 'Cuando pasa a etapa…',
};

const ACTION_LABEL: Record<ActionKind, string> = {
  set_priority: 'Cambiar prioridad',
  assign_to:    'Asignar a',
  add_label:    'Agregar label',
  set_status:   'Mover a etapa',
  archive:      'Archivar',
};

const PRIORITY_OPTS = ['low', 'normal', 'high', 'urgent'];

export default function AutomationsScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const areasQ = useMyAreas(userId);
  const area = areasQ.data?.find((a) => a.id === areaId);

  const stagesQ = useBoardStages(areaId);
  const membersQ = useAreaMembers(areaId);
  const rulesQ = useAreaAutomations(areaId);
  const createMut = useCreateAutomation(areaId);
  const deleteMut = useDeleteAutomation(areaId);
  const toggleMut = useToggleAutomation(areaId);

  const stages = stagesQ.data ?? [];
  const members = membersQ.data ?? [];

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [trigKind, setTrigKind] = useState<TriggerKind>('status_changed_to');
  const [trigStatus, setTrigStatus] = useState<string>('');
  const [actKind, setActKind] = useState<ActionKind>('set_priority');
  const [actParam, setActParam] = useState<string>('high');

  const handleCreate = async () => {
    if (name.trim().length < 2) { notify('Nombre inválido', 'Mínimo 2 caracteres'); return; }
    const trigger: AutomationRule['trigger'] = trigKind === 'status_changed_to'
      ? { kind: 'status_changed_to', status: trigStatus || stages[0]?.code || '' }
      : { kind: 'created' };
    if (trigKind === 'status_changed_to' && !trigger.status) {
      notify('Falta etapa', 'Elegí una etapa para el disparador'); return;
    }
    const action: AutomationRule['action'] = (() => {
      switch (actKind) {
        case 'set_priority': return { kind: 'set_priority', priority: actParam };
        case 'assign_to':    return { kind: 'assign_to',    user_id: actParam };
        case 'add_label':    return { kind: 'add_label',    label: actParam };
        case 'set_status':   return { kind: 'set_status',   status: actParam };
        case 'archive':      return { kind: 'archive' };
      }
    })();
    try {
      await createMut.mutateAsync({ name, trigger, action });
      setShowNew(false);
      setName(''); setActParam('high');
    } catch (err) { notify('No se pudo crear', err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (r: AutomationRule) => {
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar regla "${r.name}"?`)) return;
    try { await deleteMut.mutateAsync(r.id); }
    catch (err) { notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error'); }
  };

  // Cuando cambia el tipo de acción, resetear el parámetro a algo válido
  const onChangeActKind = (k: ActionKind) => {
    setActKind(k);
    switch (k) {
      case 'set_priority': setActParam('high'); break;
      case 'assign_to':    setActParam(members[0]?.id ?? ''); break;
      case 'add_label':    setActParam(''); break;
      case 'set_status':   setActParam(stages[0]?.code ?? ''); break;
      case 'archive':      setActParam(''); break;
    }
  };

  const actionOptions = useMemo(() => {
    switch (actKind) {
      case 'set_priority': return PRIORITY_OPTS.map((p) => ({ value: p, label: p }));
      case 'assign_to':    return members.map((m) => ({ value: m.id, label: m.full_name ?? 'Miembro' }));
      case 'set_status':   return stages.map((s) => ({ value: s.code, label: s.label }));
      default:             return [];
    }
  }, [actKind, members, stages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Reglas"
        subtitle={area?.name}
        accent={area?.color}
        fallbackRoute={areaId ? `/boards/${areaId}` : '/boards'}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {rulesQ.isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {rulesQ.error && (
          <Text style={styles.error}>
            {rulesQ.error instanceof Error ? rulesQ.error.message : 'Error cargando reglas'}
          </Text>
        )}

        {rulesQ.data?.length === 0 && !showNew && (
          <Text style={styles.empty}>Sin reglas. Crea una para automatizar el tablero.</Text>
        )}

        {rulesQ.data?.map((r) => (
          <Card key={r.id} padding="md" style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.ruleHead}>
                <Zap size={14} color={tokens.brand[600]} strokeWidth={2.2} />
                <Text style={styles.ruleName} numberOfLines={1}>{r.name}</Text>
              </View>
              <Text style={styles.ruleDesc} numberOfLines={2}>
                {describeRule(r, stages, members)}
              </Text>
            </View>
            <Switch
              value={r.enabled}
              onValueChange={(v) => toggleMut.mutate({ id: r.id, enabled: v })}
            />
            <Pressable onPress={() => handleDelete(r)} hitSlop={6} style={styles.deleteBtn}>
              <Trash2 size={14} color={palette.red[600]} strokeWidth={2} />
            </Pressable>
          </Card>
        ))}

        {showNew ? (
          <Card padding="md" style={{ gap: spacing[2] }}>
            <Text style={styles.ruleName}>Nueva regla</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nombre (ej: Mover a in_review → asignar a QA)"
              placeholderTextColor={tokens.text.muted}
            />

            <Text style={styles.label}>Cuando</Text>
            <Picker
              value={trigKind}
              options={(['created','status_changed_to'] as TriggerKind[]).map((k) => ({ value: k, label: TRIGGER_LABEL[k] }))}
              onChange={(v) => setTrigKind(v as TriggerKind)}
            />
            {trigKind === 'status_changed_to' && (
              <Picker
                value={trigStatus || stages[0]?.code || ''}
                options={stages.map((s) => ({ value: s.code, label: s.label }))}
                onChange={setTrigStatus}
                placeholder="Elegí etapa"
              />
            )}

            <Text style={styles.label}>Hacer</Text>
            <Picker
              value={actKind}
              options={(['set_priority','assign_to','add_label','set_status','archive'] as ActionKind[]).map((k) => ({ value: k, label: ACTION_LABEL[k] }))}
              onChange={(v) => onChangeActKind(v as ActionKind)}
            />
            {actKind === 'add_label' ? (
              <TextInput
                style={styles.input}
                value={actParam}
                onChangeText={setActParam}
                placeholder="Label a agregar"
                placeholderTextColor={tokens.text.muted}
              />
            ) : actKind !== 'archive' && (
              <Picker
                value={actParam}
                options={actionOptions}
                onChange={setActParam}
                placeholder="Elegir"
              />
            )}

            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button onPress={handleCreate} loading={createMut.isPending} size="sm">Crear</Button>
              <Button variant="secondary" onPress={() => setShowNew(false)} size="sm">Cancelar</Button>
            </View>
          </Card>
        ) : (
          <Pressable
            onPress={() => setShowNew(true)}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          >
            <Plus size={14} color={tokens.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Nueva regla</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Picker({
  value, options, onChange, placeholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.pickerRow}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.pickerOpt, active && styles.pickerOptActive]}
          >
            <Text style={[styles.pickerOptText, active && styles.pickerOptTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
      {options.length === 0 && placeholder && (
        <Text style={styles.empty}>{placeholder}</Text>
      )}
    </View>
  );
}

function describeRule(r: AutomationRule, stages: { code: string; label: string }[], members: { id: string; full_name: string | null }[]): string {
  const trig = r.trigger;
  const act = r.action;
  const trigStr = trig.kind === 'created'
    ? 'al crearse una tarea'
    : `al pasar a "${stages.find((s) => s.code === trig.status)?.label ?? trig.status}"`;
  const actStr = (() => {
    switch (act.kind) {
      case 'set_priority': return `prioridad → ${act.priority}`;
      case 'assign_to':    return `asignar a ${members.find((m) => m.id === act.user_id)?.full_name ?? 'usuario'}`;
      case 'add_label':    return `agregar label "${act.label}"`;
      case 'set_status':   return `mover a "${stages.find((s) => s.code === act.status)?.label ?? act.status}"`;
      case 'archive':      return 'archivar';
    }
  })();
  return `${trigStr} → ${actStr}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[2] },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  ruleName: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold as '600', color: tokens.text.primary, flex: 1 },
  ruleDesc: { fontSize: typography.size.xs, color: tokens.text.muted },
  deleteBtn: { padding: 4 },

  label: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  input: {
    borderWidth: 1, borderColor: tokens.border.strong, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: 8,
    fontSize: typography.size.sm, color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },

  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  pickerOpt: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  pickerOptActive: { backgroundColor: palette.brand[50], borderColor: palette.brand[500] },
  pickerOptText: { fontSize: typography.size.sm, color: tokens.text.secondary },
  pickerOptTextActive: { color: palette.brand[700], fontWeight: typography.weight.semibold as '600' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderStyle: 'dashed', borderColor: palette.brand[300],
    borderRadius: radius.md, paddingVertical: 10, marginTop: spacing[2],
    backgroundColor: tokens.bg.surface,
  },
  addBtnPressed: { backgroundColor: palette.brand[50] },
  addBtnText: { color: tokens.brand[600], fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600' },

  empty: { color: tokens.text.muted, fontSize: typography.size.sm, paddingVertical: spacing[2] },
  error: { color: palette.red[600], fontSize: typography.size.sm, paddingVertical: spacing[2] },
});
