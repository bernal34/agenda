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
