import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MessageSquare, Send } from 'lucide-react-native';

import { Button, Card, EmptyState, ScreenHeader, Skeleton } from '../../../../components/ui';
import { notify } from '../../../../lib/notify';
import {
  ChannelMessage,
  MemberProfile,
  useChannelMembers,
  useChannelMessages,
  useMyChannels,
  useSendMessage,
} from '../../../../lib/queries/channels';
import { useAuthStore } from '../../../../stores/authStore';
import {
  radius,
  spacing,
  typography,
  type Tokens,
} from '../../../../constants/theme';
import { useTheme, useThemedStyles } from '../../../../lib/theme';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function displayName(p: MemberProfile | undefined, fallback: string) {
  if (!p) return fallback;
  return p.full_name?.trim() || fallback;
}

/** Burbujas fantasma: la conversación aparece con su forma, no con un spinner. */
function MessagesSkeleton() {
  const styles = useThemedStyles(makeStyles);
  const widths = ['62%', '45%', '70%', '38%'] as const;
  return (
    <View accessibilityLabel="Cargando mensajes">
      {widths.map((w, i) => (
        <View
          key={i}
          style={[styles.bubbleRow, i % 2 === 1 ? styles.rowMine : styles.rowOther]}
        >
          <Skeleton width={w} height={38} rounded={radius.xl} />
        </View>
      ))}
    </View>
  );
}

export default function ChannelScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();

  const channelsQ = useMyChannels(userId);
  const messagesQ = useChannelMessages(channelId);
  const membersQ = useChannelMembers(channelId);
  const sendMut = useSendMessage(channelId);

  const channel = channelsQ.data?.find((c) => c.id === channelId);
  const memberMap = useMemo(() => {
    const m = new Map<string, MemberProfile>();
    (membersQ.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [membersQ.data]);

  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (messagesQ.data && messagesQ.data.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messagesQ.data?.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await sendMut.mutateAsync({ body });
    } catch (err) {
      setDraft(body);
      notify('No se pudo enviar', err instanceof Error ? err.message : 'Error');
    }
  };

  const canSend = !sendMut.isPending && draft.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={channel?.name ?? 'Canal'}
        subtitle={channel?.area?.name}
        accent={channel?.area?.color}
        fallbackRoute="/chat"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messagesQ.isLoading && <MessagesSkeleton />}
          {messagesQ.error && (
            <Card padding="md" style={styles.errorCard}>
              <Text style={styles.errorText}>
                {messagesQ.error instanceof Error ? messagesQ.error.message : 'Error cargando mensajes'}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => messagesQ.refetch()}
                style={{ marginTop: spacing[3], alignSelf: 'flex-start' }}
              >
                Reintentar
              </Button>
            </Card>
          )}
          {messagesQ.data?.length === 0 && !messagesQ.error && (
            <EmptyState
              icon={MessageSquare}
              title="Sin mensajes"
              description="Sé el primero en escribir en este canal."
            />
          )}
          {messagesQ.data?.map((m: ChannelMessage, idx) => {
            const isMine = m.author_id === userId;
            const author = memberMap.get(m.author_id);
            const name = isMine ? 'Vos' : displayName(author, 'Miembro');
            const prev = messagesQ.data?.[idx - 1];
            const sameSender = prev && prev.author_id === m.author_id;
            const showAuthor = !isMine && !sameSender;
            return (
              <View
                key={m.id}
                style={[
                  styles.bubbleRow,
                  isMine ? styles.rowMine : styles.rowOther,
                  sameSender && { marginTop: 2 },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  {showAuthor && <Text style={styles.bubbleAuthor}>{name}</Text>}
                  <Text style={isMine ? styles.bodyMine : styles.bodyOther}>{m.body}</Text>
                  <Text style={isMine ? styles.timeMine : styles.timeOther}>
                    {formatTime(m.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribí un mensaje..."
            placeholderTextColor={t.text.muted}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Enviar mensaje"
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            {sendMut.isPending ? (
              <ActivityIndicator color={t.brand.fg} size="small" />
            ) : (
              <Send size={16} color={t.brand.fg} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },

  list: { padding: spacing[4], paddingBottom: spacing[6] },
  bubbleRow: { flexDirection: 'row', marginVertical: spacing[1] },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
  },
  bubbleMine: {
    backgroundColor: t.brand[600],
    borderBottomRightRadius: radius.xs,
  },
  bubbleOther: {
    backgroundColor: t.bg.surface,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  bubbleAuthor: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.secondary,
    marginBottom: 2,
  },
  bodyMine: {
    color: t.brand.fg,
    fontSize: typography.size.base,
    lineHeight: 19,
  },
  bodyOther: {
    color: t.text.primary,
    fontSize: typography.size.base,
    lineHeight: 19,
  },
  // La burbuja propia es superficie de marca en los dos esquemas, así que la
  // hora va sobre ese púrpura: un tinte claro de marca, no el gris del tema.
  timeMine: {
    color: t.brand[100],
    fontSize: typography.size['2xs'],
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeOther: {
    color: t.text.muted,
    fontSize: typography.size['2xs'],
    marginTop: 2,
    alignSelf: 'flex-end',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: t.bg.surface,
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    color: t.text.primary,
    backgroundColor: t.bg.surface,
  },
  sendBtn: {
    backgroundColor: t.brand[600],
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: t.brand[100] },
  sendBtnPressed: { backgroundColor: t.brand[700] },

  errorCard: {
    backgroundColor: t.feedback.errorBg,
    borderColor: t.border.default,
  },
  errorText: { color: t.feedback.errorFg, fontSize: typography.size.sm },
});
