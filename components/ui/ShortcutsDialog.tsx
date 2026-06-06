import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Keyboard } from 'lucide-react-native';

import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

export interface ShortcutItem {
  combo: string;
  description: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  shortcuts: ShortcutItem[];
}

function formatKey(combo: string): string[] {
  return combo.split('+').map((k) => {
    if (k === 'cmd') return Platform.OS === 'web' && /Mac/.test(navigator.userAgent ?? '') ? '⌘' : 'Ctrl';
    if (k === 'shift') return '⇧';
    if (k === 'alt') return '⌥';
    if (k === ' ') return 'Espacio';
    return k.toUpperCase();
  });
}

export function ShortcutsDialog({ visible, onClose, shortcuts }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Keyboard size={16} color={tokens.brand[600]} strokeWidth={2.2} />
              <Text style={styles.title}>Atajos de teclado</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={16} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>

          {shortcuts.map((s) => (
            <View key={s.combo} style={styles.row}>
              <Text style={styles.desc}>{s.description}</Text>
              <View style={styles.keysRow}>
                {formatKey(s.combo).map((k, i) => (
                  <View key={`${s.combo}-${i}`} style={styles.key}>
                    <Text style={styles.keyText}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.hint}>
            Solo en web · Tocá ? en cualquier momento para abrir esto
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    padding: spacing[5],
    ...shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
  },
  desc: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
    flex: 1,
  },
  keysRow: { flexDirection: 'row', gap: 4 },
  key: {
    minWidth: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: tokens.bg.subtle,
    borderWidth: 1,
    borderColor: tokens.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  keyText: {
    fontSize: typography.size.xs,
    color: tokens.text.secondary,
    fontWeight: typography.weight.semibold as '600',
    fontVariant: ['tabular-nums'],
  },

  hint: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: spacing[3],
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // unused, keeps palette imported
  _accent: { color: palette.brand[600] },
});
