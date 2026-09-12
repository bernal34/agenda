import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Hash, MessageSquare, Inbox, User, Users } from 'lucide-react-native';

import {
  Button,
  Card,
  EmptyState,
  SkeletonList,
  TabHeader,
} from '../../../../components/ui';
import { MyChannel, useMyChannels } from '../../../../lib/queries/channels';
import { useAuthStore } from '../../../../stores/authStore';
import { radius, spacing, tokens, typography } from '../../../../constants/theme';

const KIND_ICON = {
  area:   Hash,
  direct: User,
  group:  Users,
} as const;

const KIND_LABEL = {
  area:   'Canal de área',
  direct: 'Mensaje directo',
  group:  'Grupo',
} as const;

export default function ChatIndex() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const { data: channels, isLoading, error, refetch } = useMyChannels(userId);

  const count = channels?.length ?? 0;
  const subtitle = count > 0 ? `${count} ${count === 1 ? 'canal' : 'canales'}` : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Chats" subtitle={subtitle} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <SkeletonList count={4} variant="row" />}
        {error && (
          <Card style={styles.errorCard} padding="md">
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando canales'}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => refetch()}
              style={{ marginTop: spacing[3], alignSelf: 'flex-start' }}
            >
              Reintentar
            </Button>
          </Card>
        )}
        {count === 0 && !isLoading && !error && (
          <EmptyState
            icon={Inbox}
            title="Sin canales"
            description="Cada área crea su canal automáticamente. Si no ves ninguno, todavía no sos miembro de un área."
          />
        )}
        {channels?.map((c: MyChannel) => {
          const tone = c.area?.color ?? tokens.brand[600];
          const Icon = KIND_ICON[c.kind] ?? MessageSquare;
          return (
            <Card
              key={c.id}
              onPress={() => router.push(`/chat/${c.id}` as never)}
              accent={tone}
              padding="md"
              style={styles.row}
            >
              <View style={[styles.iconBox, { backgroundColor: tone + '1A' }]}>
                <Icon size={18} color={tone} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {c.area?.name ?? KIND_LABEL[c.kind]}
                </Text>
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

  errorCard: {
    backgroundColor: tokens.feedback.errorBg,
    borderColor: tokens.border.default,
  },
  errorText: { color: tokens.feedback.errorFg, fontSize: typography.size.sm },
});
