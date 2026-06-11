import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, Search, UserMinus, UserPlus } from 'lucide-react-native';

import { Avatar, Card, EmptyState, ScreenHeader, SectionHeader } from '../../../components/ui';
import { palette, radius, spacing, tokens, typography } from '../../../constants/theme';
import { notify } from '../../../lib/notify';
import { useMyAreas } from '../../../lib/queries/areas';
import {
  AreaCandidate,
  AreaMemberRole,
  useAddAreaMember,
  useAreaCandidates,
  useRemoveAreaMember,
  useUpdateAreaMemberRole,
} from '../../../lib/queries/areaMembers';
import { useAuthStore } from '../../../stores/authStore';

const ROLE_LABEL: Record<AreaMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Miembro',
};

const ROLE_OPTIONS: AreaMemberRole[] = ['member', 'admin', 'owner'];

export default function AreaMembersScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const areasQ = useMyAreas(userId);
  const area = areasQ.data?.find((a) => a.id === areaId);

  const candQ = useAreaCandidates(areaId);
  const addMut = useAddAreaMember(areaId);
  const removeMut = useRemoveAreaMember(areaId);
  const roleMut = useUpdateAreaMemberRole(areaId);

  const [q, setQ] = useState('');
  const [roleOpenFor, setRoleOpenFor] = useState<string | null>(null);

  const { members, others } = useMemo(() => {
    const data = candQ.data ?? [];
    const search = q.trim().toLowerCase();
    const filt = (c: AreaCandidate) =>
      !search || (c.full_name ?? '').toLowerCase().includes(search);
    return {
      members: data.filter((c) => c.is_member && filt(c)),
      others: data.filter((c) => !c.is_member && filt(c)),
    };
  }, [candQ.data, q]);

  const onAdd = async (c: AreaCandidate) => {
    try {
      await addMut.mutateAsync({ userId: c.id, role: 'member' });
    } catch (err) {
      notify('No se pudo agregar', err instanceof Error ? err.message : 'Error');
    }
  };

  const onRemove = async (c: AreaCandidate) => {
    if (typeof window !== 'undefined' && !window.confirm(`¿Quitar a ${c.full_name ?? 'este miembro'}?`)) return;
    try {
      await removeMut.mutateAsync(c.id);
    } catch (err) {
      notify('No se pudo quitar', err instanceof Error ? err.message : 'Error');
    }
  };

  const onChangeRole = async (c: AreaCandidate, role: AreaMemberRole) => {
    setRoleOpenFor(null);
    if (c.member_role === role) return;
    try {
      await roleMut.mutateAsync({ userId: c.id, role });
    } catch (err) {
      notify('No se pudo cambiar el rol', err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Miembros"
        subtitle={area?.name}
        accent={area?.color}
        fallbackRoute={areaId ? `/boards/${areaId}` : '/boards'}
      />

      <View style={styles.searchBar}>
        <Search size={14} color={tokens.text.muted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nombre"
          placeholderTextColor={tokens.text.muted}
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {candQ.isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {candQ.error && (
          <Text style={styles.error}>
            {candQ.error instanceof Error ? candQ.error.message : 'Error cargando usuarios'}
          </Text>
        )}

        <SectionHeader title="En el tablero" count={members.length} />
        {members.length === 0 && !candQ.isLoading && (
          <Text style={styles.empty}>Sin miembros todavía.</Text>
        )}
        {members.map((c) => {
          const role = (c.member_role ?? 'member') as AreaMemberRole;
          const isOpen = roleOpenFor === c.id;
          return (
            <Card key={c.id} padding="md" style={styles.row}>
              <Avatar name={c.full_name ?? 'Miembro'} uri={c.avatar_url} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{c.full_name ?? 'Sin nombre'}</Text>
                <Pressable
                  onPress={() => setRoleOpenFor(isOpen ? null : c.id)}
                  style={styles.roleBtn}
                  hitSlop={6}
                >
                  <Text style={styles.roleText}>{ROLE_LABEL[role]}</Text>
                  <ChevronDown size={12} color={tokens.text.muted} strokeWidth={2} />
                </Pressable>
                {isOpen && (
                  <View style={styles.roleMenu}>
                    {ROLE_OPTIONS.map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => onChangeRole(c, r)}
                        style={({ pressed }) => [
                          styles.roleOption,
                          pressed && { backgroundColor: palette.brand[50] },
                        ]}
                      >
                        <Text style={styles.roleOptionText}>{ROLE_LABEL[r]}</Text>
                        {role === r && <Check size={12} color={palette.brand[600]} strokeWidth={2.2} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => onRemove(c)}
                hitSlop={6}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                disabled={removeMut.isPending}
              >
                <UserMinus size={14} color={palette.red[600]} strokeWidth={2} />
              </Pressable>
            </Card>
          );
        })}

        <SectionHeader title="Agregar de la organización" count={others.length} />
        {others.length === 0 && !candQ.isLoading && (
          <EmptyState
            title={candQ.data ? 'No hay más usuarios' : ''}
            description={candQ.data ? 'Todos los empleados ya están en el tablero o no hay coincidencias.' : ''}
          />
        )}
        {others.map((c) => (
          <Card key={c.id} padding="md" style={styles.row}>
            <Avatar name={c.full_name ?? 'Usuario'} uri={c.avatar_url} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{c.full_name ?? 'Sin nombre'}</Text>
              <Text style={styles.subtle}>No es miembro</Text>
            </View>
            <Pressable
              onPress={() => onAdd(c)}
              hitSlop={6}
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              disabled={addMut.isPending}
            >
              <UserPlus size={14} color={tokens.brand.fg} strokeWidth={2.2} />
              <Text style={styles.addBtnText}>Agregar</Text>
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.app },
  body: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[2] },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    backgroundColor: tokens.bg.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: tokens.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
  },
  subtle: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: 2,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleText: {
    fontSize: typography.size.xs,
    color: tokens.text.secondary,
    fontWeight: typography.weight.medium as '500',
  },
  roleMenu: {
    marginTop: spacing[1],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    borderRadius: radius.md,
    backgroundColor: tokens.bg.surface,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
    minWidth: 120,
  },
  roleOptionText: {
    fontSize: typography.size.sm,
    color: tokens.text.primary,
  },
  iconBtn: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.red[200],
    backgroundColor: palette.red[50],
  },
  iconBtnPressed: { backgroundColor: palette.red[100] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: palette.brand[600],
  },
  addBtnPressed: { backgroundColor: palette.brand[700] },
  addBtnText: {
    color: tokens.brand.fg,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
  },
  empty: {
    color: tokens.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
  error: { color: palette.red[600], fontSize: typography.size.sm, padding: spacing[2] },
});
