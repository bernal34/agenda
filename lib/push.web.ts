// Web Push (PWA). Contraparte web de lib/push.ts: Metro elige este archivo
// en web y push.ts en iOS/Android. Mantener la misma API exportada.

import { supabase } from './supabase';
import {
  optOutKey,
  pushSubscribeErrorMessage,
  resolveWebPushStatus,
  shouldAutoSyncWeb,
  urlBase64ToUint8Array,
  type PushStatus,
  type WebPushEnv,
} from './pushModel';

export type { PushStatus };

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function readOptOut(userId: string): boolean {
  try {
    return window.localStorage.getItem(optOutKey(userId)) === '1';
  } catch {
    return false;
  }
}

function writeOptOut(userId: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(optOutKey(userId), '1');
    else window.localStorage.removeItem(optOutKey(userId));
  } catch {
    // almacenamiento bloqueado: no pasa nada, solo no se recuerda la baja
  }
}

// El service worker también se registra desde app/+html.tsx, pero ese archivo
// solo aplica con output estático; registrarlo aquí lo garantiza.
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function readEnv(userId: string | undefined) {
  const hasWindow = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  const hasServiceWorker = hasWindow && 'serviceWorker' in navigator;
  const hasPushManager = hasWindow && 'PushManager' in window && 'Notification' in window;
  const ua = hasWindow ? navigator.userAgent : '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (hasWindow && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    hasWindow &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  const reg = hasServiceWorker && hasPushManager ? await getRegistration() : null;
  const sub = reg ? await reg.pushManager.getSubscription() : null;

  const env: WebPushEnv = {
    vapidConfigured: !!VAPID_PUBLIC_KEY,
    hasServiceWorker,
    hasPushManager,
    isIOS,
    isStandalone,
    permission: hasPushManager ? Notification.permission : 'default',
    hasSubscription: !!sub,
    optedOut: userId ? readOptOut(userId) : false,
  };
  return { env, reg, sub };
}

async function subscribe(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (err) {
    // El navegador falla contra su propio servicio de push (Brave apagado,
    // firewall). El texto crudo no le dice nada al usuario.
    throw new Error(pushSubscribeErrorMessage(err));
  }
}

async function register(sub: PushSubscription) {
  const keys = sub.toJSON().keys ?? {};
  const { error } = await supabase.rpc('register_push_subscription', {
    p_platform: 'web',
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh ?? null,
    p_auth: keys.auth ?? null,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

export async function getPushStatus(userId: string): Promise<PushStatus> {
  const { env } = await readEnv(userId);
  return resolveWebPushStatus(env);
}

/** Pide permiso (debe llamarse desde un tap/click) y registra este navegador. */
export async function enablePush(userId: string): Promise<PushStatus> {
  const canPush =
    !!VAPID_PUBLIC_KEY &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator;
  if (!canPush) return getPushStatus(userId);

  // Primero el permiso, antes de cualquier otro await: Safari solo muestra el
  // diálogo si la llamada sigue "dentro" del gesto del usuario.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';

  const reg = await getRegistration();
  if (!reg) return 'unsupported';
  await register((await reg.pushManager.getSubscription()) ?? (await subscribe(reg)));
  writeOptOut(userId, false);
  return 'enabled';
}

export async function disablePush(userId: string): Promise<PushStatus> {
  writeOptOut(userId, true);
  await forgetThisDevice();
  return getPushStatus(userId);
}

/** Quita este navegador de la DB y cancela la suscripción. Llamar antes de cerrar sesión. */
export async function forgetThisDevice(): Promise<void> {
  const { sub } = await readEnv(undefined);
  if (!sub) return;
  await supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
}

/** Al abrir la app: si ya había permiso, re-registra el navegador para este usuario. */
export async function syncPush(userId: string): Promise<void> {
  const { env, reg, sub } = await readEnv(userId);
  if (!reg || !shouldAutoSyncWeb(env)) return;
  await register(sub ?? (await subscribe(reg)));
}

/** En web el tap lo resuelve el service worker (notificationclick). */
export function usePushNavigation(): void {}
