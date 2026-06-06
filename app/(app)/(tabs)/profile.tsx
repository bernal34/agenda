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
import { Camera, ChevronRight, LogOut, User, Phone, Mail, Shield } from 'lucide-react-native';

import { useIsAdmin } from '../../../lib/queries/admin';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeader,
} from '../../../components/ui';
import { signOut } from '../../../lib/auth';
import { notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import {
  uploadAvatar,
  useMyProfile,
  useUpdateProfile,
} from '../../../lib/queries/profile';
import { useAuthStore } from '../../../stores/authStore';
import {
  palette,
  radius,
  shadow,
  spacing,
  tokens,
  typography,
} from '../../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const { data: profile, isLoading } = useMyProfile(userId);
  const { data: areas } = useMyAreas(userId);
  const { data: isAdmin } = useIsAdmin();
  const updateMut = useUpdateProfile();

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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Tu cuenta y preferencias</Text>
        </View>
        <Button
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
          loading={updateMut.isPending}
          disabled={!dirty || updateMut.isPending}
          onPress={handleSave}
        >
          Guardar
        </Button>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}

        {/* Identity card */}
        <Card padding="lg" style={styles.identityCard} elevation="card">
          <Pressable onPress={handlePickAvatar} style={styles.avatarWrap}>
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
            placeholder="+54..."
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
              <Text style={styles.areaName}>{a.name}</Text>
              <Badge customColor={a.color}>{a.role}</Badge>
            </Card>
          ))}
        </View>

        {/* Admin link (solo si tenés permisos) */}
        {isAdmin && (
          <Pressable
            onPress={() => router.push('/admin' as never)}
            style={({ pressed }) => [styles.adminLink, pressed && styles.adminLinkPressed]}
          >
            <View style={styles.adminIcon}>
              <Shield size={16} color={palette.brand[600]} strokeWidth={2} />
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
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
    borderRadius: 48,
    backgroundColor: tokens.bg.subtle,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: palette.brand[600],
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.bg.surface,
    ...shadow.soft,
  },
  identityName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  identityEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    borderRadius: radius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    ...shadow.soft,
    marginTop: spacing[3],
  },
  adminLinkPressed: { backgroundColor: tokens.bg.subtle },
  adminIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: palette.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  adminSubtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
  },

  signOutBtn: { marginTop: spacing[2] },
});
