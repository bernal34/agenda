import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { palette, radius, shadow, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme } from '../../lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Button({
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  style,
  children,
}: Props) {
  const { t } = useTheme();
  const variants = useMemo(() => makeVariants(t), [t]);

  const isDisabled = disabled || loading;
  const v = variants[variant];
  const s = SIZE[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        s.container,
        v.container,
        fullWidth && { alignSelf: 'stretch' },
        pressed && !isDisabled && v.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} />
      ) : (
        <View style={styles.row}>
          {Icon && <Icon size={s.icon} color={v.fg} strokeWidth={2} />}
          <Text style={[styles.text, s.text, { color: v.fg }]}>{children}</Text>
          {IconRight && <IconRight size={s.icon} color={v.fg} strokeWidth={2} />}
        </View>
      )}
    </Pressable>
  );
}

// Geometría y tipografía no dependen del tema, así que siguen estáticas.
const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  text: {
    fontWeight: typography.weight.semibold as '600',
    letterSpacing: -0.1,
  },
  disabled: { opacity: 0.5 },
});

const SIZE: Record<Size, { container: ViewStyle; text: { fontSize: number }; icon: number }> = {
  sm: {
    container: { height: 32, paddingHorizontal: spacing[3] },
    text:      { fontSize: typography.size.sm },
    icon:      14,
  },
  md: {
    container: { height: 40, paddingHorizontal: spacing[4] },
    text:      { fontSize: typography.size.sm },
    icon:      16,
  },
  lg: {
    container: { height: 48, paddingHorizontal: spacing[5] },
    text:      { fontSize: typography.size.base },
    icon:      18,
  },
};

/** Los colores sí dependen del tema, por eso esto es una función y no un const. */
function makeVariants(t: Tokens): Record<Variant, {
  container: ViewStyle;
  pressed: ViewStyle;
  fg: string;
  spinner: string;
}> {
  return {
    primary: {
      container: { backgroundColor: t.brand[600], ...shadow.soft },
      pressed:   { backgroundColor: t.brand[700] },
      fg:        t.brand.fg,
      spinner:   t.brand.fg,
    },
    secondary: {
      container: {
        backgroundColor: t.bg.surface,
        borderWidth: 1,
        borderColor: t.border.strong,
      },
      pressed:   { backgroundColor: t.bg.subtle },
      fg:        t.text.primary,
      spinner:   t.text.primary,
    },
    danger: {
      container: { backgroundColor: palette.red[600], ...shadow.soft },
      pressed:   { backgroundColor: palette.red[700] },
      fg:        palette.white,
      spinner:   palette.white,
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      pressed:   { backgroundColor: t.bg.subtle },
      fg:        t.text.secondary,
      spinner:   t.text.secondary,
    },
  };
}
