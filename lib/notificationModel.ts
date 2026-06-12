// Tipos y lógica pura de notificaciones, sin dependencias de Supabase.

export type NotificationKind =
  | 'task_assigned'
  | 'task_due'
  | 'task_start_soon'
  | 'mention'
  | 'comment';

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/**
 * Agrega una notificación entrante al frente de la lista cacheada,
 * descartando duplicados por id (el realtime puede reenviar eventos).
 */
export function prependNotification(
  prev: AppNotification[] | undefined,
  row: AppNotification,
): AppNotification[] {
  if (!prev) return [row];
  if (prev.some((n) => n.id === row.id)) return prev;
  return [row, ...prev];
}

export function countUnread(list: AppNotification[] | undefined): number {
  return (list ?? []).filter((n) => !n.read_at).length;
}
