import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Paperclip,
  Upload,
  X,
  FileText,
  FileImage,
  File as FileIcon,
} from 'lucide-react-native';

import { SectionHeader } from '../ui';
import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import { confirmAction, notify } from '../../lib/notify';
import { useTheme, useThemedStyles } from '../../lib/theme';
import {
  TaskAttachment,
  getAttachmentUrl,
  useDeleteAttachment,
  useTaskAttachments,
  useUploadAttachment,
} from '../../lib/queries/attachments';

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

interface Props {
  taskId: string;
}

function iconForMime(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith('image/')) return FileImage;
  if (mime.startsWith('text/') || mime === 'application/pdf') return FileText;
  return FileIcon;
}

function formatBytes(n: number | null) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatStamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function TaskAttachments({ taskId }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const { data: attachments = [], isLoading } = useTaskAttachments(taskId);
  const uploadMut = useUploadAttachment();
  const deleteMut = useDeleteAttachment();

  const [opening, setOpening] = useState<string | null>(null);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > MAX_SIZE_BYTES) {
        notify('Archivo muy grande', `Máximo ${MAX_SIZE_BYTES / 1024 / 1024} MB.`);
        return;
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      await uploadMut.mutateAsync({
        taskId,
        blob,
        filename: asset.name || 'archivo',
        mimeType: asset.mimeType ?? null,
      });
    } catch (err) {
      notify('No se pudo adjuntar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleOpen = async (att: TaskAttachment) => {
    setOpening(att.id);
    try {
      const url = await getAttachmentUrl(att.storage_path);
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      notify('No se pudo abrir', err instanceof Error ? err.message : 'Error');
    } finally {
      setOpening(null);
    }
  };

  const handleDelete = async (att: TaskAttachment) => {
    const confirmed = await confirmAction(`¿Quitar el adjunto "${att.filename}"?`, undefined, 'Quitar');
    if (!confirmed) return;
    deleteMut.mutate(att, {
      onError: (err) =>
        notify('No se pudo quitar', err instanceof Error ? err.message : 'Error'),
    });
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Adjuntos"
        count={attachments.length || undefined}
        right={
          <Pressable
            onPress={handlePick}
            disabled={uploadMut.isPending}
            hitSlop={6}
            style={[styles.addBtn, uploadMut.isPending && styles.addBtnDisabled]}
          >
            {uploadMut.isPending ? (
              <ActivityIndicator size="small" color={t.brand[600]} />
            ) : (
              <>
                <Upload size={12} color={t.brand[600]} strokeWidth={2.4} />
                <Text style={styles.addBtnText}>Adjuntar</Text>
              </>
            )}
          </Pressable>
        }
      />

      {isLoading && <ActivityIndicator color={t.brand[600]} style={{ marginVertical: spacing[2] }} />}

      {!isLoading && attachments.length === 0 && (
        <View style={styles.emptyHint}>
          <Paperclip size={12} color={t.text.muted} strokeWidth={2} />
          <Text style={styles.emptyHintText}>Sin archivos · 25 MB máximo</Text>
        </View>
      )}

      {attachments.map((att) => {
        const Icon = iconForMime(att.mime_type);
        const isImage = att.mime_type?.startsWith('image/');
        const isOpening = opening === att.id;
        return (
          <View key={att.id} style={styles.row}>
            <Pressable
              onPress={() => handleOpen(att)}
              style={[styles.rowMain, isOpening && { opacity: 0.5 }]}
            >
              <View style={[styles.iconBox, isImage && styles.iconBoxImage]}>
                <Icon
                  size={16}
                  color={isImage ? t.status.review : t.brand[600]}
                  strokeWidth={2}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.filename} numberOfLines={1}>
                  {att.filename}
                </Text>
                <Text style={styles.meta}>
                  {formatBytes(att.size_bytes)}
                  {att.size_bytes && ' · '}
                  {formatStamp(att.uploaded_at)}
                </Text>
              </View>
              {isOpening && <ActivityIndicator size="small" color={t.text.muted} />}
            </Pressable>
            <Pressable
              onPress={() => handleDelete(att)}
              hitSlop={6}
              style={styles.removeBtn}
            >
              <X size={12} color={t.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[1] },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: {
    fontSize: typography.size.xs,
    color: t.brand[600],
    fontWeight: typography.weight.semibold as '600',
  },

  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing[2],
  },
  emptyHintText: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    fontStyle: 'italic',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 8,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    backgroundColor: t.bg.surface,
    borderWidth: 1,
    borderColor: t.border.subtle,
    marginBottom: 6,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: t.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.brand[100],
  },
  iconBoxImage: {
    backgroundColor: t.status.review + '1A',
    borderColor: t.status.review + '33',
  },
  filename: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
  },
  meta: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    fontWeight: typography.weight.medium as '500',
    marginTop: 1,
  },
  removeBtn: { padding: 4 },
});
