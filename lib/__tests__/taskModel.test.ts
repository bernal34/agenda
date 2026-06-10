import { mapTask } from '../taskModel';

const row = {
  id: 't1',
  title: 'Revisar pedidos',
  description: 'detalle',
  status: 'in_progress',
  priority: 'high',
  progress: 50,
  due_date: '2026-06-15',
  area: { id: 'a1', name: 'Operaciones', color: '#854F0B', slug: 'ops' },
  task_labels: [{ label: 'urgente' }, { label: 'cliente' }],
};

describe('mapTask', () => {
  it('mapea los campos básicos', () => {
    const t = mapTask(row);
    expect(t.id).toBe('t1');
    expect(t.title).toBe('Revisar pedidos');
    expect(t.status).toBe('in_progress');
    expect(t.priority).toBe('high');
    expect(t.progress).toBe(50);
    expect(t.due_date).toBe('2026-06-15');
    expect(t.area).toEqual(row.area);
  });

  it('extrae y ordena las etiquetas alfabéticamente', () => {
    expect(mapTask(row).labels).toEqual(['cliente', 'urgente']);
  });

  it('tolera task_labels ausente o vacío', () => {
    expect(mapTask({ ...row, task_labels: undefined }).labels).toEqual([]);
    expect(mapTask({ ...row, task_labels: [] }).labels).toEqual([]);
  });

  it('tolera area null', () => {
    expect(mapTask({ ...row, area: null }).area).toBeNull();
  });
});
