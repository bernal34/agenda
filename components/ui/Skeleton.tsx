import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius, spacing, tokens } from '../../constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloque gris con pulso, para ocupar el lugar del contenido mientras carga. */
export function Skeleton({ width = '100%', height = 12, rounded = radius.sm, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: rounded, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Silueta de una TaskCard: badge de área, título de dos líneas y pie. */
export function TaskCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={84} height={16} rounded={radius.full} />
      <Skeleton width="90%" height={14} style={{ marginTop: spacing[3] }} />
      <Skeleton width="55%" height={14} style={{ marginTop: spacing[2] }} />
      <View style={styles.cardFooter}>
        <Skeleton width={64} height={10} />
        <Skeleton width={48} height={10} />
      </View>
    </View>
  );
}

/** Silueta de una fila con ícono, título y subtítulo (tableros, canales, avisos). */
export function ListRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={36} height={36} rounded={radius.md} />
      <View style={{ flex: 1 }}>
        <Skeleton width="45%" height={14} />
        <Skeleton width="28%" height={10} style={{ marginTop: spacing[2] }} />
      </View>
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  variant?: 'task' | 'row';
}

/** Reemplaza al ActivityIndicator suelto: mantiene la altura de la lista real. */
export function SkeletonList({ count = 3, variant = 'task' }: SkeletonListProps) {
  const Item = variant === 'task' ? TaskCardSkeleton : ListRowSkeleton;
  return (
    <View accessibilityLabel="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <Item key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: tokens.bg.subtle },
  card: {
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
});
