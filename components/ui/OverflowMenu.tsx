import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { radius, shadow, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

interface Props {
  items: MenuItem[];
  accessibilityLabel?: string;
}

/**
 * Menú de acciones secundarias detrás de un "···".
 *
 * El header del kanban metía cinco botones con texto en un slot pensado para
 * uno: en teléfono se aplastaban o desbordaban. Acá entra todo lo que no es
 * la acción principal.
 */
export function OverflowMenu({ items, accessibilityLabel = 'Más acciones' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const [open, setOpen] = useState(false);

  const run = (item: MenuItem) => {
    setOpen(false);
    item.onPress();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <MoreHorizontal size={16} color={t.text.secondary} strokeWidth={2.2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => run(item)}
                  style={({ pressed }) => [
                    styles.item,
                    idx > 0 && styles.itemBorder,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <Icon size={16} color={t.brand[600]} strokeWidth={2.2} />
                  <Text style={styles.itemText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  triggerPressed: { backgroundColor: t.bg.subtle },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing[4],
  },
  sheet: {
    minWidth: 220,
    backgroundColor: t.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: t.border.default,
    overflow: 'hidden',
    ...shadow.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  itemPressed: { backgroundColor: t.bg.subtle },
  itemText: {
    fontSize: typography.size.base,
    color: t.text.primary,
    fontWeight: typography.weight.medium as '500',
  },
});
