import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ShieldAlert,
  Crown,
  Shield,
  Users,
  X,
  ChevronRight,
  Check,
} from 'lucide-react-native';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ScreenHeader,
  SectionHeader,
} from '../../components/ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import {
  AdminProfile,
  MemberAssignment,
  useAdminAreas,
  useAdminProfiles,
  useAssignMember,
  useIsAdmin,
  useUnassignMember,
  useUserAreaMemberships,
} from '../../lib/queries/admin';
import { useMyProfile } from '../../lib/queries/profile';
import { notify } from '../../lib/notify';
import { useAuthStore } from '../../stores/authStore';

const ROLES: { value: MemberAssignment['role']; label: string; icon: any; color: string }[] = [
  { value: 'owner',  label: 'Owner',  icon: Crown,  color: palette.amber[600] },
  { value: 'admin',  label: 'Admin',  icon: Shield, color: palette.sky[600] },
  { value: 'member', label: 'Member', icon: Users,  color: palette.slate[600] },
];

export default function AdminScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const { data: profile } = useMyProfile(userId);
  const { data: isAdmin, isLoading: loadingAdmin } = useIsAdmin();
  const { data: profiles = [], isLoading: loadingProfiles } = useAdminProfiles(profile?.org_id ?? undefined);
  const { data: areas = [] } = useAdminAreas();

  const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);

  if (loadingAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Administración" fallbackRoute="/" />
        <View style={styles.unauthorized}>
          <View style={styles.unauthorizedIcon}>
            <ShieldAlert size={24} color={palette.amber[600]} strokeWidth={2} />
          </View>
          <Text style={styles.unauthorizedTitle}>Acceso restringido</Text>
          <Text style={styles.unauthorizedDesc}>
            Solo super-admins pueden gestionar usuarios y áreas. Hablá con un administrador si necesitás acceso.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Administración"
        subtitle={`${profiles.length} usuarios · ${areas.length} áreas compartidas`}
        fallbackRoute="/"
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loadingProfiles && (
          <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />
        )}

        {!loadingProfiles && profiles.length === 0 && (
          <EmptyState
            icon={Users}
            title="Sin usuarios"
            description="Cuando alguien se registre, lo vas a ver acá."
          />
        )}

        <SectionHeader title="Usuarios" count={profiles.length || undefined} />

        {profiles.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setSelectedUser(p)}
            style={({ pressed }) => [styles.userRow, pressed && styles.userRowPressed]}
          >
            <Avatar name={p.full_name} uri={p.avatar_url} size="md" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userName}>{p.full_name?.trim() || 'Sin nombre'}</Text>
              <Text style={styles.userStatus}>
                {p.status === 'active' || p.status === null ? 'Activo' : p.status}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.text.muted} strokeWidth={2} />
          </Pressable>
        ))}

        {/* Sheet de gestión de membresías */}
        {selectedUser && (
          <UserMembershipsSheet
            user={selectedUser}
            areas={areas}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UserMembershipsSheet({
  user,
  areas,
  onClose,
}: {
  user: AdminProfile;
  areas: ReturnType<typeof useAdminAreas>['data'];
  onClose: () => void;
}) {
  const { data: memberships = [] } = useUserAreaMemberships(user.id);
  const assignMut = useAssignMember();
  const unassignMut = useUnassignMember();

  const membershipMap = new Map(memberships.map((m) => [m.area_id, m]));

  const handleAssign = (areaId: string, role: MemberAssignment['role']) => {
    assignMut.mutate(
      { user_id: user.id, area_id: areaId, role },
      { onError: (err) => notify('Error', err instanceof Error ? err.message : 'No se pudo asignar') },
    );
  };

  const handleUnassign = (areaId: string, areaName: string) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`¿Sacar a ${user.full_name ?? 'este usuario'} de "${areaName}"?`)
      : true;
    if (!confirmed) return;
    unassignMut.mutate(
      { user_id: user.id, area_id: areaId },
      { onError: (err) => notify('Error', err instanceof Error ? err.message : 'No se pudo quitar') },
    );
  };

  return (
    <Card padding="md" elevation="card" style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleRow}>
          <Avatar name={user.full_name} uri={user.avatar_url} size="md" />
          <View>
            <Text style={styles.sheetTitle}>{user.full_name?.trim() || 'Sin nombre'}</Text>
            <Text style={styles.sheetSubtitle}>Asignación de áreas</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={16} color={tokens.text.muted} strokeWidth={2} />
        </Pressable>
      </View>

      {(areas ?? []).length === 0 ? (
        <Text style={styles.empty}>No hay áreas compartidas todavía.</Text>
      ) : (
        (areas ?? []).map((a) => {
          const m = membershipMap.get(a.id);
          return (
            <View key={a.id} style={styles.areaRow}>
              <View style={[styles.areaDot, { backgroundColor: a.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.areaName}>{a.name}</Text>
                <Text style={styles.areaCount}>
                  {a.member_count} {a.member_count === 1 ? 'miembro' : 'miembros'}
                </Text>
              </View>
              {m ? (
                <View style={styles.roleControls}>
                  <RoleSelector
                    current={m.role}
                    onChange={(r) => handleAssign(a.id, r)}
                  />
                  <Pressable
                    onPress={() => handleUnassign(a.id, a.name)}
                    hitSlop={6}
                    style={styles.removeBtn}
                  >
                    <X size={12} color={palette.red[600]} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleAssign(a.id, 'member')}
                  style={({ pressed }) => [styles.assignBtn, pressed && styles.assignBtnPressed]}
                >
                  <Text style={styles.assignBtnText}>Asignar</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </Card>
  );
}

function RoleSelector({
  current,
  onChange,
}: {
  current: MemberAssignment['role'];
  onChange: (r: MemberAssignment['role']) => void;
}) {
  return (
    <View style={styles.roleSelector}>
      {ROLES.map((r) => {
        const active = current === r.value;
        return (
          <Pressable
            key={r.value}
            onPress={() => onChange(r.value)}
            style={[
              styles.roleBtn,
              active && { backgroundColor: r.color + '1A', borderColor: r.color },
            ]}
          >
            {active && <Check size={10} color={r.color} strokeWidth={2.4} />}
            <Text style={[
              styles.roleBtnText,
              active && { color: r.color, fontWeight: typography.weight.semibold as '600' },
            ]}>
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[10] },

  unauthorized: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  unauthorizedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  unauthorizedTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    marginBottom: spacing[1],
  },
  unauthorizedDesc: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: tokens.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    marginBottom: spacing[2],
  },
  userRowPressed: { backgroundColor: tokens.bg.subtle },
  userName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  userStatus: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
    fontWeight: typography.weight.medium as '500',
  },

  sheet: { marginTop: spacing[3] },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sheetTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 1,
  },

  empty: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[4],
    fontStyle: 'italic',
  },

  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
  },
  areaDot: { width: 8, height: 8, borderRadius: 4 },
  areaName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
  },
  areaCount: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    marginTop: 1,
    fontWeight: typography.weight.medium as '500',
  },

  roleControls: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  roleSelector: { flexDirection: 'row', gap: 2 },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  roleBtnText: {
    fontSize: 10,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.red[200],
  },

  assignBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[200],
  },
  assignBtnPressed: { backgroundColor: palette.brand[100] },
  assignBtnText: {
    fontSize: typography.size.xs,
    color: tokens.brand[600],
    fontWeight: typography.weight.semibold as '600',
  },
});

// Mantener Badge importado para futuras revisiones
void Badge;
