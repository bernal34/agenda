// `tasks.status` es texto libre que apunta a `board_stages.code`, así que
// cualquier mapa de color tiene que resolver códigos que no conoce. Sin
// fallback, una etapa personalizada daba `undefined` y terminaba armando
// colores inválidos como "undefined15".

import type { Tokens } from '../constants/theme';

/** Los códigos que crea 040 al dar de alta un área. */
const STATUS_KEY: Record<string, keyof Tokens['status']> = {
  todo:        'todo',
  in_progress: 'progress',
  in_review:   'review',
  done:        'done',
};

/** Color del estado, con los códigos default mapeados y el resto en neutro. */
export function statusColor(t: Tokens, status: string): string {
  return t.status[STATUS_KEY[status] ?? 'todo'];
}

/** Versión con transparencia para fondos tenues (pastillas del calendario). */
export function statusTint(t: Tokens, status: string, alphaHex = '22'): string {
  return statusColor(t, status) + alphaHex;
}
