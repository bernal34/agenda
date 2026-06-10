import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, ListChecks, Search, User, X } from 'lucide-react-native';

import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';
import { SearchHit, useGlobalSearch } from '../../lib/queries/search';
import { Avatar } from './Avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SearchDialog({ visible, onClose }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { data, isFetching, error } = useGlobalSearch(q);

  useEffect(() => {
    if (visible) {
      setQ('');
      // pequeño delay para que el modal monte antes del focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [visible]);

  const grouped = useMemo(() => {
    const tasks = (data ?? []).filter((h) => h.kind === 'task');
    const areas = (data ?? []).filter((h) => h.kind === 'area');
    const people = (data ?? []).filter((h) => h.kind === 'person');
    return { tasks, areas, people };
  }, [data]);

  const handlePick = (h: SearchHit) => {
    onClose();
    if (h.kind === 'task') router.push(`/tasks/${h.id}` as never);
    else if (h.kind === 'area') router.push(`/boards/${h.id}` as never);
    // person: por ahora no hay screen de perfil ajeno → no-op
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Search size={16} color={tokens.text.muted} strokeWidth={2} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={q}
              onChangeText={setQ}
              placeholder="Buscar tareas, tableros, personas..."
              placeholderTextColor={tokens.text.muted}
              autoFocus
            />
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {q.trim().length < 2 && (
              <Text style={styles.hint}>Escribí al menos 2 caracteres.</Text>
            )}
            {isFetching && q.length >= 2 && (
              <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 12 }} />
            )}
            {error && (
              <Text style={styles.error}>
                {error instanceof Error ? error.message : 'Error en la búsqueda'}
              </Text>
            )}

            {data && data.length === 0 && q.length >= 2 && !isFetching && (
              <Text style={styles.hint}>Sin resultados.</Text>
            )}

            {grouped.tasks.length > 0 && <SectionTitle label="Tareas" />}
            {grouped.tasks.map((h) => (
              <Pressable
                key={`t-${h.id}`}
                onPress={() => handlePick(h)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconBox, { backgroundColor: (h.area_color ?? palette.brand[500]) + '1A' }]}>
                  <ListChecks size={14} color={h.area_color ?? palette.brand[600]} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {h.area_name ?? 'Sin tablero'} · {h.status}
                  </Text>
                </View>
              </Pressable>
            ))}

            {grouped.areas.length > 0 && <SectionTitle label="Tableros" />}
            {grouped.areas.map((h) => (
              <Pressable
                key={`a-${h.id}`}
                onPress={() => handlePick(h)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconBox, { backgroundColor: h.color + '1A' }]}>
                  <LayoutGrid size={14} color={h.color} strokeWidth={2} />
                </View>
                <Text style={styles.rowTitle}>{h.name}</Text>
              </Pressable>
            ))}

            {grouped.people.length > 0 && <SectionTitle label="Personas" />}
            {grouped.people.map((h) => (
              <Pressable
                key={`p-${h.id}`}
                onPress={() => handlePick(h)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Avatar name={h.full_name ?? 'Persona'} uri={h.avatar_url} size="xs" />
                <Text style={styles.rowTitle} numberOfLines={1}>{h.full_name ?? 'Sin nombre'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  card: {
    width: '92%',
    maxWidth: 560,
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
    gap: spacing[2],
  },
  input: {
    flex: 1,
    fontSize: typography.size.base,
    color: tokens.text.primary,
    paddingVertical: 6,
  },
  closeBtn: { padding: 4 },
  results: { maxHeight: 480, paddingHorizontal: spacing[2], paddingVertical: spacing[2] },
  hint: { color: tokens.text.muted, fontSize: typography.size.sm, padding: spacing[3], textAlign: 'center' },
  error: { color: palette.red[600], fontSize: typography.size.sm, padding: spacing[3] },

  sectionTitle: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: palette.brand[50] },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    fontWeight: typography.weight.semibold as '600',
    flex: 1,
  },
  rowSub: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 2,
  },
});
