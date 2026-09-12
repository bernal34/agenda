import { StyleSheet, Text, View } from 'react-native';

import { spacing, tokens, typography } from '../../constants/theme';

interface Props {
  title: string;
  /** Una línea de contexto: conteos, estado del filtro. Mejor un dato que un adorno. */
  subtitle?: string;
  right?: React.ReactNode;
}

/**
 * Encabezado de las pantallas de tab. Antes cada una repetía el mismo bloque
 * con sus propios paddings y tamaños; esto fija la jerarquía en un solo lugar.
 */
export function TabHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    marginTop: spacing[1],
  },
});
