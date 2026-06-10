import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { tokens } from '../constants/theme';

// SSO bridge from portal-hub: portal opens OpsBoard with ?ops_refresh_token=... in URL.
// We consume the token, refresh the session, and strip it from the URL.
async function consumePortalSsoToken() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const token = url.searchParams.get('ops_refresh_token');
  if (!token) return;
  url.searchParams.delete('ops_refresh_token');
  window.history.replaceState({}, '', url.toString());
  try {
    await supabase.auth.refreshSession({ refresh_token: token });
  } catch (err) {
    console.warn('SSO bridge: refreshSession failed', err);
  }
}

const queryClient = new QueryClient();

function useProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const onResetScreen = segments[1] === 'reset-password';

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

function RootLayoutNav() {
  useProtectedRoute();
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tokens.brand[600]} />
      </View>
    );
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
    (async () => {
      await consumePortalSsoToken();
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setHydrated(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, [setSession, setRecoveryMode]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tokens.brand[600]} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootLayoutNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
