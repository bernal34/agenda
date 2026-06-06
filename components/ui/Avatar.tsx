import { Image, StyleSheet, Text, View } from 'react-native';

import { palette, tokens, typography } from '../../constants/theme';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  name?: string | null;
  uri?: string | null;
  size?: Size;
}

const SIZE: Record<Size, { box: number; font: number }> = {
  xs: { box: 20, font: 9 },
  sm: { box: 28, font: 11 },
  md: { box: 36, font: 13 },
  lg: { box: 44, font: 15 },
  xl: { box: 64, font: 22 },
};

function initialsOf(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ name, uri, size = 'md' }: Props) {
  const s = SIZE[size];
  const initials = initialsOf(name);
  return (
    <View style={[styles.box, { width: s.box, height: s.box, borderRadius: s.box / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: s.box, height: s.box, borderRadius: s.box / 2 }} />
      ) : (
        <Text style={[styles.initials, { fontSize: s.font }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: palette.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.brand[700],
    overflow: 'hidden',
  },
  initials: {
    color: tokens.brand.fg,
    fontWeight: typography.weight.semibold as '600',
  },
});
