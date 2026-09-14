import { useState } from 'react';
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
import { Plus, Trash2 } from 'lucide-react-native';

import { Button, Card, ScreenHeader } from '../../../components/ui';
import { radius, spacing, typography, type Tokens } from '../../../constants/theme';
import { confirmAction, notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import {
  CustomField,
  CustomFieldType,
  useAreaCustomFields,
  useCreateCustomField,
  useDeleteCustomField,
} from '../../../lib/queries/customFields';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';

const TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text',   label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date',   label: 'Fecha' },
  { value: 'select', label: 'Lista' },
  { value: 'url',    label: 'URL' },
];

export default function CustomFieldsScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const areasQ = useMyAreas(userId);
  const area = areasQ.data?.find((a) => a.id === areaId);

  const fieldsQ = useAreaCustomFields(areaId);
  const createMut = useCreateCustomField(areaId);
  const deleteMut = useDeleteCustomField(areaId);

  const [showNew, setShowNew] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [opts, setOpts] = useState('');
  const [required, setRequired] = useState(false);

  const handleCreate = async () => {
    if (label.trim().length < 2) { notify('Nombre inválido', 'Mínimo 2 caracteres'); return; }
    const options = type === 'select'
      ? opts.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    if (type === 'select' && (!options || options.length === 0)) {
      notify('Faltan opciones', 'Separá con comas'); return;
    }
    try {
      await createMut.mutateAsync({ label, type, options, required });
      setLabel(''); setOpts(''); setType('text'); setRequired(false); setShowNew(false);
    } catch (err) { notify('No se pudo crear', err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (f: CustomField) => {
    if (
      !(await confirmAction(
        `¿Eliminar el campo "${f.label}"?`,
        'Se borran también los valores guardados.',
        'Eliminar',
      ))
    ) return;
    try { await deleteMut.mutateAsync(f.id); }
    catch (err) { notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error'); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Campos personalizados"
        subtitle={area?.name}
        accent={area?.color}
        fallbackRoute={areaId ? `/boards/${areaId}` : '/boards'}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {fieldsQ.isLoading && <ActivityIndicator color={t.brand[600]} style={{ marginTop: 24 }} />}
        {fieldsQ.error && (
          <Text style={styles.error}>
            {fieldsQ.error instanceof Error ? fieldsQ.error.message : 'Error cargando campos'}
          </Text>
        )}

        {fieldsQ.data?.length === 0 && !showNew && (
          <Text style={styles.empty}>Sin campos. Agregá uno con el botón de abajo.</Text>
        )}

        {fieldsQ.data?.map((f) => (
          <Card key={f.id} padding="md" style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldMeta}>
                {TYPE_OPTIONS.find((opt) => opt.value === f.type)?.label}
                {f.required ? ' · obligatorio' : ''}
                {f.type === 'select' && f.options && f.options.length > 0
                  ? ` · ${f.options.join(', ')}`
                  : ''}
              </Text>
            </View>
            <Pressable onPress={() => handleDelete(f)} hitSlop={6} style={styles.deleteBtn}>
              <Trash2 size={14} color={t.feedback.errorFg} strokeWidth={2} />
            </Pressable>
          </Card>
        ))}

        {showNew ? (
          <Card padding="md" style={{ gap: spacing[2] }}>
            <Text style={styles.fieldLabel}>Nuevo campo</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Etiqueta (ej: Cliente)"
              placeholderTextColor={t.text.muted}
            />
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setType(opt.value)}
                    style={[styles.typeOpt, active && styles.typeOptActive]}
                  >
                    <Text style={[styles.typeOptText, active && styles.typeOptTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {type === 'select' && (
              <TextInput
                style={styles.input}
                value={opts}
                onChangeText={setOpts}
                placeholder="Opciones separadas por coma"
                placeholderTextColor={t.text.muted}
              />
            )}
            <View style={styles.switchRow}>
              <Switch value={required} onValueChange={setRequired} />
              <Text style={styles.switchLabel}>Obligatorio</Text>
            </View>
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
            <Plus size={14} color={t.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Nuevo campo</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },
  body: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fieldLabel: { fontSize: typography.size.sm, color: t.text.primary, fontWeight: typography.weight.semibold as '600' },
  fieldMeta: { fontSize: typography.size.xs, color: t.text.muted, marginTop: 2 },
  deleteBtn: { padding: 4 },

  input: {
    borderWidth: 1, borderColor: t.border.strong, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: 8,
    fontSize: typography.size.sm, color: t.text.primary,
    backgroundColor: t.bg.surface,
  },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  typeOpt: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  typeOptActive: { backgroundColor: t.brand[50], borderColor: t.brand[500] },
  typeOptText: { fontSize: typography.size.sm, color: t.text.secondary },
  typeOptTextActive: { color: t.brand[700], fontWeight: typography.weight.semibold as '600' },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  switchLabel: { fontSize: typography.size.sm, color: t.text.primary },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderStyle: 'dashed', borderColor: t.brand[100],
    borderRadius: radius.md, paddingVertical: 10, marginTop: spacing[2],
    backgroundColor: t.bg.surface,
  },
  addBtnPressed: { backgroundColor: t.brand[50] },
  addBtnText: { color: t.brand[600], fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600' },

  empty: { color: t.text.muted, fontSize: typography.size.sm, paddingVertical: spacing[2] },
  error: { color: t.feedback.errorFg, fontSize: typography.size.sm, paddingVertical: spacing[2] },
});
