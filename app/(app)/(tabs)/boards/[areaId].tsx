import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { Archive, ArrowRight, CheckSquare, GripVertical, LayoutTemplate, Plus, Settings2, Trash2, Users, X, Zap } from 'lucide-react-native';

import { useColumnDrag } from '../../../../components/board/DraggableColumn';
import { DragPreview, DraggableTaskCard } from '../../../../components/tasks/DraggableTaskCard';
import { Button, Card, OverflowMenu, ScreenHeader, SkeletonList } from '../../../../components/ui';
import { useMyAreas } from '../../../../lib/queries/areas';
import {
  BoardStage,
  useBoardStages,
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useUpdateStage,
} from '../../../../lib/queries/stages';
import { useUpdateTask } from '../../../../lib/queries/taskMutations';
import { useAreaTasks, MyTask } from '../../../../lib/queries/tasks';
import { useAuthStore } from '../../../../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import {
  palette,
  radius,
  shadow,
  spacing,
  typography,
  type Tokens,
} from '../../../../constants/theme';
import { useTheme, useThemedStyles } from '../../../../lib/theme';
import { confirmAction, notify } from '../../../../lib/notify';

const COLUMN_WIDTH = Math.min(300, Dimensions.get('window').width * 0.82);

// Paleta de elección para etapas: son datos que se guardan en `board_stages`,
// no colores del tema, así que no cambian con el esquema.
const STAGE_COLORS = [
  palette.slate[500],
  palette.amber[500],
  palette.sky[500],
  palette.emerald[500],
  palette.brand[500],
  palette.red[500],
  palette.sky[700],
  '#854F0B',
  '#993556',
];

interface Rect { x: number; y: number; w: number; h: number; }

export default function KanbanBoard() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();

  const areasQ = useMyAreas(userId);
  const stagesQ = useBoardStages(areaId);
  const updateMut = useUpdateTask();
  const createStageMut = useCreateStage(areaId);
  const updateStageMut = useUpdateStage(areaId);
  const deleteStageMut = useDeleteStage(areaId);
  const reorderStagesMut = useReorderStages(areaId);

  const handleReorderStages = (from: number, to: number) => {
    const arr = [...stages];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    reorderStagesMut.mutate(arr);
  };

  const tasksQ = useAreaTasks(areaId);

  const area = areasQ.data?.find((a) => a.id === areaId);
  const stages = stagesQ.data ?? [];

  const grouped: Record<string, MyTask[]> = useMemo(() => {
    const g: Record<string, MyTask[]> = {};
    stages.forEach((s) => { g[s.code] = []; });
    (tasksQ.data ?? []).forEach((task) => {
      if (g[task.status]) g[task.status].push(task);
      else g[task.status] = [task];
    });
    return g;
  }, [tasksQ.data, stages]);

  const tasksById = useMemo(() => {
    const m = new Map<string, MyTask>();
    (tasksQ.data ?? []).forEach((task) => m.set(task.id, task));
    return m;
  }, [tasksQ.data]);

  const columnRects = useRef<Record<string, Rect>>({});
  const columnRefs = useRef<Record<string, View | null>>({});
  const [hoverStage, setHoverStage] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ task: MyTask; width: number; startX: number; startY: number } | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageLabel, setNewStageLabel] = useState('');
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[4]);
  const [editingStage, setEditingStage] = useState<BoardStage | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const qc = useQueryClient();

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMoveMenuOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refreshAfterBulk = () => {
    qc.invalidateQueries({ queryKey: ['area-tasks', areaId] });
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
  };

  const bulkMoveToStage = async (stageCode: string) => {
    if (selectedIds.size === 0) return;
    setBulkPending(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: stageCode })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      refreshAfterBulk();
      exitSelection();
    } catch (err) {
      notify('No se pudo mover', err instanceof Error ? err.message : 'Error');
    } finally {
      setBulkPending(false);
    }
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!(await confirmAction(`¿Archivar ${selectedIds.size} tarea(s)?`, undefined, 'Archivar'))) return;
    setBulkPending(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      refreshAfterBulk();
      exitSelection();
    } catch (err) {
      notify('No se pudo archivar', err instanceof Error ? err.message : 'Error');
    } finally {
      setBulkPending(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !(await confirmAction(
        `¿Eliminar ${selectedIds.size} tarea(s)?`,
        'Esto no se puede deshacer.',
        'Eliminar',
      ))
    ) return;
    setBulkPending(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      refreshAfterBulk();
      exitSelection();
    } catch (err) {
      notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error');
    } finally {
      setBulkPending(false);
    }
  };

  const measureColumn = (code: string) => {
    const ref = columnRefs.current[code];
    if (!ref) return;
    ref.measureInWindow((x, y, w, h) => {
      columnRects.current[code] = { x, y, w, h };
    });
  };

  const findTargetStage = (absX: number, absY: number): string | null => {
    for (const stage of stages) {
      const r = columnRects.current[stage.code];
      if (!r) continue;
      if (absX >= r.x && absX <= r.x + r.w && absY >= r.y && absY <= r.y + r.h) {
        return stage.code;
      }
    }
    return null;
  };

  const handleDragStart = (task: MyTask, bounds: { x: number; y: number; w: number; h: number }) => {
    dragX.value = bounds.x + bounds.w / 2;
    dragY.value = bounds.y + 30;
    setPreview({ task, width: bounds.w, startX: bounds.x, startY: bounds.y });
  };

  const handleDragMove = (absX: number, absY: number) => {
    dragX.value = absX;
    dragY.value = absY;
    setHoverStage(findTargetStage(absX, absY));
  };

  const handleDrop = (taskId: string, absX: number, absY: number) => {
    setHoverStage(null);
    setPreview(null);
    const target = findTargetStage(absX, absY);
    if (!target) return;
    const task = tasksById.get(taskId);
    if (!task || task.status === target) return;
    updateMut.mutate({ id: taskId, status: target });
  };

  const handleAddStage = async () => {
    if (newStageLabel.trim().length < 2) {
      notify('Nombre inválido', 'Mínimo 2 caracteres');
      return;
    }
    try {
      await createStageMut.mutateAsync({ label: newStageLabel, color: newStageColor });
      setNewStageLabel('');
      setShowAddStage(false);
    } catch (err) {
      notify('No se pudo crear', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDeleteStage = async (stage: BoardStage) => {
    if (!(await confirmAction(`¿Eliminar la etapa "${stage.label}"?`, undefined, 'Eliminar'))) return;
    try {
      await deleteStageMut.mutateAsync(stage);
    } catch (err) {
      notify('No se pudo eliminar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleRenameStage = async (stage: BoardStage, label: string) => {
    if (label.trim().length < 2 || label === stage.label) {
      setEditingStage(null);
      return;
    }
    try {
      await updateStageMut.mutateAsync({ id: stage.id, label: label.trim() });
    } catch (err) {
      notify('No se pudo actualizar', err instanceof Error ? err.message : 'Error');
    } finally {
      setEditingStage(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} seleccionada(s)` : area?.name ?? 'Tablero'}
        accent={area?.color}
        fallbackRoute="/boards"
        right={
          selectionMode ? (
            <Pressable onPress={exitSelection} hitSlop={6} style={styles.membersBtn}>
              <X size={14} color={t.text.secondary} strokeWidth={2} />
              <Text style={styles.membersBtnText}>Cancelar</Text>
            </Pressable>
          ) : (
            // Acción principal a la vista; la configuración del tablero, en el
            // menú. Antes eran cinco botones con texto en un slot para uno.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Pressable
                onPress={() => setSelectionMode(true)}
                hitSlop={6}
                style={({ pressed }) => [styles.membersBtn, pressed && styles.membersBtnPressed]}
              >
                <CheckSquare size={14} color={t.brand[600]} strokeWidth={2.2} />
                <Text style={styles.membersBtnText}>Seleccionar</Text>
              </Pressable>
              <OverflowMenu
                accessibilityLabel="Configuración del tablero"
                items={[
                  {
                    label: 'Plantillas',
                    icon: LayoutTemplate,
                    onPress: () => router.push(`/templates/${areaId}` as never),
                  },
                  {
                    label: 'Campos personalizados',
                    icon: Settings2,
                    onPress: () => router.push(`/custom-fields/${areaId}` as never),
                  },
                  {
                    label: 'Reglas de automatización',
                    icon: Zap,
                    onPress: () => router.push(`/automations/${areaId}` as never),
                  },
                  ...(area && !area.personal
                    ? [{
                        label: 'Miembros',
                        icon: Users,
                        onPress: () => router.push(`/area-members/${areaId}` as never),
                      }]
                    : []),
                ]}
              />
            </View>
          )
        }
      />

      {tasksQ.isLoading && (
        <View style={styles.stateWrap}>
          <SkeletonList count={3} />
        </View>
      )}
      {tasksQ.error && (
        <Card padding="md" style={styles.errorCard}>
          <Text style={styles.errorText}>
            {tasksQ.error instanceof Error ? tasksQ.error.message : 'Error cargando tareas'}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => tasksQ.refetch()}
            style={{ marginTop: spacing[3], alignSelf: 'flex-start' }}
          >
            Reintentar
          </Button>
        </Card>
      )}

      <Text style={styles.hint}>
        Mantené presionado el handle para reordenar columnas · el título para renombrar · la tarea para arrastrar
      </Text>

      {tasksQ.data && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanban}
          decelerationRate="fast"
          snapToInterval={COLUMN_WIDTH + 12}
          snapToAlignment="start"
          onScroll={() => { stages.forEach((s) => measureColumn(s.code)); }}
          scrollEventThrottle={32}
        >
          {stages.map((stage, idx) => (
            <DraggableStageColumn
              key={stage.id}
              stage={stage}
              index={idx}
              total={stages.length}
              stride={COLUMN_WIDTH + 12}
              hovered={hoverStage === stage.code}
              tasks={grouped[stage.code] ?? []}
              isEditing={editingStage?.id === stage.id}
              registerRef={(r) => { columnRefs.current[stage.code] = r; }}
              onMeasure={() => measureColumn(stage.code)}
              onStartEdit={() => setEditingStage(stage)}
              onRename={(label) => handleRenameStage(stage, label)}
              onDelete={() => handleDeleteStage(stage)}
              onReorder={handleReorderStages}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDrop}
              onTaskOpen={(task) => {
                if (selectionMode) toggleSelected(task.id);
                else router.push(`/tasks/${task.id}` as never);
              }}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onAddTask={() => router.push(`/tasks/new?area=${areaId}&status=${stage.code}` as never)}
            />
          ))}

          {/* Add stage column */}
          <View style={[styles.addStageColumn, { width: COLUMN_WIDTH }]}>
            {!showAddStage ? (
              <Pressable
                onPress={() => setShowAddStage(true)}
                style={({ pressed }) => [styles.addStageBtn, pressed && styles.addStageBtnPressed]}
              >
                <Plus size={16} color={t.brand[600]} strokeWidth={2.2} />
                <Text style={styles.addStageBtnText}>Agregar etapa</Text>
              </Pressable>
            ) : (
              <View style={styles.addStageForm}>
                <View style={styles.addStageHeader}>
                  <Text style={styles.addStageLabel}>Nueva etapa</Text>
                  <Pressable
                    onPress={() => { setShowAddStage(false); setNewStageLabel(''); }}
                    hitSlop={6}
                  >
                    <X size={14} color={t.text.muted} strokeWidth={2} />
                  </Pressable>
                </View>
                <TextInput
                  style={styles.addStageInput}
                  value={newStageLabel}
                  onChangeText={setNewStageLabel}
                  placeholder="Ej: Bloqueada"
                  placeholderTextColor={t.text.muted}
                  autoFocus
                  onSubmitEditing={handleAddStage}
                />
                <View style={styles.colorRow}>
                  {STAGE_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setNewStageColor(c)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        newStageColor === c && styles.colorDotSelected,
                      ]}
                    />
                  ))}
                </View>
                <Button
                  onPress={handleAddStage}
                  loading={createStageMut.isPending}
                  size="sm"
                  fullWidth
                  style={{ marginTop: spacing[3] }}
                >
                  Crear etapa
                </Button>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {selectionMode && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selectedIds.size}</Text>
          {moveMenuOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {stages.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => bulkMoveToStage(s.code)}
                  style={({ pressed }) => [
                    styles.bulkChip,
                    { borderColor: s.color },
                    pressed && { backgroundColor: s.color + '14' },
                  ]}
                  disabled={bulkPending}
                >
                  <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                  <Text style={styles.bulkChipText}>{s.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setMoveMenuOpen(false)} hitSlop={6} style={styles.bulkChip}>
                <X size={12} color={t.text.muted} strokeWidth={2} />
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <Pressable
                onPress={() => setMoveMenuOpen(true)}
                disabled={bulkPending || selectedIds.size === 0}
                style={({ pressed }) => [styles.bulkAction, pressed && styles.bulkActionPressed]}
              >
                <ArrowRight size={14} color={t.brand[600]} strokeWidth={2.2} />
                <Text style={styles.bulkActionText}>Mover</Text>
              </Pressable>
              <Pressable
                onPress={bulkArchive}
                disabled={bulkPending || selectedIds.size === 0}
                style={({ pressed }) => [styles.bulkAction, pressed && styles.bulkActionPressed]}
              >
                <Archive size={14} color={t.feedback.warningFg} strokeWidth={2.2} />
                <Text style={styles.bulkActionText}>Archivar</Text>
              </Pressable>
              <Pressable
                onPress={bulkDelete}
                disabled={bulkPending || selectedIds.size === 0}
                style={({ pressed }) => [styles.bulkAction, pressed && styles.bulkActionPressed]}
              >
                <Trash2 size={14} color={t.feedback.errorFg} strokeWidth={2.2} />
                <Text style={[styles.bulkActionText, { color: t.feedback.errorFg }]}>Eliminar</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {preview && (
        <DragPreview
          task={preview.task}
          startX={preview.startX}
          startY={preview.startY}
          width={preview.width}
          dragX={dragX}
          dragY={dragY}
        />
      )}
    </SafeAreaView>
  );
}

interface ColumnProps {
  stage: BoardStage;
  index: number;
  total: number;
  stride: number;
  hovered: boolean;
  tasks: MyTask[];
  isEditing: boolean;
  registerRef: (r: View | null) => void;
  onMeasure: () => void;
  onStartEdit: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onReorder: (from: number, to: number) => void;
  onDragStart: (t: MyTask, bounds: { x: number; y: number; w: number; h: number }) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (taskId: string, x: number, y: number) => void;
  onTaskOpen: (t: MyTask) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onAddTask: () => void;
}

function DraggableStageColumn({
  stage,
  index,
  total,
  stride,
  hovered,
  tasks,
  isEditing,
  registerRef,
  onMeasure,
  onStartEdit,
  onRename,
  onDelete,
  onReorder,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTaskOpen,
  selectionMode,
  selectedIds,
  onAddTask,
}: ColumnProps) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const { gesture, animatedStyle } = useColumnDrag({ index, stride, total, onReorder });
  const [editValue, setEditValue] = useState(stage.label);

  return (
    <Animated.View
      ref={registerRef as never}
      onLayout={onMeasure}
      style={[
        styles.column,
        { width: stride - 12 },
        hovered && styles.columnHover,
        animatedStyle,
      ]}
    >
      <View style={styles.columnHeader}>
        <GestureDetector gesture={gesture}>
          <View style={styles.dragHandle}>
            <GripVertical size={14} color={t.text.muted} strokeWidth={2} />
          </View>
        </GestureDetector>
        <View style={[styles.statusDot, { backgroundColor: stage.color }]} />
        {isEditing ? (
          <TextInput
            style={styles.editStageInput}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            onBlur={() => onRename(editValue)}
            onSubmitEditing={() => onRename(editValue)}
            blurOnSubmit
          />
        ) : (
          <Pressable style={{ flex: 1 }} onLongPress={() => { setEditValue(stage.label); onStartEdit(); }}>
            <Text style={styles.columnTitle} numberOfLines={1}>{stage.label}</Text>
          </Pressable>
        )}
        <Text style={styles.columnCount}>{tasks.length}</Text>
        {isEditing && (
          <Pressable onPress={onDelete} hitSlop={6}>
            <Trash2 size={12} color={t.feedback.errorFg} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      <View style={styles.columnList}>
        {tasks.length === 0 ? (
          <Text style={styles.columnEmpty}>—</Text>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onPress={() => onTaskOpen(task)}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              selectable={selectionMode}
              selected={selectedIds.has(task.id)}
            />
          ))
        )}
        <Pressable
          onPress={onAddTask}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <Plus size={14} color={t.text.secondary} strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Agregar tarea</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.app },

  hint: {
    fontSize: typography.size['2xs'],
    color: t.text.muted,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing[3],
  },

  kanban: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[6],
    gap: spacing[3],
    overflow: 'visible',
  },
  column: {
    backgroundColor: t.bg.subtle,
    borderRadius: radius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'visible',
  },
  columnHover: { borderColor: t.brand[500], backgroundColor: t.brand[50] },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    marginBottom: spacing[2],
  },
  dragHandle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    letterSpacing: -0.1,
  },
  columnCount: {
    fontSize: typography.size.xs,
    color: t.text.muted,
    fontWeight: typography.weight.medium as '500',
  },
  columnList: { paddingBottom: spacing[3], overflow: 'visible' },
  columnEmpty: {
    textAlign: 'center',
    color: t.text.muted,
    fontSize: typography.size.sm,
    paddingVertical: spacing[2],
  },

  editStageInput: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
    backgroundColor: t.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: t.border.focus,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    marginTop: spacing[1],
    backgroundColor: t.bg.surface,
  },
  addBtnPressed: { backgroundColor: t.brand[50], borderColor: t.border.focus },
  addBtnText: {
    color: t.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
  },

  addStageColumn: {
    borderStyle: 'dashed',
    borderColor: t.brand[100],
    borderWidth: 2,
    borderRadius: radius.xl,
    backgroundColor: 'transparent',
    padding: spacing[2],
  },
  addStageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing[8],
  },
  addStageBtnPressed: { backgroundColor: t.brand[50], borderRadius: radius.lg },
  addStageBtnText: {
    color: t.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },
  addStageForm: { padding: spacing[2], ...shadow.soft },
  addStageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  addStageLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
    color: t.text.primary,
  },
  addStageInput: {
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    fontSize: typography.size.base,
    backgroundColor: t.bg.surface,
    color: t.text.primary,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: t.text.primary },

  stateWrap: { paddingHorizontal: spacing[3], paddingTop: spacing[2] },

  errorCard: {
    marginHorizontal: spacing[3],
    backgroundColor: t.feedback.errorBg,
    borderColor: t.border.default,
  },
  errorText: { color: t.feedback.errorFg, fontSize: typography.size.sm },

  membersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: t.brand[50],
    borderWidth: 1,
    borderColor: t.brand[100],
  },
  membersBtnPressed: { backgroundColor: t.brand[100] },
  membersBtnText: {
    color: t.brand[600],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as '600',
  },

  bulkBar: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: t.bg.surface,
    borderWidth: 1,
    borderColor: t.brand[100],
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    ...shadow.soft,
  },
  bulkCount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold as '700',
    color: t.brand[700],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: t.brand[50],
    minWidth: 22,
    textAlign: 'center',
  },
  bulkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.subtle,
    backgroundColor: t.bg.subtle,
  },
  bulkActionPressed: { backgroundColor: t.brand[50], borderColor: t.brand[100] },
  bulkActionText: {
    fontSize: typography.size.xs,
    color: t.text.primary,
    fontWeight: typography.weight.semibold as '600',
  },
  bulkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border.subtle,
    backgroundColor: t.bg.surface,
  },
  bulkChipText: {
    fontSize: typography.size.xs,
    color: t.text.primary,
    fontWeight: typography.weight.medium as '500',
  },
});
