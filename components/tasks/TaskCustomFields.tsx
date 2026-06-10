import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import {
  CustomField,
  useAreaCustomFields,
  useSetCustomValue,
  useTaskCustomValues,
} from '../../lib/queries/customFields';

interface Props {
  taskId: string;
  areaId: string | undefined;
}

export function TaskCustomFields({ taskId, areaId }: Props) {
  const fieldsQ = useAreaCustomFields(areaId);
  const valuesQ = useTaskCustomValues(taskId);
  const setMut = useSetCustomValue(taskId);

  const fields = fieldsQ.data ?? [];
  if (fields.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Campos" count={fields.length} />
      {fields.map((f) => (
        <FieldEditor
          key={f.id}
          field={f}
          value={valuesQ.data?.[f.id] ?? null}
          onSave={(v) =>
            setMut.mutateAsync({ fieldId: f.id, value: v }).catch((err) => {
              notify('No se pudo guardar', err instanceof Error ? err.message : 'Error');
            })
          }
        />
      ))}
    </View>
  );
}

function FieldEditor({
  field,
  value,
  onSave,
}: {
  field: CustomField;
  value: unknown;
  onSave: (v: unknown) => Promise<void> | void;
}) {
  const initial = value == null ? '' : String(value);
  const [draft, setDraft] = useState(initial);

  useEffect(() => { setDraft(initial); }, [initial]);

  const commit = (raw: string) => {
    if (raw === initial) return;
    if (field.type === 'number') {
      const n = raw.trim() === '' ? null : Number(raw);
      if (n !== null && Number.isNaN(n)) {
        notify('Número inválido', `El campo "${field.label}" espera un número`);
        return;
      }
      onSave(n);
    } else if (raw.trim() === '') {
      onSave(null);
    } else {
      onSave(raw.trim());
    }
  };

  if (field.type === 'select') {
    const options = field.options ?? [];
    const current = value == null ? null : String(value);
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
        <View style={styles.optionsRow}>
          {options.map((opt) => {
            const active = current === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onSave(active ? null : opt)}
                style={[styles.opt, active && styles.optActive]}
              >
                <Text style={[styles.optText, active && styles.optTextActive]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => commit(draft)}
        onSubmitEditing={() => commit(draft)}
        placeholder={placeholderFor(field.type)}
        placeholderTextColor={tokens.text.muted}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        autoCapitalize={field.type === 'url' ? 'none' : 'sentences'}
        autoCorrect={field.type !== 'url'}
      />
    </View>
  );
}

function placeholderFor(t: CustomField['type']): string {
  switch (t) {
    case 'number': return '0';
    case 'date':   return 'YYYY-MM-DD';
    case 'url':    return 'https://...';
    default:       return '';
  }
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[2] },
  field: { gap: spacing[1] },
  label: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  opt: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  optActive: { backgroundColor: palette.brand[50], borderColor: palette.brand[500] },
  optText: { fontSize: typography.size.sm, color: tokens.text.secondary },
  optTextActive: { color: palette.brand[700], fontWeight: typography.weight.semibold as '600' },
});
