import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { radius, shadow, spacing, tokens } from '../../constants/theme';

type Padding = 'none' | 'sm' | 'md' | 'lg';
type Elevation = 'none' | 'soft' | 'card';

interface Props extends ViewProps {
  padding?: Padding;
  elevation?: Elevation;
  accent?: string;          // bordeIzq de 3px (color del módulo/área)
  onPress?: () => void;
  pressable?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PADDING: Record<Padding, number> = {
  none: 0,
  sm:   spacing[3],
  md:   spacing[4],
  lg:   spacing[5],
};

export function Card({
  padding = 'md',
  elevation = 'soft',
  accent,
  onPress,
  pressable,
  style,
  children,
  ...rest
}: Props) {
  const containerStyle = [
    styles.base,
    { padding: PADDING[padding] },
    elevation !== 'none' && shadow[elevation],
    accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
    style,
  ];

  if (onPress || pressable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={containerStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  pressed: { backgroundColor: tokens.bg.subtle },
});
