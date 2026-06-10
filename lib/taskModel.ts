// Tipos y mapeo de tareas, sin dependencias de Supabase.
// Mantenerlo puro permite testearlo de forma aislada.

// Status libre: cualquier código definido en ops.board_stages.
// Por defecto el sistema usa todo / in_progress / in_review / done.
export type TaskStatus = string;
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date: string | null;
  area: { id: string; name: string; color: string; slug: string } | null;
  labels: string[];
  snoozed_until: string | null;
}

export function mapTask(t: any): MyTask {
  const assignees = (t.assignees ?? t.task_assignees ?? []) as { snoozed_until?: string | null }[];
  const snooze = assignees.length > 0 ? assignees[0].snoozed_until ?? null : null;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    progress: t.progress,
    due_date: t.due_date,
    area: t.area,
    labels: ((t.task_labels ?? []) as { label: string }[])
      .map((l) => l.label)
      .sort(),
    snoozed_until: snooze,
  };
}
