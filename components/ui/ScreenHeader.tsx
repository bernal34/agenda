import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { spacing, tokens, typography } from '../../constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  accent?: string;          // bordeIzq de color (área/módulo)
  backLabel?: string;       // texto al lado del chevron (default: oculto)
  onBack?: () => void;      // override del back default
  fallbackRoute?: string;   // a dónde ir si no se puede router.back()
  right?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  accent,
  backLabel,
  onBack,
  fallbackRoute = '/',
  right,
}: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallbackRoute as never);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={handleBack} hitSlop={8} style={styles.backBtn}>
        <ChevronLeft size={20} color={tokens.text.secondary} strokeWidth={2} />
        {backLabel && <Text style={styles.backText}>{backLabel}</Text>}
      </Pressable>

      <View style={styles.titleBlock}>
        {accent && <View style={[styles.accentDot, { backgroundColor: accent }]} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
    gap: spacing[2],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
  },
  backText: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  },
  accentDot: { width: 8, height: 8, borderRadius: 4 },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
  },
  rightSlot: {
    minWidth: 24,
    alignItems: 'flex-end',
  },
});
