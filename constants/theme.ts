/**
 * Design tokens unificados con el Portal RRHH.
 * Misma escala Tailwind (slate, neutrales, sombras, radios, espaciado),
 * con el acento de marca propio de OpsBoard (púrpura #534AB7).
 *
 * Si más adelante migramos a NativeWind, estos valores ya se corresponden
 * 1:1 con clases de Tailwind y la traducción es trivial.
 */

export const palette = {
  // Neutrales — slate de Tailwind
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  // Brand — púrpura OpsBoard, en escala 50..900 derivada de #534AB7
  brand: {
    50:  '#F2F1FB',
    100: '#E6E4F7',
    200: '#CCC8EF',
    300: '#AFA9EC', // ex mid
    400: '#7E73D2',
    500: '#534AB7', // ex primary
    600: '#463DA3',
    700: '#3C3489', // ex dark
    800: '#2F296B',
    900: '#221F4D',
  },
  // Status / feedback — alineado al sistema de RH
  red: {
    50:  '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  emerald: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  sky: {
    50:  '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
  },
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

/** Roles semánticos — usar éstos en componentes, no acceder a `palette` directo. */
export const tokens = {
  bg: {
    app:     palette.slate[50],
    surface: palette.white,
    subtle:  palette.slate[100],
    muted:   palette.slate[50],
    inverse: palette.slate[900],
  },
  text: {
    primary:   palette.slate[900],
    secondary: palette.slate[600],
    muted:     palette.slate[400],
    inverse:   palette.white,
    onBrand:   palette.white,
    link:      palette.brand[600],
  },
  border: {
    subtle:   palette.slate[100],
    default:  palette.slate[200],
    strong:   palette.slate[300],
    focus:    palette.brand[500],
  },
  brand: {
    50:  palette.brand[50],
    100: palette.brand[100],
    500: palette.brand[500],
    600: palette.brand[600],
    700: palette.brand[700],
    fg:  palette.white,
  },
  status: {
    todo:     palette.slate[500],
    progress: palette.amber[500],
    review:   palette.sky[500],
    done:     palette.emerald[500],
    urgent:   palette.red[500],
  },
  feedback: {
    successBg:  palette.emerald[50],
    successFg:  palette.emerald[700],
    warningBg:  palette.amber[50],
    warningFg:  palette.amber[700],
    errorBg:    palette.red[50],
    errorFg:    palette.red[700],
    infoBg:     palette.sky[50],
    infoFg:     palette.sky[700],
  },
} as const;

export const spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs:   4,
  sm:   6,
  md:   8,
  lg:   10,
  xl:   12,
  '2xl': 16,
  full: 9999,
} as const;

/** Sombras tipo `shadow-soft` y `shadow-card` de RH, traducidas a RN. */
export const shadow = {
  none: {},
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const typography = {
  family: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
  },
  size: {
    '2xs': 10,
    xs:    11,
    sm:    13,
    base:  14,
    md:    15,
    lg:    16,
    xl:    18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
  },
  weight: {
    regular: '400',
    medium:  '500',
    semibold: '600',
    bold:    '700',
  },
  lineHeight: {
    tight:   1.25,
    snug:    1.4,
    normal:  1.5,
    relaxed: 1.625,
  },
} as const;

export const duration = {
  fast:   150,
  base:   200,
  slow:   300,
} as const;

export const layout = {
  tabBarHeight: 60,
  headerHeight: 56,
  touchTarget:  44,
} as const;

export type Tokens = typeof tokens;
