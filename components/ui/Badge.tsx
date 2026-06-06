import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { palette, radius, spacing, tokens, typography } from '../../constants/theme';

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

const TONE_BG: Record<BadgeTone, string> = {
  neutral: palette.slate[100],
  brand:   palette.brand[100],
  success: palette.emerald[100],
  warning: palette.amber[100],
  danger:  palette.red[100],
  info:    palette.sky[100],
};

const TONE_FG: Record<BadgeTone, string> = {
  neutral: palette.slate[700],
  brand:   palette.brand[700],
  success: palette.emerald[700],
  warning: palette.amber[700],
  danger:  palette.red[700],
  info:    palette.sky[700],
};

const TONE_SOLID: Record<BadgeTone, string> = {
  neutral: palette.slate[600],
  brand:   palette.brand[600],
  success: palette.emerald[600],
  warning: palette.amber[600],
  danger:  palette.red[600],
  info:    palette.sky[600],
};

export function Badge({ tone = 'neutral', variant = 'soft', customColor, children, style }: Props) {
  let bg = TONE_BG[tone];
  let fg = TONE_FG[tone];
  let borderColor: string | undefined;

  if (variant === 'solid') {
    bg = customColor ?? TONE_SOLID[tone];
    fg = tokens.brand.fg;
  } else if (variant === 'outline') {
    bg = tokens.bg.surface;
    fg = customColor ?? TONE_FG[tone];
    borderColor = customColor ?? TONE_FG[tone];
  } else if (customColor) {
    bg = customColor + '1A'; // 10% alpha
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

const styles = StyleSheet.create({
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
