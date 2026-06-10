import type { AppNotification } from '../notificationModel';
import { countUnread, prependNotification } from '../notificationModel';

function notif(partial: Partial<AppNotification>): AppNotification {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    kind: 'comment',
    payload: {},
    read_at: null,
    created_at: '2026-06-10T12:00:00Z',
    ...partial,
  };
}

describe('prependNotification', () => {
  it('crea la lista si la caché está vacía', () => {
    const row = notif({ id: 'n1' });
    expect(prependNotification(undefined, row)).toEqual([row]);
  });

  it('agrega al frente de la lista', () => {
    const prev = [notif({ id: 'n1' })];
    const row = notif({ id: 'n2' });
    const next = prependNotification(prev, row);
    expect(next.map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('descarta duplicados por id sin mutar la lista', () => {
    const prev = [notif({ id: 'n1' }), notif({ id: 'n2' })];
    const next = prependNotification(prev, notif({ id: 'n2' }));
    expect(next).toBe(prev);
    expect(next).toHaveLength(2);
  });
});

describe('countUnread', () => {
  it('cuenta solo las no leídas', () => {
    const list = [
      notif({ read_at: null }),
      notif({ read_at: '2026-06-10T13:00:00Z' }),
      notif({ read_at: null }),
    ];
    expect(countUnread(list)).toBe(2);
  });

  it('devuelve 0 para undefined o lista vacía', () => {
    expect(countUnread(undefined)).toBe(0);
    expect(countUnread([])).toBe(0);
  });
});
