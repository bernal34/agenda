/**
 * Compatibilidad hacia atrás. Re-exporta valores del nuevo sistema de tokens.
 * El código nuevo debe importar desde `constants/theme.ts`.
 */
import { palette, tokens } from './theme';

export const colors = {
  brand: {
    primary: palette.brand[500],
    light:   palette.brand[50],
    mid:     palette.brand[300],
    dark:    palette.brand[700],
  },
  status: {
    todo:     tokens.status.todo,
    progress: tokens.status.progress,
    review:   tokens.status.review,
    done:     tokens.status.done,
    urgent:   tokens.status.urgent,
  },
  areas: {
    design:      '#534AB7',
    engineering: '#185FA5',
    marketing:   '#0F6E56',
    operations:  '#854F0B',
    hr:          '#993556',
  },
} as const;

export type BrandColor = keyof typeof colors.brand;
export type StatusColor = keyof typeof colors.status;
export type AreaColor = keyof typeof colors.areas;
