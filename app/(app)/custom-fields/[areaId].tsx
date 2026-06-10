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
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';
import { notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import {
  CustomField,
  CustomFieldType,
  useAreaCustomFields,
  useCreateCustomField,
  useDeleteCustomField,
} from '../../../lib/queries/customFields';
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
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar campo "${f.label}"? Se borran también los valores guardados.`)) return;
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
        {fieldsQ.isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
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
                {TYPE_OPTIONS.find((t) => t.value === f.type)?.label}
                {f.required ? ' · obligatorio' : ''}
                {f.type === 'select' && f.options && f.options.length > 0
                  ? ` · ${f.options.join(', ')}`
                  : ''}
              </Text>
            </View>
            <Pressable onPress={() => handleDelete(f)} hitSlop={6} style={styles.deleteBtn}>
              <Trash2 size={14} color={palette.red[600]} strokeWidth={2} />
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
              placeholderTextColor={tokens.text.muted}
            />
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((t) => {
                const active = type === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setType(t.value)}
                    style={[styles.typeOpt, active && { backgroundColor: palette.brand[50], borderColor: palette.brand[500] }]}
                  >
                    <Text style={[styles.typeOptText, active && { color: palette.brand[700], fontWeight: typography.weight.semibold as '600' }]}>
                      {t.label}
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
                placeholderTextColor={tokens.text.muted}
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
            <Plus size={14} color={tokens.brand[600]} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Nuevo campo</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fieldLabel: { fontSize: typography.size.sm, color: tokens.text.primary, fontWeight: typography.weight.semibold as '600' },
  fieldMeta: { fontSize: typography.size.xs, color: tokens.text.muted, marginTop: 2 },
  deleteBtn: { padding: 4 },

  input: {
    borderWidth: 1, borderColor: tokens.border.strong, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: 8,
    fontSize: typography.size.sm, color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  typeOpt: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  typeOptText: { fontSize: typography.size.sm, color: tokens.text.secondary },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  switchLabel: { fontSize: typography.size.sm, color: tokens.text.primary },

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
