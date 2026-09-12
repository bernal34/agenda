import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { spacing, typography, type Tokens } from '../../constants/theme';
import { useThemedStyles } from '../../lib/theme';

interface Props {
  title: string;
  count?: number;
  accent?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, count, accent, right, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.row, style]}>
      {accent && <View style={[styles.dot, { backgroundColor: accent }]} />}
      <Text style={styles.title}>{title}</Text>
      {typeof count === 'number' && <Text style={styles.count}>{count}</Text>}
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
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
});
