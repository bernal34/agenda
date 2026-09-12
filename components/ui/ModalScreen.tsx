import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, spacing, type Tokens } from '../../constants/theme';
import { useThemedStyles } from '../../lib/theme';

interface Props {
  children: React.ReactNode;
  /** Cierre al tocar fuera de la ventana. Solo se usa en web. */
  onClose?: () => void;
  /** Ancho máximo de la ventana flotante. */
  maxWidth?: number;
}

/**
 * Envoltorio de las rutas modales (detalle de tarea, nueva tarea).
 *
 * En web las dibuja como una ventana flotante centrada sobre la app, con
 * backdrop que cierra al tocar fuera; ocupar la pantalla entera para editar
 * cuatro campos se sentía desproporcionado. En nativo no envuelve nada: ahí
 * el modal a pantalla completa es lo idiomático y lo que espera el gesto de
 * arrastrar hacia abajo.
 */
export function ModalScreen({ children, onClose, maxWidth = 720 }: Props) {
  const styles = useThemedStyles(makeStyles);

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Cerrar"
      />
      <View style={[styles.window, { maxWidth }]}>{children}</View>
    </View>
  );
}

const makeStyles = (t: Tokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  window: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: t.bg.app,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.border.default,
    ...shadow.md,
  },
});
