import type { MyTask } from '../taskModel';
import {
  countDoneToday,
  countDueToday,
  countOverdue,
  groupByStatus,
} from '../taskStats';

const TODAY = '2026-06-10';

function task(partial: Partial<MyTask>): MyTask {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'tarea',
    description: null,
    status: 'todo',
    priority: 'normal',
    progress: 0,
    start_date: null,
    due_date: null,
    start_at: null,
    area: null,
    labels: [],
    snoozed_until: null,
    ...partial,
  };
}

describe('countDueToday', () => {
  it('cuenta tareas que vencen hoy y no están hechas', () => {
    const tasks = [
      task({ due_date: TODAY }),
      task({ due_date: TODAY, status: 'in_progress' }),
      task({ due_date: TODAY, status: 'done' }), // excluida
      task({ due_date: '2026-06-11' }), // mañana
      task({ due_date: null }),
    ];
    expect(countDueToday(tasks, TODAY)).toBe(2);
  });
});

describe('countOverdue', () => {
  it('cuenta tareas vencidas no hechas; ignora sin fecha y hechas', () => {
    const tasks = [
      task({ due_date: '2026-06-09' }),
      task({ due_date: '2025-12-31', status: 'in_review' }),
      task({ due_date: '2026-06-09', status: 'done' }), // excluida
      task({ due_date: TODAY }), // hoy no es vencida
      task({ due_date: null }),
    ];
    expect(countOverdue(tasks, TODAY)).toBe(2);
  });
});

describe('countDoneToday', () => {
  it('cuenta tareas hechas con vencimiento hoy', () => {
    const tasks = [
      task({ due_date: TODAY, status: 'done' }),
      task({ due_date: TODAY }), // no hecha
      task({ due_date: '2026-06-09', status: 'done' }), // otro día
    ];
    expect(countDoneToday(tasks, TODAY)).toBe(1);
  });
});

describe('groupByStatus', () => {
  const ORDER = ['in_progress', 'todo', 'in_review', 'done'];

  it('agrupa por estado y devuelve todos los buckets aunque estén vacíos', () => {
    const tasks = [
      task({ id: '1', status: 'todo' }),
      task({ id: '2', status: 'in_progress' }),
      task({ id: '3', status: 'todo' }),
    ];
    const g = groupByStatus(tasks, ORDER);
    expect(g.todo.map((t) => t.id)).toEqual(['1', '3']);
    expect(g.in_progress.map((t) => t.id)).toEqual(['2']);
    expect(g.in_review).toEqual([]);
    expect(g.done).toEqual([]);
  });

  it('no rompe con estados desconocidos (stages personalizados)', () => {
    const tasks = [
      task({ id: '1', status: 'blocked' }),
      task({ id: '2', status: 'todo' }),
    ];
    const g = groupByStatus(tasks, ORDER);
    expect(g.blocked.map((t) => t.id)).toEqual(['1']);
    expect(g.todo.map((t) => t.id)).toEqual(['2']);
  });

  it('devuelve solo buckets vacíos con lista vacía', () => {
    const g = groupByStatus([], ORDER);
    expect(Object.keys(g).sort()).toEqual([...ORDER].sort());
    ORDER.forEach((s) => expect(g[s]).toEqual([]));
  });
});
