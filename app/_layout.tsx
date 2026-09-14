import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ThemeProvider, useTheme } from '../lib/theme';
// SSO from the portal now uses Supabase magic-link redirects (hash tokens),
// which detectSessionInUrl=true on the supabase client consumes automatically.
// No manual handler needed.

const queryClient = new QueryClient();

function useProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const onResetScreen = (segments as string[])[1] === 'reset-password';

    if (recoveryMode) {
      if (!onResetScreen) router.replace('/reset-password');
      return;
    }

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router, recoveryMode]);
}

/**
 * Pantalla de arranque. Lleva fondo propio a propósito: sin él, el primer
 * frame en modo oscuro salía blanco.
 */
function BootSplash() {
  const { t } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: t.bg.app,
      }}
    >
      <ActivityIndicator size="large" color={t.brand[600]} />
    </View>
  );
}

function RootLayoutNav() {
  useProtectedRoute();
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return <BootSplash />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const setRecoveryMode = useAuthStore((s) => s.setRecoveryMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setHydrated(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, [setSession, setRecoveryMode]);

  // `ThemeProvider` se monta siempre, incluso sin hidratar: antes la espera de
  // sesión devolvía temprano y quedaba fuera del provider, así que la pantalla
  // de carga no tenía forma de conocer el esquema.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ThemedStatusBar />
          {hydrated ? <RootLayoutNav /> : <BootSplash />}
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** La barra de estado estaba fija en oscuro; ahora sigue al tema. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
