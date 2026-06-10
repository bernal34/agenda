import { buildMonthCells, pad, sameDay, startOfWeek, toIso } from '../calendarGrid';

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
