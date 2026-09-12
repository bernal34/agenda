import { Platform } from 'react-native';
import { Stack } from 'expo-router';

// En web las rutas modales son una ventana flotante (ver ModalScreen), así que
// la pantalla va transparente para que se siga viendo la app detrás. En nativo
// el modal ocupa la pantalla, que es lo idiomático.
const MODAL = {
  presentation: Platform.OS === 'web' ? ('transparentModal' as const) : ('modal' as const),
  animation: Platform.OS === 'web' ? ('fade' as const) : undefined,
};

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="tasks/new" options={MODAL} />
      <Stack.Screen name="tasks/[id]" options={MODAL} />
    </Stack>
  );
}
