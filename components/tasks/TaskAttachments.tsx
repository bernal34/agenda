import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
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

  const handleDelete = (att: TaskAttachment) => {
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm(`¿Quitar el adjunto "${att.filename}"?`)
        : true;
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
              <ActivityIndicator size="small" color={tokens.brand[600]} />
            ) : (
              <>
                <Upload size={12} color={tokens.brand[600]} strokeWidth={2.4} />
                <Text style={styles.addBtnText}>Adjuntar</Text>
              </>
            )}
          </Pressable>
        }
      />

      {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginVertical: spacing[2] }} />}

      {!isLoading && attachments.length === 0 && (
        <View style={styles.emptyHint}>
          <Paperclip size={12} color={tokens.text.muted} strokeWidth={2} />
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
                <Icon size={16} color={tokens.brand[600]} strokeWidth={2} />
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
              {isOpening && <ActivityIndicator size="small" color={tokens.text.muted} />}
            </Pressable>
            <Pressable
              onPress={() => handleDelete(att)}
              hitSlop={6}
              style={styles.removeBtn}
            >
              <X size={12} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// silence unused image import
void Image;

const styles = StyleSheet.create({
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
    color: tokens.brand[600],
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
    color: tokens.text.muted,
    fontStyle: 'italic',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 8,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    backgroundColor: tokens.bg.surface,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
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
    backgroundColor: palette.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.brand[100],
  },
  iconBoxImage: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[100],
  },
  filename: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
  },
  meta: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
    marginTop: 1,
  },
  removeBtn: { padding: 4 },
});
