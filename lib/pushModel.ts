// Lógica pura de push notifications, sin dependencias de navegador ni de Expo.

export type PushStatus =
  | 'unsupported'   // el dispositivo/navegador no puede recibir push (o falta configuración)
  | 'needs-install' // iPhone/iPad: solo funciona con la app agregada a la pantalla de inicio
  | 'denied'        // el usuario bloqueó los permisos; hay que cambiarlo en ajustes
  | 'disabled'      // se puede activar
  | 'enabled';

export type WebPermission = 'default' | 'granted' | 'denied';

export interface WebPushEnv {
  vapidConfigured: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: WebPermission;
  hasSubscription: boolean;
  optedOut: boolean;
}

export function resolveWebPushStatus(env: WebPushEnv): PushStatus {
  if (!env.vapidConfigured) return 'unsupported';
  if (!env.hasServiceWorker || !env.hasPushManager) {
    return env.isIOS && !env.isStandalone ? 'needs-install' : 'unsupported';
  }
  if (env.permission === 'denied') return 'denied';
  if (env.permission === 'granted' && env.hasSubscription && !env.optedOut) return 'enabled';
  return 'disabled';
}

/**
 * Si el permiso ya está concedido y el usuario no se dio de baja, al abrir
 * la app se (re)registra el dispositivo sin volver a preguntar.
 */
export function shouldAutoSyncWeb(env: WebPushEnv): boolean {
  return (
    env.vapidConfigured &&
    env.hasServiceWorker &&
    env.hasPushManager &&
    env.permission === 'granted' &&
    !env.optedOut
  );
}

export type NativePermission = 'granted' | 'denied' | 'undetermined';

export interface NativePushEnv {
  isDevice: boolean;
  hasProjectId: boolean;
  permission: NativePermission;
  canAskAgain: boolean;
  optedOut: boolean;
}

export function resolveNativePushStatus(env: NativePushEnv): PushStatus {
  if (!env.isDevice || !env.hasProjectId) return 'unsupported';
  if (env.permission === 'denied' && !env.canAskAgain) return 'denied';
  if (env.permission === 'granted' && !env.optedOut) return 'enabled';
  return 'disabled';
}

export function shouldAutoSyncNative(env: NativePushEnv): boolean {
  return env.isDevice && env.hasProjectId && env.permission === 'granted' && !env.optedOut;
}

/** Llave pública VAPID (base64url) → bytes para PushManager.subscribe. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Llave válida para SecureStore (solo alfanuméricos, '.', '-' y '_') y localStorage. */
export function optOutKey(userId: string): string {
  return `ops-push-optout.${userId}`;
}
