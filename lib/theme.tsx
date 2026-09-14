import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { themes, type Tokens } from '../constants/theme';

export type Scheme = 'light' | 'dark';

interface ThemeValue {
  /** Tokens del esquema activo. */
  t: Tokens;
  scheme: Scheme;
}

const ThemeContext = createContext<ThemeValue>({ t: themes.light, scheme: 'light' });

/**
 * Provee los tokens según el tema del sistema. Va en el layout raíz.
 *
 * No hay interruptor a propósito: la app sigue al dispositivo.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';
  const value = useMemo<ThemeValue>(() => ({ t: themes[scheme], scheme }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Reemplaza a `const styles = StyleSheet.create({...})` a nivel de módulo.
 *
 * El problema de fondo: `StyleSheet.create` en el cuerpo del archivo se evalúa
 * una sola vez al importarlo, así que los colores quedan congelados al arrancar
 * y no hay forma de que respondan al tema. Acá la hoja se construye a partir de
 * los tokens activos y se memoiza por esquema, de modo que cambiar de claro a
 * oscuro recalcula una vez, no en cada render.
 *
 * Definí la factory a nivel de módulo (fuera del componente) para que la
 * identidad sea estable:
 *
 *   const makeStyles = (t: Tokens) => StyleSheet.create({ ... });
 *   ...
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: Tokens) => T,
): T {
  const { t } = useTheme();
  return useMemo(() => factory(t), [factory, t]);
}
