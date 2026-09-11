import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { disablePush, enablePush, getPushStatus, syncPush, type PushStatus } from '../push';

export type { PushStatus };

export function usePushStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['push-status', userId],
    enabled: !!userId,
    queryFn: () => getPushStatus(userId!),
  });
}

/** `true` activa (pide permiso; llamar desde un tap), `false` da de baja este dispositivo. */
export function useTogglePush(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enable: boolean): Promise<PushStatus> =>
      enable ? enablePush(userId!) : disablePush(userId!),
    onSuccess: (status) => {
      qc.setQueryData(['push-status', userId], status);
    },
  });
}

// Montar una vez en la raíz autenticada (TabsLayout): re-registra el
// dispositivo si el usuario ya había dado permiso.
export function usePushSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    syncPush(userId).catch((err) => console.warn('No se pudo sincronizar push', err));
  }, [userId]);
}
