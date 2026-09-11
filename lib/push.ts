// Push nativas (iOS/Android) vía Expo Push. En web Metro usa push.web.ts;
// mantener la misma API exportada en ambos archivos.
//
// Requiere un projectId de EAS en app.json (`eas init`) y credenciales de
// APNs/FCM (`eas credentials`). Sin projectId el estado es 'unsupported'.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import { supabase } from './supabase';
import {
  optOutKey,
  resolveNativePushStatus,
  shouldAutoSyncNative,
  type NativePermission,
  type NativePushEnv,
  type PushStatus,
} from './pushModel';

export type { PushStatus };

const TOKEN_KEY = 'ops-push-token';

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

// Con la app abierta también mostramos el aviso (por defecto se oculta).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function readOptOut(userId: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(optOutKey(userId))) === '1';
  } catch {
    return false;
  }
}

async function writeOptOut(userId: string, value: boolean) {
  try {
    if (value) await SecureStore.setItemAsync(optOutKey(userId), '1');
    else await SecureStore.deleteItemAsync(optOutKey(userId));
  } catch {
    // sin almacenamiento seguro solo no se recuerda la baja
  }
}

async function readEnv(userId: string | undefined): Promise<NativePushEnv> {
  const perm = await Notifications.getPermissionsAsync();
  const permission: NativePermission = perm.granted
    ? 'granted'
    : String(perm.status) === 'denied'
      ? 'denied'
      : 'undetermined';
  return {
    isDevice: Device.isDevice,
    hasProjectId: !!projectId,
    permission,
    canAskAgain: perm.canAskAgain,
    optedOut: userId ? await readOptOut(userId) : false,
  };
}

async function registerToken(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_subscription', {
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_endpoint: token,
    p_user_agent: `${Device.modelName ?? 'dispositivo'} · ${Platform.OS} ${Platform.Version}`,
  });
  if (error) throw error;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getPushStatus(userId: string): Promise<PushStatus> {
  return resolveNativePushStatus(await readEnv(userId));
}

export async function enablePush(userId: string): Promise<PushStatus> {
  const env = await readEnv(userId);
  const status = resolveNativePushStatus({ ...env, optedOut: false });
  if (status === 'unsupported' || status === 'denied') return status;

  if (env.permission !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (!req.granted) return req.canAskAgain ? 'disabled' : 'denied';
  }

  await registerToken();
  await writeOptOut(userId, false);
  return 'enabled';
}

export async function disablePush(userId: string): Promise<PushStatus> {
  await writeOptOut(userId, true);
  await forgetThisDevice();
  return getPushStatus(userId);
}

/** Quita este dispositivo de la DB. Llamar antes de cerrar sesión. */
export async function forgetThisDevice(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await supabase.rpc('unregister_push_subscription', { p_endpoint: token });
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

/** Al abrir la app: si ya había permiso, re-registra el token para este usuario. */
export async function syncPush(userId: string): Promise<void> {
  const env = await readEnv(userId);
  if (!shouldAutoSyncNative(env)) return;
  await registerToken();
}

function openFromNotification(notification: Notifications.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

/** Al tocar una push (con la app abierta o desde cerrada) navega a la tarea. */
export function usePushNavigation(): void {
  useEffect(() => {
    let mounted = true;

    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) {
      openFromNotification(last.notification);
      Notifications.clearLastNotificationResponse();
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (mounted) openFromNotification(response.notification);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}
