// Helpers para convertir entre formato visible (DD/MM/YYYY)
// y formato de la DB (ISO YYYY-MM-DD).

export const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoToDmy(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

export function dmyToIso(dmy: string | null | undefined): string | null {
  if (!dmy) return null;
  const m = dmy.trim().match(DMY_RE);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function isValidDmy(dmy: string): boolean {
  if (!dmy) return true; // vacío es válido (sin fecha)
  const m = dmy.trim().match(DMY_RE);
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  // Date() desborda fechas inválidas (31/02 → 3 de marzo), así que
  // verificamos que los componentes no hayan cambiado.
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

// Hora HH:MM (24h). Vacío = sin hora.
export const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function isValidTime(time: string): boolean {
  if (!time) return true;
  const m = time.trim().match(TIME_RE);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

// Combina DD/MM/YYYY + HH:MM en un timestamp ISO local.
// El timestamp se construye como hora local del dispositivo y se serializa
// con offset; el server lo guarda en timestamptz.
// Si falta cualquiera de las dos partes, devuelve null.
export function dmyAndTimeToIso(
  dmy: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!dmy || !time) return null;
  const dateMatch = dmy.trim().match(DMY_RE);
  const timeMatch = time.trim().match(TIME_RE);
  if (!dateMatch || !timeMatch) return null;
  const [, dd, mm, yyyy] = dateMatch;
  const [, hh, mi] = timeMatch;
  const d = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(mi),
    0,
    0,
  );
  return d.toISOString();
}

// Extrae "HH:MM" en hora local desde un timestamp ISO.
export function isoToLocalTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

// Extrae "DD/MM/YYYY" en hora local desde un timestamp ISO.
export function isoToLocalDmy(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear());
  return `${dd}/${mo}/${yy}`;
}
