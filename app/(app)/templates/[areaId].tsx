import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight, Play, Plus, Trash2 } from 'lucide-react-native';

import { Button, Card, ScreenHeader, SectionHeader } from '../../../components/ui';
import { radius, spacing, typography, type Tokens } from '../../../constants/theme';
import { confirmAction, notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import { useBoardStages } from '../../../lib/queries/stages';
import {
  TaskTemplate,
  TemplateItem,
  useAddTemplateItem,
  useApplyTemplate,
  useAreaTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useRemoveTemplateItem,
  useTemplateItems,
} from '../../../lib/queries/templates';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import type { TaskPriority } from '../../../lib/taskModel';

/** El color de prioridad sale del tema en render, no de un const de módulo. */
function priorityOptions(t: Tokens): { value: TaskPriority; label: string; color: string }[] {
  return [
    { value: 'low',    label: 'Baja',    color: t.text.muted },
    { value: 'normal', label: 'Normal',  color: t.status.review },
    { value: 'high',   label: 'Alta',    color: t.status.progress },
    { value: 'urgent', label: 'Urgente', color: t.status.urgent },
  ];
}

export default function AreaTemplatesScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const areasQ = useMyAreas(userId);
  const area = areasQ.data?.find((a) => a.id === areaId);

  const stagesQ = useBoardStages(areaId);
  const firstStage = stagesQ.data?.[0]?.code ?? 'todo';

  const templatesQ = useAreaTemplates(areaId);
  const createMut = useCreateTemplate(areaId);
  const deleteMut = useDeleteTemplate(areaId);
  const applyMut = useApplyTemplate(areaId);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCreate = async () => {
    if (newName.trim().length < 2) { notify('Nombre inválido', 'Mínimo 2 caracteres'); return; }
    try {
      const tpl = await createMut.mutateAsync({ name: newName, description: newDesc });
      setNewName(''); setNewDesc(''); setShowNew(false);
      setExpanded(tpl.id);
    } catch (err) { notify('No se pudo crear', err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (tpl: TaskTemplate) => {
    if (!(await confirmAction(`¿Eliminar la plantilla "${tpl.name}"?`, undefined, 'Eliminar'))) return;
    try { await deleteMut.mutateAsync(tpl.id); }
    catch (err) { notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error'); }
  };

  const handleApply = async (tpl: TaskTemplate) => {
    const confirmed = await confirmAction(
      `¿Aplicar "${tpl.name}"?`,
      'Se crearán todos los items de la plantilla como tareas nuevas.',
      'Aplicar',
    );
    if (!confirmed) return;
    try {
      const n = await applyMut.mutateAsync({ templateId: tpl.id, initialStatus: firstStage });
      notify('Plantilla aplicada', `Se crearon ${n} tarea(s)`);
    } catch (err) { notify('No se pudo aplicar', err instanceof Error ? err.message : 'Error'); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Plantillas"
        subtitle={area?.name}
        accent={area?.color}
        fallbackRoute={areaId ? `/boards/${areaId}` : '/boards'}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {templatesQ.isLoading && <ActivityIndicator color={t.brand[600]} style={{ marginTop: 24 }} />}
        {templatesQ.error && (
          <Text style={styles.error}>
            {templatesQ.error instanceof Error ? templatesQ.error.message : 'Error cargando plantillas'}
          </Text>
        )}

        {templatesQ.data?.length === 0 && !showNew && (
          <Text style={styles.empty}>Sin plantillas todavía. Creá una con el botón de abajo.</Text>
        )}

        {templatesQ.data?.map((tpl) => (
          <Card key={tpl.id} padding="md" style={{ gap: spacing[2] }}>
            <Pressable
              onPress={() => setExpanded(expanded === tpl.id ? null : tpl.id)}
              style={styles.tplHeader}
            >
              {expanded === tpl.id ? (
                <ChevronDown size={14} color={t.text.muted} strokeWidth={2} />
              ) : (
                <ChevronRight size={14} color={t.text.muted} strokeWidth={2} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.tplName}>{tpl.name}</Text>
                {tpl.description && <Text style={styles.tplDesc} numberOfLines={2}>{tpl.description}</Text>}
              </View>
              <Pressable
                onPress={() => handleApply(tpl)}
                disabled={applyMut.isPending}
                style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]}
                hitSlop={6}
              >
                <Play size={12} color={t.brand.fg} strokeWidth={2.4} />
                <Text style={styles.applyBtnText}>Aplicar</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(tpl)}
                disabled={deleteMut.isPending}
                hitSlop={6}
                style={styles.deleteBtn}
              >
                <Trash2 size={14} color={t.feedback.errorFg} strokeWidth={2} />
              </Pressable>
            </Pressable>
            {expanded === tpl.id && <TemplateItems templateId={tpl.id} />}
          </Card>
        ))}

        {showNew ? (
          <Card padding="md" style={{ gap: spacing[2] }}>
            <Text style={styles.tplName}>Nueva plantilla</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre (ej: Onboarding cliente)"
              placeholderTextColor={t.text.muted}
            />
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Descripción opcional"
              placeholderTextColor={t.text.muted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button onPress={handleCreate} loading={createMut.isPending} size="sm">Crear</Button>
              <Button variant="secondary" onPress={() => { setShowNew(false); setNewName(''); setNewDesc(''); }} size="sm">Cancelar</Button>
            </View>
          </Card>
        ) : (
          <Pressable
            onPress={() => setShowNew(true)}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          >
            <Plus size={14} color={t.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Nueva plantilla</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TemplateItems({ templateId }: { templateId: string }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const itemsQ = useTemplateItems(templateId);
  const addMut = useAddTemplateItem(templateId);
  const removeMut = useRemoveTemplateItem(templateId);

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [labelsInput, setLabelsInput] = useState('');

  const options = priorityOptions(t);

  const nextPos = useMemo(
    () => (itemsQ.data?.length ?? 0),
    [itemsQ.data],
  );

  const handleAdd = async () => {
    if (title.trim().length < 2) { notify('Título inválido', 'Mínimo 2 caracteres'); return; }
    const labels = labelsInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await addMut.mutateAsync({ title, description, priority, labels, position: nextPos });
      setTitle(''); setDescription(''); setPriority('normal'); setLabelsInput(''); setShowNew(false);
    } catch (err) { notify('No se pudo agregar', err instanceof Error ? err.message : 'Error'); }
  };

  return (
    <View style={styles.itemsBlock}>
      <SectionHeader title="Items" count={itemsQ.data?.length} />
      {itemsQ.isLoading && <ActivityIndicator color={t.brand[600]} />}
      {itemsQ.data?.length === 0 && !showNew && (
        <Text style={styles.empty}>Sin items.</Text>
      )}
      {itemsQ.data?.map((it: TemplateItem) => {
        const prioColor = options.find((p) => p.value === it.priority)?.color ?? t.status.review;
        return (
          <View key={it.id} style={styles.itemRow}>
            <View style={[styles.prioDot, { backgroundColor: prioColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={2}>{it.title}</Text>
              {it.description && <Text style={styles.itemDesc} numberOfLines={2}>{it.description}</Text>}
              {it.labels.length > 0 && (
                <Text style={styles.itemLabels} numberOfLines={1}>{it.labels.join(' · ')}</Text>
              )}
            </View>
            <Pressable onPress={() => removeMut.mutate(it.id)} hitSlop={6} style={styles.deleteBtn}>
              <Trash2 size={12} color={t.feedback.errorFg} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}

      {showNew ? (
        <View style={styles.newItemBox}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Título del item"
            placeholderTextColor={t.text.muted}
          />
          <TextInput
            style={[styles.input, { height: 60 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción opcional"
            placeholderTextColor={t.text.muted}
            multiline
          />
          <View style={styles.prioRow}>
            {options.map((opt) => {
              const active = priority === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setPriority(opt.value)}
                  style={[styles.prioOpt, active && { backgroundColor: opt.color + '22', borderColor: opt.color }]}
                >
                  <View style={[styles.prioDot, { backgroundColor: opt.color }]} />
                  <Text style={styles.prioOptText}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            value={labelsInput}
            onChangeText={setLabelsInput}
            placeholder="Labels (separadas por coma)"
            placeholderTextColor={t.text.muted}
          />
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Button onPress={handleAdd} loading={addMut.isPending} size="sm">Agregar</Button>
            <Button variant="secondary" onPress={() => setShowNew(false)} size="sm">Cancelar</Button>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowNew(true)}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <Plus size={12} color={t.brand[600]} strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Agregar item</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },
  body: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[3] },

  tplHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tplName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold as '600', color: t.text.primary },
  tplDesc: { fontSize: typography.size.xs, color: t.text.muted, marginTop: 2 },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 6,
    borderRadius: radius.md, backgroundColor: t.brand[600],
  },
  applyBtnPressed: { backgroundColor: t.brand[700] },
  applyBtnText: { color: t.brand.fg, fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600' },
  deleteBtn: { padding: 4 },

  itemsBlock: {
    borderTopWidth: 1, borderTopColor: t.border.subtle,
    paddingTop: spacing[2], gap: spacing[2],
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 6, paddingHorizontal: spacing[2],
    backgroundColor: t.bg.subtle, borderRadius: radius.md,
  },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  itemTitle: { fontSize: typography.size.sm, color: t.text.primary, fontWeight: typography.weight.medium as '500' },
  itemDesc: { fontSize: typography.size.xs, color: t.text.muted, marginTop: 2 },
  itemLabels: { fontSize: typography.size['2xs'], color: t.brand[600], marginTop: 2 },

  newItemBox: {
    gap: spacing[2], padding: spacing[2],
    borderWidth: 1, borderColor: t.brand[100], borderRadius: radius.md,
    backgroundColor: t.brand[50],
  },

  prioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  prioOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  prioOptText: { fontSize: typography.size.xs, color: t.text.secondary },

  input: {
    borderWidth: 1, borderColor: t.border.strong, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: 8,
    fontSize: typography.size.sm, color: t.text.primary,
    backgroundColor: t.bg.surface, textAlignVertical: 'top',
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderStyle: 'dashed', borderColor: t.brand[100],
    borderRadius: radius.md, paddingVertical: 8,
    backgroundColor: t.bg.surface,
  },
  addBtnPressed: { backgroundColor: t.brand[50] },
  addBtnText: { color: t.brand[600], fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600' },

  empty: { color: t.text.muted, fontSize: typography.size.sm, paddingVertical: spacing[2] },
  error: { color: t.feedback.errorFg, fontSize: typography.size.sm, paddingVertical: spacing[2] },
});
