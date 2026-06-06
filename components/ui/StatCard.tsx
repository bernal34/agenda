import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

interface Props {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  accent?: string;
  trend?: { value: string; positive?: boolean };
}

export function StatCard({ label, value, icon: Icon, accent, trend }: Props) {
  const tone = accent ?? tokens.brand[600];
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {Icon && (
          <View style={[styles.iconBox, { backgroundColor: tone + '1A' }]}>
            <Icon size={14} color={tone} strokeWidth={2.2} />
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      {trend && (
        <Text
          style={[
            styles.trend,
            { color: trend.positive ? palette.emerald[600] : palette.red[600] },
          ]}
        >
          {trend.value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    ...shadow.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  label: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.5,
  },
  trend: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    marginTop: spacing[1],
  },
});
