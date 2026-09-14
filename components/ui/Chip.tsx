import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

interface Props {
  label: string;
  active?: boolean;
  color?: string;     // color del módulo/área (para active)
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, active = false, color, onPress, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const accent = color ?? t.brand[600];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        active
          ? { backgroundColor: accent + '14', borderColor: accent }
          : pressed
            ? { backgroundColor: t.bg.subtle, borderColor: t.border.strong }
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

const makeStyles = (t: Tokens) => StyleSheet.create({
  base: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  text: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
});
