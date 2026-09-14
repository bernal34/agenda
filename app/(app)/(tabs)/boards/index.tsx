import { useState } from 'react';
import {
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
  Check,
  ChevronRight,
  LayoutGrid,
  Inbox,
  Pencil,
  Plus,
  Trash2,
  X,
  User,
  Users,
} from 'lucide-react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  SkeletonList,
  TabHeader,
} from '../../../../components/ui';
import { confirmAction, notify } from '../../../../lib/notify';
import {
  useCreateArea,
  useDeleteArea,
  useEnsurePersonalBoard,
  useMyAreas,
  useRenameArea,
  MyArea,
} from '../../../../lib/queries/areas';
import { useAuthStore } from '../../../../stores/authStore';
import { palette, radius, spacing, typography, type Tokens } from '../../../../constants/theme';
import { useTheme, useThemedStyles } from '../../../../lib/theme';

// Colores de área: los elige el usuario y se ven igual en los dos temas.
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

const ROLE_LABEL: Record<MyArea['role'], string> = {
  owner:  'Owner',
  admin:  'Admin',
  member: 'Miembro',
};

export default function BoardsIndex() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();

  useEnsurePersonalBoard(userId);

  const { data: areas, isLoading, error, refetch } = useMyAreas(userId);
  const createMut = useCreateArea();
  const deleteMut = useDeleteArea();
  const renameMut = useRenameArea();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [personal, setPersonal] = useState(true);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const resetForm = () => {
    setCreating(false);
    setName('');
    setColor(COLOR_SWATCHES[0]);
    setPersonal(true);
  };

  const handleCreate = async () => {
    if (!userId) {
      notify('No se puede crear', 'Tu sesión expiró. Volvé a entrar.');
      return;
    }
    try {
      await createMut.mutateAsync({ name, color, userId, personal });
      resetForm();
    } catch (err) {
      notify('No se pudo crear', err instanceof Error ? err.message : 'Error');
    }
  };

  const startRename = (a: MyArea) => {
    setRenamingId(a.id);
    setRenameValue(a.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRename = async () => {
    if (!renamingId) return;
    try {
      await renameMut.mutateAsync({ areaId: renamingId, name: renameValue });
      cancelRename();
    } catch (err) {
      notify('No se pudo renombrar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (a: MyArea) => {
    if (a.role !== 'owner' && a.role !== 'admin') {
      notify('Sin permiso', 'Solo el owner o admin pueden eliminar un tablero.');
      return;
    }
    const confirmed = await confirmAction(
      `¿Eliminar el tablero "${a.name}"?`,
      'Se perderán todas las tareas, etapas y canales. Esta acción no se puede deshacer.',
      'Eliminar',
    );
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

  const subtitle = creating
    ? 'Nuevo tablero'
    : sortedAreas.length > 0
      ? `${sortedAreas.length} ${sortedAreas.length === 1 ? 'tablero' : 'tableros'}`
      : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader
        title="Tableros"
        subtitle={subtitle}
        right={
          !creating ? (
            <Button variant="primary" size="sm" icon={Plus} onPress={() => setCreating(true)}>
              Nuevo
            </Button>
          ) : undefined
        }
      />

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
                <X size={16} color={t.text.muted} strokeWidth={2} />
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
                styles={styles}
                t={t}
              />
              <TypeToggle
                active={!personal}
                onPress={() => setPersonal(false)}
                icon={Users}
                label="Compartido"
                hint="Para el equipo"
                styles={styles}
                t={t}
              />
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={personal ? 'Ej: Mis pendientes, Casa, Side project...' : 'Ej: Marketing, Ingeniería...'}
              placeholderTextColor={t.text.muted}
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
                Quedás como owner del tablero y podés invitar a tu equipo desde Miembros.
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

        {isLoading && <SkeletonList count={4} variant="row" />}
        {error && (
          <Card padding="md" style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Error cargando áreas'}
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

          if (renamingId === a.id) {
            return (
              <View key={a.id} style={styles.areaRow}>
                <Card accent={a.color} padding="md" style={styles.areaCard}>
                  <View style={[styles.iconBox, { backgroundColor: a.color + '1A' }]}>
                    {a.personal ? (
                      <User size={18} color={a.color} strokeWidth={2} />
                    ) : (
                      <LayoutGrid size={18} color={a.color} strokeWidth={2} />
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={renameValue}
                    onChangeText={setRenameValue}
                    placeholder="Nombre del tablero"
                    placeholderTextColor={t.text.muted}
                    autoFocus
                    selectTextOnFocus
                    onSubmitEditing={handleRename}
                    editable={!renameMut.isPending}
                  />
                </Card>
                <Pressable
                  onPress={handleRename}
                  hitSlop={8}
                  disabled={renameValue.trim().length < 2 || renameMut.isPending}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.saveBtnPressed,
                    (renameValue.trim().length < 2 || renameMut.isPending) && { opacity: 0.4 },
                  ]}
                >
                  <Check size={14} color={t.status.done} strokeWidth={2.4} />
                </Pressable>
                <Pressable
                  onPress={cancelRename}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                >
                  <X size={14} color={t.text.muted} strokeWidth={2} />
                </Pressable>
              </View>
            );
          }

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
                    {a.personal ? 'Solo vos' : ROLE_LABEL[a.role]}
                  </Text>
                </View>
                <ChevronRight size={18} color={t.text.muted} strokeWidth={2} />
              </Card>
              {canManage && (
                <>
                  <Pressable
                    onPress={() => startRename(a)}
                    hitSlop={8}
                    accessibilityLabel={`Renombrar ${a.name}`}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                  >
                    <Pencil size={14} color={t.text.muted} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(a)}
                    hitSlop={8}
                    accessibilityLabel={`Eliminar ${a.name}`}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.deleteBtnPressed,
                    ]}
                  >
                    <Trash2 size={14} color={t.status.urgent} strokeWidth={2} />
                  </Pressable>
                </>
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
  styles,
  t,
}: {
  active: boolean;
  onPress: () => void;
  icon: typeof User;
  label: string;
  hint: string;
  styles: ReturnType<typeof makeStyles>;
  t: Tokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeToggle,
        active && {
          backgroundColor: t.brand[50],
          borderColor: t.brand[500],
        },
        pressed && !active && { backgroundColor: t.bg.subtle },
      ]}
    >
      <Icon
        size={16}
        color={active ? t.brand[600] : t.text.muted}
        strokeWidth={active ? 2.4 : 1.8}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.typeToggleLabel,
            active && { color: t.brand[700], fontWeight: typography.weight.semibold as '600' },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.typeToggleHint}>{hint}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },

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
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
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
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.default,
    backgroundColor: t.bg.surface,
  },
  typeToggleLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
  },
  typeToggleHint: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    marginTop: 1,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.base,
    color: t.text.primary,
    backgroundColor: t.bg.surface,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: t.text.primary },
  hint: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    marginTop: spacing[3],
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
    color: t.text.primary,
    flexShrink: 1,
  },
  areaRole: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    marginTop: 2,
    fontWeight: typography.weight.medium as '500',
  },

  iconBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: t.border.subtle,
    backgroundColor: t.bg.surface,
  },
  iconBtnPressed: { backgroundColor: t.bg.subtle, borderColor: t.border.default },
  deleteBtnPressed: { backgroundColor: t.feedback.errorBg, borderColor: t.status.urgent },
  saveBtnPressed: { backgroundColor: t.feedback.successBg, borderColor: t.status.done },

  errorCard: {
    backgroundColor: t.feedback.errorBg,
    borderColor: t.border.default,
  },
  errorText: { color: t.feedback.errorFg, fontSize: typography.size.sm },
});
