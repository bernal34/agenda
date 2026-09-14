import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  return (
    <View style={styles.wrap}>
      {Icon && (
        <View style={styles.iconBox}>
          <Icon size={22} color={t.text.muted} strokeWidth={1.6} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.desc}>{description}</Text>}
      {action && <View style={{ marginTop: spacing[3] }}>{action}</View>}
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  wrap: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: t.bg.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    textAlign: 'center',
  },
  desc: {
    fontSize: typography.size.sm,
    color: t.text.muted,
    textAlign: 'center',
    marginTop: spacing[1],
    maxWidth: 280,
  },
});
