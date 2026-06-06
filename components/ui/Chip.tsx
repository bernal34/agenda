import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { radius, spacing, tokens, typography } from '../../constants/theme';

interface Props {
  label: string;
  active?: boolean;
  color?: string;     // color del módulo/área (para active)
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, active = false, color, onPress, style }: Props) {
  const accent = color ?? tokens.brand[600];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        active
          ? { backgroundColor: accent + '14', borderColor: accent }
          : pressed
            ? { backgroundColor: tokens.bg.subtle, borderColor: tokens.border.strong }
            : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          active ? { color: accent, fontWeight: typography.weight.semibold as '600' } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  text: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
});
