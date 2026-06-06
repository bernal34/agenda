import { palette } from '../constants/theme';

/**
 * Asigna un color determinista a un texto de etiqueta. Misma etiqueta →
 * mismo color en toda la app, sin necesidad de tabla central de colores.
 */
const LABEL_COLORS: { bg: string; fg: string }[] = [
  { bg: palette.brand[100],   fg: palette.brand[700] },
  { bg: palette.emerald[100], fg: palette.emerald[700] },
  { bg: palette.sky[100],     fg: palette.sky[700] },
  { bg: palette.amber[100],   fg: palette.amber[700] },
  { bg: palette.red[100],     fg: palette.red[700] },
  { bg: palette.slate[100],   fg: palette.slate[700] },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForLabel(label: string) {
  const idx = hashCode(label.toLowerCase()) % LABEL_COLORS.length;
  return LABEL_COLORS[idx];
}
