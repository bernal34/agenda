import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, MessageSquare, Inbox } from 'lucide-react-native';

import { Card, EmptyState } from '../../../../components/ui';
import { useMyChannels } from '../../../../lib/queries/channels';
import { useAuthStore } from '../../../../stores/authStore';
import { palette, radius, spacing, tokens, typography } from '../../../../constants/theme';

export default function ChatIndex() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const { data: channels, isLoading, error } = useMyChannels(userId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>Conversaciones por área</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {error && (
          <Card style={styles.errorCard} padding="md">
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando canales'}
            </Text>
          </Card>
        )}
        {channels?.length === 0 && !isLoading && (
          <EmptyState
            icon={Inbox}
            title="Sin canales"
            description="Todavía no estás en ningún canal."
          />
        )}
        {channels?.map((c) => {
          const tone = c.area?.color ?? tokens.brand[600];
          return (
            <Card
              key={c.id}
              onPress={() => router.push(`/chat/${c.id}` as never)}
              accent={tone}
              padding="md"
              style={styles.row}
            >
              <View style={[styles.iconBox, { backgroundColor: tone + '1A' }]}>
                <MessageSquare size={18} color={tone} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.area && <Text style={styles.sub}>{c.area.name}</Text>}
              </View>
              <ChevronRight size={18} color={tokens.text.muted} strokeWidth={2} />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
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

  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  sub: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 2,
    fontWeight: typography.weight.medium as '500',
  },

  errorCard: { borderColor: palette.red[200], backgroundColor: palette.red[50] },
  errorText: { color: palette.red[700], fontSize: typography.size.sm },
});
