import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, X, UserPlus, Crown, Shield } from 'lucide-react-native';

import { Avatar, SectionHeader } from '../ui';
import { palette, radius, spacing, tokens, typography } from '../../constants/theme';
import { notify } from '../../lib/notify';
import {
  AreaMember,
  useAddAssignee,
  useAreaMembers,
  useRemoveAssignee,
  useTaskAssignees,
} from '../../lib/queries/assignees';

interface Props {
  taskId: string;
  areaId: string | undefined;
  currentUserId: string | undefined;
}

export function TaskAssignees({ taskId, areaId, currentUserId }: Props) {
  const { data: assignees = [], isLoading } = useTaskAssignees(taskId);
  const { data: members = [] } = useAreaMembers(areaId);
  const addMut = useAddAssignee(taskId);
  const removeMut = useRemoveAssignee(taskId);

  const [picking, setPicking] = useState(false);

  const assignedIds = new Set(assignees.map((a) => a.id));
  const available = members.filter((m) => !assignedIds.has(m.id));

  const handleAdd = (userId: string) => {
    addMut.mutate(userId, {
      onError: (err) =>
        notify('No se pudo asignar', err instanceof Error ? err.message : 'Error'),
    });
  };

  const handleRemove = (userId: string, name: string) => {
    const isSelf = userId === currentUserId;
    const confirmMsg = isSelf
      ? '¿Sacarte como asignado de esta tarea?'
      : `¿Sacar a ${name} de la tarea?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;
    removeMut.mutate(userId, {
      onError: (err) =>
        notify('No se pudo quitar', err instanceof Error ? err.message : 'Error'),
    });
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Asignados"
        count={assignees.length || undefined}
        right={
          available.length > 0 && !picking ? (
            <Pressable onPress={() => setPicking(true)} hitSlop={6} style={styles.addToggle}>
              <UserPlus size={12} color={tokens.brand[600]} strokeWidth={2.4} />
              <Text style={styles.addToggleText}>Asignar</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Lista de asignados actuales */}
      {!isLoading && assignees.length === 0 && (
        <Text style={styles.empty}>Nadie asignado todavía.</Text>
      )}
      {assignees.map((a) => {
        const isSelf = a.id === currentUserId;
        const name = a.full_name?.trim() || 'Miembro';
        return (
          <View key={a.id} style={styles.row}>
            <Avatar name={name} uri={a.avatar_url} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {name}
                {isSelf && <Text style={styles.youHint}>  · vos</Text>}
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemove(a.id, name)}
              hitSlop={6}
              style={styles.removeBtn}
            >
              <X size={12} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}

      {/* Picker */}
      {picking && (
        <View style={styles.picker}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Asignar a alguien del área</Text>
            <Pressable onPress={() => setPicking(false)} hitSlop={6}>
              <X size={14} color={tokens.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
          {available.length === 0 ? (
            <Text style={styles.empty}>Todos los miembros del área ya están asignados.</Text>
          ) : (
            available.map((m) => (
              <PickerRow key={m.id} member={m} onAdd={() => handleAdd(m.id)} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

function PickerRow({ member, onAdd }: { member: AreaMember; onAdd: () => void }) {
  const name = member.full_name?.trim() || 'Miembro';
  return (
    <Pressable
      onPress={onAdd}
      style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
    >
      <Avatar name={name} uri={member.avatar_url} size="sm" />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.roleRow}>
          {member.role === 'owner' && (
            <>
              <Crown size={10} color={palette.amber[600]} strokeWidth={2.2} />
              <Text style={[styles.roleText, { color: palette.amber[700] }]}>owner</Text>
            </>
          )}
          {member.role === 'admin' && (
            <>
              <Shield size={10} color={palette.sky[600]} strokeWidth={2.2} />
              <Text style={[styles.roleText, { color: palette.sky[700] }]}>admin</Text>
            </>
          )}
          {member.role === 'member' && (
            <Text style={styles.roleText}>miembro</Text>
          )}
        </View>
      </View>
      <View style={styles.addPill}>
        <Plus size={12} color={tokens.brand.fg} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[5], gap: spacing[1] },

  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  addToggleText: {
    fontSize: typography.size.xs,
    color: tokens.brand[600],
    fontWeight: typography.weight.semibold as '600',
  },

  empty: {
    color: tokens.text.muted,
    fontSize: typography.size.sm,
    fontStyle: 'italic',
    paddingVertical: spacing[2],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 8,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.subtle,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
  },
  youHint: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  removeBtn: { padding: 4 },

  picker: {
    marginTop: spacing[3],
    backgroundColor: tokens.bg.subtle,
    borderRadius: radius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  pickerTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 8,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    backgroundColor: tokens.bg.surface,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  pickerRowPressed: { backgroundColor: palette.brand[50], borderColor: palette.brand[200] },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  roleText: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    fontWeight: typography.weight.medium as '500',
    textTransform: 'lowercase',
  },
  addPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
