import {
  resolveNativePushStatus,
  resolveWebPushStatus,
  shouldAutoSyncNative,
  shouldAutoSyncWeb,
  urlBase64ToUint8Array,
  type NativePushEnv,
  type WebPushEnv,
} from '../pushModel';

const web: WebPushEnv = {
  vapidConfigured: true,
  hasServiceWorker: true,
  hasPushManager: true,
  isIOS: false,
  isStandalone: false,
  permission: 'default',
  hasSubscription: false,
  optedOut: false,
};

describe('resolveWebPushStatus', () => {
  it('sin llave VAPID no se ofrece', () => {
    expect(resolveWebPushStatus({ ...web, vapidConfigured: false })).toBe('unsupported');
  });

  it('en iPhone desde Safari pide instalar la app', () => {
    expect(
      resolveWebPushStatus({ ...web, hasPushManager: false, isIOS: true, isStandalone: false }),
    ).toBe('needs-install');
  });

  it('navegador sin PushManager fuera de iOS no es compatible', () => {
    expect(resolveWebPushStatus({ ...web, hasPushManager: false })).toBe('unsupported');
  });

  it('permiso bloqueado', () => {
    expect(resolveWebPushStatus({ ...web, permission: 'denied' })).toBe('denied');
  });

  it('permiso concedido con suscripción está activo', () => {
    expect(
      resolveWebPushStatus({ ...web, permission: 'granted', hasSubscription: true }),
    ).toBe('enabled');
  });

  it('si el usuario se dio de baja se muestra desactivado aunque haya permiso', () => {
    expect(
      resolveWebPushStatus({ ...web, permission: 'granted', hasSubscription: true, optedOut: true }),
    ).toBe('disabled');
  });

  it('sin preguntar todavía está desactivado', () => {
    expect(resolveWebPushStatus(web)).toBe('disabled');
  });
});

describe('shouldAutoSyncWeb', () => {
  it('re-registra solo con permiso concedido y sin baja', () => {
    expect(shouldAutoSyncWeb({ ...web, permission: 'granted' })).toBe(true);
    expect(shouldAutoSyncWeb({ ...web, permission: 'granted', optedOut: true })).toBe(false);
    expect(shouldAutoSyncWeb({ ...web, permission: 'default' })).toBe(false);
    expect(shouldAutoSyncWeb({ ...web, permission: 'granted', hasPushManager: false })).toBe(false);
  });
});

const native: NativePushEnv = {
  isDevice: true,
  hasProjectId: true,
  permission: 'undetermined',
  canAskAgain: true,
  optedOut: false,
};

describe('resolveNativePushStatus', () => {
  it('simulador o build sin projectId de EAS no es compatible', () => {
    expect(resolveNativePushStatus({ ...native, isDevice: false })).toBe('unsupported');
    expect(resolveNativePushStatus({ ...native, hasProjectId: false })).toBe('unsupported');
  });

  it('denegado sin poder volver a preguntar', () => {
    expect(resolveNativePushStatus({ ...native, permission: 'denied', canAskAgain: false })).toBe('denied');
  });

  it('denegado pero se puede volver a preguntar queda desactivado', () => {
    expect(resolveNativePushStatus({ ...native, permission: 'denied', canAskAgain: true })).toBe('disabled');
  });

  it('concedido y sin baja está activo', () => {
    expect(resolveNativePushStatus({ ...native, permission: 'granted' })).toBe('enabled');
    expect(resolveNativePushStatus({ ...native, permission: 'granted', optedOut: true })).toBe('disabled');
  });

  it('auto-sync solo con permiso concedido', () => {
    expect(shouldAutoSyncNative({ ...native, permission: 'granted' })).toBe(true);
    expect(shouldAutoSyncNative(native)).toBe(false);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url con padding faltante', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });

  it('una llave pública VAPID son 65 bytes sin comprimir', () => {
    const key =
      'BJpm_4-y6v20fX2K0o6C8XjMN5roA2M3BW6fYkKVnj5wvB8fVuFxFFiomlVpjJunRmYaeO1ffnn5IXp5yDKEoBQ';
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });
});
