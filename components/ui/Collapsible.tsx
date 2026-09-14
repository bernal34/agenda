import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

interface Props {
  title: string;
  /** Valor actual resumido; se muestra a la derecha cuando está cerrado. */
  summary?: string;
  count?: number;
  /** Modo no controlado. */
  defaultOpen?: boolean;
  /** Modo controlado: si se pasa, manda este valor y no el estado interno. */
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: React.ReactNode;
}

/**
 * Sección plegable. Existe para darle jerarquía a pantallas que apilan muchos
 * bloques del mismo peso: lo que se configura una vez queda cerrado con su
 * valor a la vista, en vez de ocupar alto permanente.
 *
 * El encabezado sigue la tipografía de `SectionHeader` para que abrirlo no se
 * sienta otro nivel de la pantalla.
 */
export function Collapsible({
  title,
  summary,
  count,
  defaultOpen = false,
  open,
  onToggle,
  children,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : selfOpen;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setSelfOpen(next);
    onToggle?.(next);
  };

  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Chevron size={14} color={t.text.muted} strokeWidth={2.2} />
        <Text style={styles.title}>{title}</Text>
        {typeof count === 'number' && <Text style={styles.count}>{count}</Text>}
        {!isOpen && summary ? (
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
      </Pressable>
      {isOpen && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
  },
  headerPressed: { backgroundColor: t.bg.subtle },
  title: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  count: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  summary: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.size.xs,
    color: t.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  body: { paddingBottom: spacing[3], gap: spacing[3] },
});
