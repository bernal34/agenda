import { Alert, Platform } from 'react-native';

/**
 * Confirmación de una acción destructiva. En web usa window.confirm; en nativo,
 * Alert.alert con dos botones. Resuelve false si el usuario cancela o descarta.
 *
 * Antes cada pantalla hacía `typeof window !== 'undefined' ? window.confirm(...)
 * : true`, así que en iOS y Android la acción se ejecutaba sin preguntar.
 */
export function confirmAction(
  title: string,
  message?: string,
  confirmLabel = 'Aceptar',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(text));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}
