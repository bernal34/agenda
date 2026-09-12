import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Bell, Camera, ChevronRight, LogOut, User, Phone, Mail, Shield } from 'lucide-react-native';

import { useIsAdmin } from '../../../lib/queries/admin';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeader,
  SkeletonList,
  TabHeader,
} from '../../../components/ui';
import { signOut } from '../../../lib/auth';
import { notify } from '../../../lib/notify';
import { MyArea, useMyAreas } from '../../../lib/queries/areas';
import { usePushStatus, useTogglePush, type PushStatus } from '../../../lib/queries/push';
import {
  uploadAvatar,
  useMyProfile,
  useUpdateProfile,
} from '../../../lib/queries/profile';
import { useAuthStore } from '../../../stores/authStore';
import {
  radius,
  spacing,
  tokens,
  typography,
} from '../../../constants/theme';

const PUSH_COPY: Record<PushStatus, string> = {
  enabled: 'Recibes avisos aunque la app esté cerrada.',
  disabled: 'Actívalos para enterarte de asignaciones, menciones y recordatorios.',
  denied: 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador o del teléfono.',
  'needs-install':
    'En iPhone, agrega Mi Agenda a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.',
  unsupported: 'Este dispositivo o navegador no admite notificaciones push.',
};

const ROLE_LABEL: Record<MyArea['role'], string> = {
  owner:  'Owner',
  admin:  'Admin',
  member: 'Miembro',
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const { data: profile, isLoading, error, refetch } = useMyProfile(userId);
  const { data: areas } = useMyAreas(userId);
  const { data: isAdmin } = useIsAdmin();
  const updateMut = useUpdateProfile();
  const { data: pushStatus } = usePushStatus(userId);
  const pushMut = useTogglePush(userId);

  const handleTogglePush = async () => {
    try {
      const next = await pushMut.mutateAsync(pushStatus !== 'enabled');
      if (next === 'denied') notify('Avisos bloqueados', PUSH_COPY.denied);
    } catch (err) {
      notify('No se pudo cambiar', err instanceof Error ? err.message : 'Error');
    }
  };

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setPhone(profile.phone ?? '');
    setDirty(false);
  }, [profile]);

  const handleSave = async () => {
    if (!userId) return;
    try {
      await updateMut.mutateAsync({
        id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      setDirty(false);
      notify('Listo', 'Perfil actualizado');
    } catch (err) {
      notify('No se pudo guardar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handlePickAvatar = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Sin permiso', 'Necesitamos acceso a la galería para subir tu avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const url = await uploadAvatar({ userId, blob, ext });
      await updateMut.mutateAsync({ id: userId, avatar_url: url });
    } catch (err) {
      notify('No se pudo subir', err instanceof Error ? err.message : 'Error');
    } finally {
      setUploading(false);
    }
  };

  const displayedName = profile?.full_name?.trim() || user?.email?.split('@')[0] || '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader
        title="Perfil"
        subtitle="Tu cuenta y preferencias"
        right={
          <Button
            variant={dirty ? 'primary' : 'secondary'}
            size="sm"
            loading={updateMut.isPending}
            disabled={!dirty || updateMut.isPending}
            onPress={handleSave}
          >
            Guardar
          </Button>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && <SkeletonList count={3} variant="row" />}

        {error && (
          <Card padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando tu perfil'}
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

        {!isLoading && !error && (
          <>
            {/* Identity card */}
            <Card padding="lg" style={styles.identityCard} elevation="card">
              <Pressable
                onPress={handlePickAvatar}
                style={styles.avatarWrap}
                accessibilityLabel="Cambiar foto de perfil"
              >
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarLg} />
                ) : (
                  <Avatar name={displayedName} size="xl" />
                )}
                <View style={styles.cameraBadge}>
                  {uploading ? (
                    <ActivityIndicator color={tokens.brand.fg} size="small" />
                  ) : (
                    <Camera size={14} color={tokens.brand.fg} strokeWidth={2.2} />
                  )}
                </View>
              </Pressable>
              <Text style={styles.identityName}>{displayedName}</Text>
              <View style={styles.identityEmail}>
                <Mail size={12} color={tokens.text.muted} strokeWidth={2} />
                <Text style={styles.identityEmailText}>{user?.email}</Text>
              </View>
            </Card>

            {/* Form fields */}
            <View style={styles.formSection}>
              <Input
                label="Nombre completo"
                icon={User}
                value={fullName}
                onChangeText={(v) => { setFullName(v); setDirty(true); }}
                placeholder="Tu nombre y apellido"
              />
              <Input
                label="Teléfono"
                icon={Phone}
                value={phone}
                onChangeText={(v) => { setPhone(v); setDirty(true); }}
                placeholder="+52..."
                keyboardType="phone-pad"
              />
            </View>

            {/* Areas */}
            <View style={styles.section}>
              <SectionHeader title="Mis áreas" count={areas?.length} />
              {areas && areas.length === 0 && (
                <EmptyState title="Sin áreas asignadas" description="Hablá con tu admin para sumarte a un área." />
              )}
              {areas?.map((a) => (
                <Card key={a.id} padding="md" accent={a.color} style={styles.areaRow}>
                  <Text style={styles.areaName} numberOfLines={1}>{a.name}</Text>
                  <Badge customColor={a.color}>
                    {a.personal ? 'Personal' : ROLE_LABEL[a.role]}
                  </Badge>
                </Card>
              ))}
            </View>

            {/* Push notifications de este dispositivo */}
            <View style={styles.section}>
              <SectionHeader title="Notificaciones" />
              <Card padding="md" style={styles.pushCard}>
                <View style={styles.pushIcon}>
                  <Bell size={16} color={tokens.brand[600]} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pushTitle}>Avisos en este dispositivo</Text>
                  <Text style={styles.pushSubtitle}>
                    {pushStatus ? PUSH_COPY[pushStatus] : 'Revisando…'}
                  </Text>
                </View>
                {(pushStatus === 'enabled' || pushStatus === 'disabled') && (
                  <Button
                    variant={pushStatus === 'enabled' ? 'secondary' : 'primary'}
                    size="sm"
                    loading={pushMut.isPending}
                    disabled={pushMut.isPending}
                    onPress={handleTogglePush}
                  >
                    {pushStatus === 'enabled' ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
              </Card>
            </View>

            {/* Admin link (solo si tenés permisos) */}
            {isAdmin && (
              <Pressable
                onPress={() => router.push('/admin' as never)}
                style={({ pressed }) => [styles.adminLink, pressed && styles.adminLinkPressed]}
              >
                <View style={styles.adminIcon}>
                  <Shield size={16} color={tokens.brand[600]} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminTitle}>Administración</Text>
                  <Text style={styles.adminSubtitle}>Usuarios y permisos</Text>
                </View>
                <ChevronRight size={16} color={tokens.text.muted} strokeWidth={2} />
              </Pressable>
            )}

            {/* Sign out */}
            <Button
              variant="secondary"
              icon={LogOut}
              onPress={() => signOut()}
              fullWidth
              style={styles.signOutBtn}
            >
              Cerrar sesión
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },

  identityCard: {
    alignItems: 'center',
  },
  avatarWrap: { position: 'relative', marginBottom: spacing[3] },
  avatarLg: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: tokens.bg.subtle,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: tokens.brand[600],
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.bg.surface,
  },
  identityName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.3,
  },
  identityEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  identityEmailText: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },

  formSection: { gap: spacing[3] },
  section: { gap: spacing[1] },

  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  areaName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
    flex: 1,
  },

  adminLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    marginTop: spacing[3],
  },
  adminLinkPressed: { backgroundColor: tokens.bg.subtle },
  adminIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: tokens.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  adminSubtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
  },

  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pushIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: tokens.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  pushSubtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 2,
    lineHeight: 16,
  },

  errorCard: {
    backgroundColor: tokens.feedback.errorBg,
    borderColor: tokens.border.default,
  },
  errorText: { color: tokens.feedback.errorFg, fontSize: typography.size.sm },

  signOutBtn: { marginTop: spacing[2] },
});
