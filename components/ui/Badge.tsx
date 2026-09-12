import { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { palette, radius, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

type Variant = 'soft' | 'solid' | 'outline';

interface Props {
  tone?: BadgeTone;
  variant?: Variant;
  customColor?: string; // sobrescribe tone (para colores por área)
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Los tonos se invierten con el tema: en claro, fondo pálido y texto oscuro;
 * en oscuro, fondo profundo y texto claro. Con los valores fijos de antes, un
 * badge neutro quedaba como un bloque blanco sobre la pantalla oscura.
 */
function makeTones(scheme: 'light' | 'dark') {
  if (scheme === 'dark') {
    return {
      bg: {
        neutral: palette.slate[700],
        brand:   '#2A2550',
        success: '#0F2A1F',
        warning: '#2A2110',
        danger:  '#2A1618',
        info:    '#0F2233',
      } as Record<BadgeTone, string>,
      fg: {
        neutral: palette.slate[200],
        brand:   palette.brand[300],
        success: palette.emerald[200],
        warning: palette.amber[200],
        danger:  palette.red[300],
        info:    palette.sky[200],
      } as Record<BadgeTone, string>,
      solid: {
        neutral: palette.slate[600],
        brand:   palette.brand[500],
        success: palette.emerald[600],
        warning: palette.amber[600],
        danger:  palette.red[600],
        info:    palette.sky[600],
      } as Record<BadgeTone, string>,
    };
  }
  return {
    bg: {
      neutral: palette.slate[100],
      brand:   palette.brand[100],
      success: palette.emerald[100],
      warning: palette.amber[100],
      danger:  palette.red[100],
      info:    palette.sky[100],
    } as Record<BadgeTone, string>,
    fg: {
      neutral: palette.slate[700],
      brand:   palette.brand[700],
      success: palette.emerald[700],
      warning: palette.amber[700],
      danger:  palette.red[700],
      info:    palette.sky[700],
    } as Record<BadgeTone, string>,
    solid: {
      neutral: palette.slate[600],
      brand:   palette.brand[600],
      success: palette.emerald[600],
      warning: palette.amber[600],
      danger:  palette.red[600],
      info:    palette.sky[600],
    } as Record<BadgeTone, string>,
  };
}

export function Badge({ tone = 'neutral', variant = 'soft', customColor, children, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t, scheme } = useTheme();
  const tones = useMemo(() => makeTones(scheme), [scheme]);

  let bg = tones.bg[tone];
  let fg = tones.fg[tone];
  let borderColor: string | undefined;

  if (variant === 'solid') {
    bg = customColor ?? tones.solid[tone];
    fg = palette.white;
  } else if (variant === 'outline') {
    bg = t.bg.surface;
    fg = customColor ?? tones.fg[tone];
    borderColor = customColor ?? tones.fg[tone];
  } else if (customColor) {
    bg = customColor + (scheme === 'dark' ? '33' : '1A');
    fg = customColor;
  }

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg },
        borderColor && { borderWidth: 1, borderColor },
        style,
      ]}
    >
      <Text style={[styles.text, { color: fg }]}>{children}</Text>
    </View>
  );
}

const makeStyles = (_t: Tokens) => StyleSheet.create({
  base: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    letterSpacing: 0.1,
  },
});
