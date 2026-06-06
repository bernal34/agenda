import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X, Tag } from 'lucide-react-native';

import { SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { colorForLabel } from '../../lib/labelColor';
import { notify } from '../../lib/notify';
import {
  useAddLabel,
  useAreaLabels,
  useRemoveLabel,
  useTaskLabels,
} from '../../lib/queries/labels';

interface Props {
  taskId: string;
  areaId: string | undefined;
}

export function TaskLabels({ taskId, areaId }: Props) {
  const { data: labels = [], isLoading } = useTaskLabels(taskId);
  const { data: areaLabels = [] } = useAreaLabels(areaId);
  const addMut = useAddLabel(taskId);
  const removeMut = useRemoveLabel(taskId);

  const [draft, setDraft] = useState('');
  const [showInput, setShowInput] = useState(false);

  const suggestions = areaLabels
    .filter((l) => !labels.includes(l) && (draft === '' || l.startsWith(draft.toLowerCase())))
    .slice(0, 6);

  const handleAdd = async (label: string) => {
    const norm = label.trim().toLowerCase();
    if (norm.length < 1) return;
    if (labels.includes(norm)) {
      setDraft('');
      return;
    }
    try {
      await addMut.mutateAsync(norm);
      setDraft('');
    } catch (err) {
      notify('No se pudo agregar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleRemove = (label: string) => {
    removeMut.mutate(label, {
      onError: (err) =>
        notify('No se pudo quitar', err instanceof Error ? err.message : 'Error'),
    });
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Etiquetas"
        count={labels.length || undefined}
        right={
          !showInput ? (
            <Pressable onPress={() => setShowInput(true)} hitSlop={6} style={styles.addToggle}>
              <Plus size={12} color={tokens.brand[600]} strokeWidth={2.4} />
              <Text style={styles.addToggleText}>Agregar</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.labelsRow}>
        {!isLoading && labels.length === 0 && !showInput && (
          <View style={styles.emptyHint}>
            <Tag size={12} color={tokens.text.muted} strokeWidth={2} />
            <Text style={styles.emptyHintText}>Sin etiquetas</Text>
          </View>
        )}
        {labels.map((label) => {
          const c = colorForLabel(label);
          return (
            <View
              key={label}
              style={[styles.labelPill, { backgroundColor: c.bg }]}
            >
              <Text style={[styles.labelText, { color: c.fg }]}>{label}</Text>
              <Pressable onPress={() => handleRemove(label)} hitSlop={6}>
                <X size={11} color={c.fg} strokeWidth={2.4} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {showInput && (
        <>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ej: urgente, cliente-x, q1..."
              placeholderTextColor={tokens.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={() => handleAdd(draft)}
            />
            <Pressable
              onPress={() => handleAdd(draft)}
              disabled={draft.trim().length < 1 || addMut.isPending}
              style={({ pressed }) => [
                styles.addBtn,
                (draft.trim().length < 1 || addMut.isPending) && styles.addBtnDisabled,
                pressed && styles.addBtnPressed,
              ]}
            >
              <Plus size={14} color={tokens.brand.fg} strokeWidth={2.4} />
            </Pressable>
            <Pressable
              onPress={() => { setShowInput(false); setDraft(''); }}
              hitSlop={6}
              style={styles.cancelBtn}
            >
              <X size={14} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestRow}>
              <Text style={styles.suggestLabel}>Usadas:</Text>
              {suggestions.map((s) => {
                const c = colorForLabel(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => handleAdd(s)}
                    style={[styles.suggestPill, { backgroundColor: c.bg }]}
                  >
                    <Text style={[styles.suggestText, { color: c.fg }]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[1] },

  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  addToggleText: {
    fontSize: typography.size.xs,
    color: tokens.brand[600],
    fontWeight: typography.weight.semibold as '600',
  },

  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 28,
    paddingVertical: 2,
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  labelText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    letterSpacing: 0.1,
  },

  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyHintText: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontStyle: 'italic',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },
  addBtn: {
    backgroundColor: palette.brand[600],
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: palette.brand[300] },
  addBtnPressed: { backgroundColor: palette.brand[700] },
  cancelBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[2],
  },
  suggestLabel: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: spacing[1],
  },
  suggestPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.sm,
    opacity: 0.7,
  },
  suggestText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium as '500',
  },
});
