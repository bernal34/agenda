// Derivaciones puras sobre listas de tareas (stats del Home y agrupado
// por estado). Separadas de los componentes para poder testearlas.

import type { MyTask, TaskStatus } from './taskModel';

export function countDueToday(tasks: MyTask[], today: string): number {
  return tasks.filter((t) => t.due_date === today && t.status !== 'done').length;
}

export function countOverdue(tasks: MyTask[], today: string): number {
  return tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done').length;
}

export function countDoneToday(tasks: MyTask[], today: string): number {
  return tasks.filter((t) => t.status === 'done' && t.due_date === today).length;
}

/**
 * Agrupa tareas por estado. Siempre devuelve una entrada (posiblemente
 * vacía) para cada estado de `statuses`; los estados desconocidos
 * (stages personalizados del tablero) se agregan dinámicamente en lugar
 * de romper.
 */
export function groupByStatus(
  tasks: MyTask[],
  statuses: TaskStatus[],
): Record<TaskStatus, MyTask[]> {
  const g: Record<TaskStatus, MyTask[]> = {};
  statuses.forEach((s) => {
    g[s] = [];
  });
  tasks.forEach((t) => {
    (g[t.status] ??= []).push(t);
  });
  return g;
}
