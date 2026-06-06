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
  const iso = dmyToIso(dmy);
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  return !isNaN(d.getTime());
}
