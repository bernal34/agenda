import {
  addDaysIso,
  buildMonthCells,
  eachDayIso,
  indexByDay,
  pad,
  sameDay,
  startOfWeek,
  taskRange,
  toIso,
  undatedItems,
} from '../calendarGrid';

describe('pad / toIso', () => {
  it('agrega cero a la izquierda', () => {
    expect(pad(5)).toBe('05');
    expect(pad(10)).toBe('10');
  });

  it('formatea fecha local como YYYY-MM-DD', () => {
    expect(toIso(new Date(2026, 5, 10))).toBe('2026-06-10');
    expect(toIso(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('sameDay', () => {
  it('compara solo año/mes/día', () => {
    expect(sameDay(new Date(2026, 5, 10, 8), new Date(2026, 5, 10, 23))).toBe(true);
    expect(sameDay(new Date(2026, 5, 10), new Date(2026, 5, 11))).toBe(false);
  });
});

describe('startOfWeek', () => {
  it('devuelve el lunes de la semana', () => {
    // 2026-06-10 es miércoles → lunes 2026-06-08
    expect(toIso(startOfWeek(new Date(2026, 5, 10)))).toBe('2026-06-08');
    // un lunes queda igual
    expect(toIso(startOfWeek(new Date(2026, 5, 8)))).toBe('2026-06-08');
    // domingo pertenece a la semana que arrancó el lunes anterior
    expect(toIso(startOfWeek(new Date(2026, 5, 14)))).toBe('2026-06-08');
  });

  it('cruza el borde de mes', () => {
    // 2026-07-01 es miércoles → lunes 2026-06-29
    expect(toIso(startOfWeek(new Date(2026, 6, 1)))).toBe('2026-06-29');
  });
});

describe('buildMonthCells', () => {
  it('genera filas completas de 7 celdas', () => {
    const cells = buildMonthCells(2026, 5); // junio 2026
    expect(cells.length % 7).toBe(0);
  });

  it('junio 2026 arranca lunes: sin huecos al inicio, 30 días', () => {
    // 2026-06-01 es lunes → offset 0
    const cells = buildMonthCells(2026, 5);
    expect(cells[0].iso).toBe('2026-06-01');
    const days = cells.filter((c) => c.date !== null);
    expect(days).toHaveLength(30);
    expect(days[29].iso).toBe('2026-06-30');
  });

  it('marzo 2026 arranca domingo: 6 huecos al inicio (semana desde lunes)', () => {
    // 2026-03-01 es domingo → índice 6 con lunes como primer día
    const cells = buildMonthCells(2026, 2);
    expect(cells.slice(0, 6).every((c) => c.date === null)).toBe(true);
    expect(cells[6].iso).toBe('2026-03-01');
  });

  it('febrero bisiesto tiene 29 días', () => {
    const days = buildMonthCells(2024, 1).filter((c) => c.date !== null);
    expect(days).toHaveLength(29);
    expect(days[28].iso).toBe('2024-02-29');
  });

  it('febrero no bisiesto tiene 28 días', () => {
    const days = buildMonthCells(2026, 1).filter((c) => c.date !== null);
    expect(days).toHaveLength(28);
  });

  it('los huecos del final completan la última fila', () => {
    const cells = buildMonthCells(2026, 5); // junio 2026: 30 días desde lunes → 35 celdas
    expect(cells).toHaveLength(35);
    expect(cells.slice(30).every((c) => c.date === null)).toBe(true);
  });
});

describe('addDaysIso', () => {
  it('suma días dentro del mes', () => {
    expect(addDaysIso('2026-09-14', 3)).toBe('2026-09-17');
  });

  it('cruza el borde de mes y de año', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('resta con días negativos', () => {
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso('2024-03-01', -1)).toBe('2024-02-29');
  });
});

describe('taskRange', () => {
  it('usa los dos extremos cuando hay rango', () => {
    expect(taskRange({ start_date: '2026-09-14', due_date: '2026-09-18' })).toEqual({
      from: '2026-09-14',
      to: '2026-09-18',
    });
  });

  it('con una sola fecha, la tarea vive un único día', () => {
    expect(taskRange({ start_date: null, due_date: '2026-09-18' })).toEqual({
      from: '2026-09-18',
      to: '2026-09-18',
    });
    expect(taskRange({ start_date: '2026-09-14', due_date: null })).toEqual({
      from: '2026-09-14',
      to: '2026-09-14',
    });
  });

  it('sin fechas no entra al calendario', () => {
    expect(taskRange({ start_date: null, due_date: null })).toBeNull();
  });

  it('ordena un rango invertido en vez de perder la tarea', () => {
    expect(taskRange({ start_date: '2026-09-18', due_date: '2026-09-14' })).toEqual({
      from: '2026-09-14',
      to: '2026-09-18',
    });
  });
});

describe('eachDayIso', () => {
  it('incluye los dos extremos', () => {
    expect(eachDayIso('2026-09-14', '2026-09-17')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
  });

  it('un solo día devuelve un solo elemento', () => {
    expect(eachDayIso('2026-09-14', '2026-09-14')).toEqual(['2026-09-14']);
  });

  it('corta en maxDays ante un rango disparatado', () => {
    expect(eachDayIso('2026-09-14', '2926-09-14')).toHaveLength(366);
  });
});

describe('indexByDay', () => {
  const kino = { id: 'k', start_date: '2026-09-14', due_date: '2026-09-18' };
  const suelta = { id: 's', start_date: null, due_date: '2026-09-19' };
  const sinFecha = { id: 'n', start_date: null, due_date: null };

  it('pone la tarea en todos los días de su rango, no solo en el due_date', () => {
    const idx = indexByDay([kino]);
    expect([...idx.keys()].sort()).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('marca inicio, fin y si abarca varios días', () => {
    const idx = indexByDay([kino]);
    expect(idx.get('2026-09-14')![0]).toMatchObject({ isStart: true, isEnd: false, spans: true });
    expect(idx.get('2026-09-16')![0]).toMatchObject({ isStart: false, isEnd: false, spans: true });
    expect(idx.get('2026-09-18')![0]).toMatchObject({ isStart: false, isEnd: true, spans: true });
  });

  it('una tarea de un día es inicio y fin a la vez, sin span', () => {
    const idx = indexByDay([suelta]);
    expect(idx.get('2026-09-19')![0]).toMatchObject({ isStart: true, isEnd: true, spans: false });
  });

  it('agrupa varias tareas en el mismo día', () => {
    const idx = indexByDay([kino, { id: 'x', start_date: '2026-09-16', due_date: null }]);
    expect(idx.get('2026-09-16')).toHaveLength(2);
  });

  it('descarta las que no tienen ninguna fecha', () => {
    expect(indexByDay([sinFecha]).size).toBe(0);
  });
});

describe('undatedItems', () => {
  it('devuelve solo las que no tienen ninguna fecha', () => {
    const items = [
      { id: 'a', start_date: null, due_date: null },
      { id: 'b', start_date: '2026-09-14', due_date: null },
      { id: 'c', start_date: null, due_date: '2026-09-18' },
      { id: 'd', start_date: null, due_date: null },
    ];
    expect(undatedItems(items).map((i) => i.id)).toEqual(['a', 'd']);
  });
});
