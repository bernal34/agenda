// Matemática de calendario compartida por MonthCalendar y WeekView.
// Semana con lunes como primer día (convención es-AR).

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

/** Suma días a un ISO `YYYY-MM-DD` quedándose en el huso local. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

/** Lo mínimo que necesita el calendario de una tarea. */
export interface DatedItem {
  start_date: string | null;
  due_date: string | null;
}

/**
 * Rango de días que ocupa una tarea. `start_date` y `due_date` son los dos
 * extremos de un intervalo; con una sola de las dos, la tarea vive un único
 * día. Sin ninguna fecha no entra al calendario.
 * Tolera rangos invertidos (una fecha final anterior a la inicial) ordenando
 * los extremos, para no perder la tarea por un dato mal cargado.
 */
export function taskRange(item: DatedItem): { from: string; to: string } | null {
  const { start_date: s, due_date: d } = item;
  if (!s && !d) return null;
  if (s && d) return s <= d ? { from: s, to: d } : { from: d, to: s };
  const only = (s ?? d)!;
  return { from: only, to: only };
}

/**
 * Días ISO que cubre el rango, inclusive en los dos extremos.
 * `maxDays` es una red de seguridad: un año mal tipeado (2926 en vez de 2026)
 * no puede generar una lista infinita.
 */
export function eachDayIso(from: string, to: string, maxDays = 366): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < maxDays) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

export interface DayEntry<T> {
  task: T;
  isStart: boolean;
  isEnd: boolean;
  /** true cuando la tarea ocupa más de un día. */
  spans: boolean;
}

/**
 * Indexa tareas por día. Una tarea con rango aparece en **todos** los días
 * que cubre, no solo en su `due_date`: mirar el lunes tiene que mostrar lo
 * que está en curso ese lunes, no solo lo que vence.
 */
export function indexByDay<T extends DatedItem>(items: T[]): Map<string, DayEntry<T>[]> {
  const m = new Map<string, DayEntry<T>[]>();
  items.forEach((task) => {
    const r = taskRange(task);
    if (!r) return;
    const spans = r.from !== r.to;
    eachDayIso(r.from, r.to).forEach((iso) => {
      const list = m.get(iso) ?? [];
      list.push({ task, isStart: iso === r.from, isEnd: iso === r.to, spans });
      m.set(iso, list);
    });
  });
  return m;
}

/** Las que no caen en ningún día: sin `start_date` ni `due_date`. */
export function undatedItems<T extends DatedItem>(items: T[]): T[] {
  return items.filter((i) => taskRange(i) === null);
}

export interface MonthCell {
  date: Date | null;
  iso: string | null;
}

/**
 * Genera la grilla del mes como filas completas de 7 celdas.
 * Las celdas fuera del mes quedan en null. `month` es 0-based.
 */
export function buildMonthCells(year: number, month: number): MonthCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const totalDays = lastOfMonth.getDate();
  const total = startWeekday + totalDays;
  const rows = Math.ceil(total / 7);
  const arr: MonthCell[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > totalDays) {
      arr.push({ date: null, iso: null });
    } else {
      const d = new Date(year, month, dayNum);
      arr.push({ date: d, iso: toIso(d) });
    }
  }
  return arr;
}
