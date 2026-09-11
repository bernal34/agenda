import { actorIdOf, buildPushMessage, type NotificationRow } from '../../supabase/functions/send-push/message';

function notif(kind: string, payload: Record<string, unknown>): NotificationRow {
  return { id: 'n1', user_id: 'u1', kind, payload };
}

describe('buildPushMessage', () => {
  it('asignación con nombre de quien asignó', () => {
    const msg = buildPushMessage(
      notif('task_assigned', { task_id: 't1', task_title: 'Revisar planos', assigned_by: 'a1' }),
      'Ana López',
    );
    expect(msg).toEqual({
      title: 'Nueva tarea asignada',
      body: 'Ana López te asignó «Revisar planos»',
      url: '/tasks/t1',
      tag: 'task-t1',
    });
  });

  it('mención con vista previa del comentario', () => {
    const msg = buildPushMessage(
      notif('mention', { task_id: 't1', task_title: 'Pagos', preview: '¿lo ves hoy?' }),
      'Beto',
    );
    expect(msg.title).toBe('Beto te mencionó');
    expect(msg.body).toBe('En «Pagos»: ¿lo ves hoy?');
  });

  it('comentario sin nombre conocido usa "Alguien"', () => {
    const msg = buildPushMessage(notif('comment', { task_id: 't1', task_title: 'Pagos' }), null);
    expect(msg.title).toBe('Nuevo comentario de Alguien');
    expect(msg.body).toBe('En «Pagos»');
  });

  it('aviso de inicio muestra la hora en CDMX', () => {
    const msg = buildPushMessage(
      notif('task_start_soon', {
        task_id: 't2',
        task_title: 'Junta de obra',
        start_at: '2026-09-11T15:30:00Z',
      }),
      null,
    );
    expect(msg.title).toBe('Tarea próxima a comenzar');
    expect(msg.body).toBe('«Junta de obra» empieza a las 09:30');
  });

  it('sin tarea abre la lista de avisos', () => {
    const msg = buildPushMessage(notif('task_due', {}), null);
    expect(msg.url).toBe('/notifications');
    expect(msg.tag).toBe('notif-n1');
    expect(msg.body).toBe('«una tarea»');
  });

  it('recorta cuerpos largos', () => {
    const msg = buildPushMessage(
      notif('comment', { task_id: 't1', task_title: 'X', preview: 'a'.repeat(500) }),
      'Ana',
    );
    expect(msg.body.length).toBe(180);
    expect(msg.body.endsWith('…')).toBe(true);
  });
});

describe('actorIdOf', () => {
  it('toma assigned_by o author_id según el tipo', () => {
    expect(actorIdOf(notif('task_assigned', { assigned_by: 'a1' }))).toBe('a1');
    expect(actorIdOf(notif('mention', { author_id: 'a2' }))).toBe('a2');
    expect(actorIdOf(notif('comment', { author_id: 'a3' }))).toBe('a3');
    expect(actorIdOf(notif('task_start_soon', { author_id: 'a4' }))).toBeNull();
  });
});
