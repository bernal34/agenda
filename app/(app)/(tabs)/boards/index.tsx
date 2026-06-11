import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  LayoutGrid,
  Inbox,
  Plus,
  Trash2,
  X,
  User,
  Users,
} from 'lucide-react-native';

import { Badge, Button, Card, EmptyState } from '../../../../components/ui';
import { notify } from '../../../../lib/notify';
import {
  useCreateArea,
  useDeleteArea,
  useEnsurePersonalBoard,
  useMyAreas,
  MyArea,
} from '../../../../lib/queries/areas';
import { useMyProfile } from '../../../../lib/queries/profile';
import { useAuthStore } from '../../../../stores/authStore';
import { palette, radius, shadow, spacing, tokens, typography } from '../../../../constants/theme';

const COLOR_SWATCHES = [
  palette.brand[500],
  palette.emerald[500],
  palette.sky[500],
  palette.amber[500],
  palette.red[500],
  '#185FA5',
  '#0F6E56',
  '#854F0B',
  '#993556',
  palette.slate[500],
];

export default function BoardsIndex() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();

  useEnsurePersonalBoard(userId);

  const { data: areas, isLoading, error } = useMyAreas(userId);
  const { data: profile } = useMyProfile(userId);
  const createMut = useCreateArea();
  const deleteMut = useDeleteArea();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [personal, setPersonal] = useState(true);

  const resetForm = () => {
    setCreating(false);
    setName('');
    setColor(COLOR_SWATCHES[0]);
    setPersonal(true);
  };

  const handleCreate = async () => {
    if (!userId || !profile?.org_id) {
      notify('No se puede crear', 'No tenés organización asignada.');
      return;
    }
    try {
      await createMut.mutateAsync({
        name,
        color,
        orgId: profile.org_id,
        userId,
        personal,
      });
      resetForm();
    } catch (err) {
      notify('No se pudo crear', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = (a: MyArea) => {
    if (a.role !== 'owner' && a.role !== 'admin') {
      notify('Sin permiso', 'Solo el owner o admin pueden eliminar un tablero.');
      return;
    }
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm(
            `¿Eliminar el tablero "${a.name}"?\n\nSe perderán todas las tareas, sprints y canales. Esta acción no se puede deshacer.`,
          )
        : true;
    if (!confirmed) return;
    deleteMut.mutate(a.id, {
      onError: (err) =>
        notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error'),
    });
  };

  // Orden: personales primero, luego compartidos
  const sortedAreas = [...(areas ?? [])].sort((a, b) => {
    if (a.personal !== b.personal) return a.personal ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tableros</Text>
          <Text style={styles.subtitle}>
            {creating ? 'Nuevo tablero' : 'Tus áreas y tableros personales'}
          </Text>
        </View>
        {!creating && (
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onPress={() => setCreating(true)}
          >
            Nuevo
          </Button>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {creating && (
          <Card padding="md" style={styles.createCard} elevation="card">
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Nuevo tablero</Text>
              <Pressable onPress={resetForm} hitSlop={8}>
                <X size={16} color={tokens.text.muted} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Toggle Personal / Compartido */}
            <View style={styles.toggleRow}>
              <TypeToggle
                active={personal}
                onPress={() => setPersonal(true)}
                icon={User}
                label="Personal"
                hint="Solo lo ves vos"
              />
              <TypeToggle
                active={!personal}
                onPress={() => setPersonal(false)}
                icon={Users}
                label="Compartido"
                hint="Para el equipo"
              />
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={personal ? 'Ej: Mis pendientes, Casa, Side project...' : 'Ej: Marketing, Ingeniería...'}
              placeholderTextColor={tokens.text.muted}
              autoFocus
              onSubmitEditing={handleCreate}
            />

            <Text style={[styles.label, { marginTop: spacing[3] }]}>Color</Text>
            <View style={styles.swatchRow}>
              {COLOR_SWATCHES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && styles.swatchSelected,
                  ]}
                />
              ))}
            </View>

            {!personal && (
              <Text style={styles.hint}>
                Los tableros compartidos requieren permisos de admin.
              </Text>
            )}

            <View style={styles.createActions}>
              <Button variant="secondary" size="md" onPress={resetForm} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={handleCreate}
                loading={createMut.isPending}
                disabled={name.trim().length < 2 || createMut.isPending}
                style={{ flex: 1 }}
              >
                Crear
              </Button>
            </View>
          </Card>
        )}

        {isLoading && <ActivityIndicator color={tokens.brand[600]} style={{ marginTop: 24 }} />}
        {error && (
          <Card style={styles.errorCard} padding="md">
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando áreas'}
            </Text>
          </Card>
        )}
        {sortedAreas.length === 0 && !isLoading && !creating && (
          <EmptyState
            icon={Inbox}
            title="Sin tableros"
            description="Tu tablero personal aparecerá acá apenas se cree. Si tarda, tocá Nuevo para crearlo a mano."
          />
        )}

        {sortedAreas.map((a) => {
          const canManage = a.role === 'owner' || a.role === 'admin';
          const isDeleting = deleteMut.isPending && deleteMut.variables === a.id;
          return (
            <View key={a.id} style={styles.areaRow}>
              <Card
                onPress={() => router.push(`/boards/${a.id}` as never)}
                accent={a.color}
                padding="md"
                style={[styles.areaCard, isDeleting && { opacity: 0.4 }]}
              >
                <View style={[styles.iconBox, { backgroundColor: a.color + '1A' }]}>
                  {a.personal ? (
                    <User size={18} color={a.color} strokeWidth={2} />
                  ) : (
                    <LayoutGrid size={18} color={a.color} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.areaName} numberOfLines={1}>{a.name}</Text>
                    {a.personal && <Badge tone="brand">Personal</Badge>}
                  </View>
                  <Text style={styles.areaRole}>
                    {a.personal ? 'Solo vos' : a.role}
                  </Text>
                </View>
                <ChevronRight size={18} color={tokens.text.muted} strokeWidth={2} />
              </Card>
              {canManage && (
                <Pressable
                  onPress={() => handleDelete(a)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && styles.deleteBtnPressed,
                  ]}
                >
                  <Trash2 size={14} color={palette.red[600]} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function TypeToggle({
  active,
  onPress,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onPress: () => void;
  icon: typeof User;
  label: string;
  hint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.typeToggle,
        active && {
          backgroundColor: palette.brand[50],
          borderColor: palette.brand[500],
        },
      ]}
    >
      <Icon
        size={16}
        color={active ? palette.brand[600] : tokens.text.muted}
        strokeWidth={active ? 2.4 : 1.8}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.typeToggleLabel,
            active && { color: palette.brand[700], fontWeight: typography.weight.semibold as '600' },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.typeToggleHint}>{hint}</Text>
      </View>
    </Pressable>
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

  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },

  // Create form
  createCard: { marginBottom: spacing[3] },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  createTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },

  toggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  typeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tokens.border.default,
    backgroundColor: tokens.bg.surface,
  },
  typeToggleLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
  },
  typeToggleHint: {
    fontSize: typography.size['2xs'],
    color: tokens.text.muted,
    marginTop: 1,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    fontSize: typography.size.base,
    color: tokens.text.primary,
    backgroundColor: tokens.bg.surface,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing[1],
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: tokens.text.primary },
  hint: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    marginTop: spacing[3],
    fontStyle: 'italic',
  },
  createActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },

  // Area rows
  areaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  areaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  areaName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    flexShrink: 1,
  },
  areaRole: {
    fontSize: typography.size.xs,
    color: tokens.text.muted,
    textTransform: 'capitalize',
    marginTop: 2,
    fontWeight: typography.weight.medium as '500',
  },

  deleteBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    backgroundColor: tokens.bg.surface,
    ...shadow.soft,
  },
  deleteBtnPressed: { backgroundColor: palette.red[50], borderColor: palette.red[200] },

  errorCard: { borderColor: palette.red[200], backgroundColor: palette.red[50] },
  errorText: { color: palette.red[700], fontSize: typography.size.sm },
});
