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
import { Send } from 'lucide-react-native';

import { ScreenHeader } from '../../../../components/ui';
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
  palette,
  radius,
  shadow,
  spacing,
  tokens,
  typography,
} from '../../../../constants/theme';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function displayName(p: MemberProfile | undefined, fallback: string) {
  if (!p) return fallback;
  return p.full_name?.trim() || fallback;
}

export default function ChannelScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const userId = useAuthStore((s) => s.user?.id);

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
          {messagesQ.isLoading && (
            <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />
          )}
          {messagesQ.error && (
            <Text style={styles.error}>
              {messagesQ.error instanceof Error ? messagesQ.error.message : 'Error cargando mensajes'}
            </Text>
          )}
          {messagesQ.data?.length === 0 && (
            <Text style={styles.empty}>Sé el primero en escribir en este canal.</Text>
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
            placeholderTextColor={tokens.text.muted}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            {sendMut.isPending ? (
              <ActivityIndicator color={tokens.brand.fg} size="small" />
            ) : (
              <Send size={16} color={tokens.brand.fg} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },

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
    backgroundColor: palette.brand[600],
    borderBottomRightRadius: radius.xs,
  },
  bubbleOther: {
    backgroundColor: tokens.bg.surface,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  bubbleAuthor: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.secondary,
    marginBottom: 2,
  },
  bodyMine: {
    color: tokens.brand.fg,
    fontSize: typography.size.base,
    lineHeight: 19,
  },
  bodyOther: {
    color: tokens.text.primary,
    fontSize: typography.size.base,
    lineHeight: 19,
  },
  timeMine: {
    color: palette.brand[200],
    fontSize: typography.size['2xs'],
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeOther: {
    color: tokens.text.muted,
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
    backgroundColor: tokens.bg.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.border.subtle,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },
  sendBtn: {
    backgroundColor: palette.brand[600],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  sendBtnDisabled: { backgroundColor: palette.brand[300] },
  sendBtnPressed: { backgroundColor: palette.brand[700] },

  error: { color: palette.red[600], fontSize: typography.size.sm, padding: spacing[4], textAlign: 'center' },
  empty: { color: tokens.text.muted, fontSize: typography.size.sm, textAlign: 'center', padding: spacing[6] },
});
