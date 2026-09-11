// Arma el texto de la push a partir de una fila de ops.notifications.
// Puro y sin APIs de Deno: lo importan la edge function y los tests de Jest.

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Ruta de la app a abrir al tocar la notificación. */
  url: string;
  /** Agrupa notificaciones de la misma tarea (la nueva reemplaza a la anterior). */
  tag: string;
}

const MAX_BODY = 180;
const TIME_ZONE = 'America/Mexico_City';

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function truncate(text: string): string {
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1)}…` : text;
}

function formatHour(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  return hour && minute ? `${hour}:${minute}` : null;
}

/** Usuario que provocó la notificación, para mostrar su nombre. */
export function actorIdOf(n: NotificationRow): string | null {
  const p = n.payload ?? {};
  if (n.kind === 'task_assigned') return str(p.assigned_by);
  if (n.kind === 'mention' || n.kind === 'comment') return str(p.author_id);
  return null;
}

export function buildPushMessage(n: NotificationRow, actorName: string | null): PushMessage {
  const p = n.payload ?? {};
  const taskId = str(p.task_id);
  const task = `«${str(p.task_title) ?? 'una tarea'}»`;
  const preview = str(p.preview);
  const who = str(actorName) ?? 'Alguien';

  const url = taskId ? `/tasks/${taskId}` : '/notifications';
  const tag = taskId ? `task-${taskId}` : `notif-${n.id}`;

  let title: string;
  let body: string;
  switch (n.kind) {
    case 'task_assigned':
      title = 'Nueva tarea asignada';
      body = `${who} te asignó ${task}`;
      break;
    case 'mention':
      title = `${who} te mencionó`;
      body = preview ? `En ${task}: ${preview}` : `En ${task}`;
      break;
    case 'comment':
      title = `Nuevo comentario de ${who}`;
      body = preview ? `${task}: ${preview}` : `En ${task}`;
      break;
    case 'task_start_soon': {
      const start = str(p.start_at);
      const hour = start ? formatHour(start) : null;
      title = 'Tarea próxima a comenzar';
      body = hour ? `${task} empieza a las ${hour}` : `${task} está por empezar`;
      break;
    }
    case 'task_due':
      title = 'Tarea próxima a vencer';
      body = task;
      break;
    default:
      title = 'Mi Agenda';
      body = taskId ? task : 'Tienes una notificación nueva';
  }

  return { title, body: truncate(body), url, tag };
}
