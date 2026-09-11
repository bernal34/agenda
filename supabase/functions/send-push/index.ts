// Edge function send-push
//
// La llama el trigger ops.tg_dispatch_push (migración 250) por pg_net con
// { notification_id } y el header x-push-secret. Reparte la notificación a
// todos los dispositivos del destinatario:
//   - web          → Web Push (VAPID)
//   - ios/android  → Expo Push API
// Borra las suscripciones que el proveedor reporta como muertas.
//
// Deploy sin verificación de JWT (la autenticación es el x-push-secret):
//   supabase functions deploy send-push --project-ref mgfjswovpfrzjutmbevr --no-verify-jwt
// Secrets: PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

import { actorIdOf, buildPushMessage, type NotificationRow, type PushMessage } from './message.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:lbernal@grupoprelar.com';

const webPushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (webPushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Subscription {
  id: string;
  platform: 'web' | 'ios' | 'android';
  endpoint: string;
  p256dh_key: string | null;
  auth_key: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendWeb(s: Subscription, msg: PushMessage, notificationId: string): Promise<'ok' | 'gone'> {
  if (!webPushReady || !s.p256dh_key || !s.auth_key) return 'ok';
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
      JSON.stringify({ ...msg, notification_id: notificationId }),
      { TTL: 60 * 60 * 12, urgency: 'high' },
    );
    return 'ok';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    throw err;
  }
}

/** Devuelve los ids de suscripciones que Expo reporta como DeviceNotRegistered. */
async function sendExpo(subs: Subscription[], msg: PushMessage, notificationId: string): Promise<string[]> {
  if (subs.length === 0) return [];
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      subs.map((s) => ({
        to: s.endpoint,
        title: msg.title,
        body: msg.body,
        sound: 'default',
        channelId: 'default',
        data: { url: msg.url, notification_id: notificationId },
      })),
    ),
  });
  if (!res.ok) throw new Error(`expo push ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as {
    data?: { status: string; details?: { error?: string } }[];
  };
  const gone: string[] = [];
  (data ?? []).forEach((ticket, i) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      gone.push(subs[i].id);
    }
  });
  return gone;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!WEBHOOK_SECRET || req.headers.get('x-push-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  let notificationId: unknown;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  if (typeof notificationId !== 'string') return json({ error: 'notification_id required' }, 400);

  const { data: notif, error: notifErr } = await admin
    .schema('ops')
    .from('notifications')
    .select('id, user_id, kind, payload')
    .eq('id', notificationId)
    .maybeSingle<NotificationRow>();
  if (notifErr) return json({ error: notifErr.message }, 500);
  if (!notif) return json({ skipped: 'notification not found' });

  const { data: subs, error: subsErr } = await admin
    .schema('ops')
    .from('push_subscriptions')
    .select('id, platform, endpoint, p256dh_key, auth_key')
    .eq('user_id', notif.user_id)
    .returns<Subscription[]>();
  if (subsErr) return json({ error: subsErr.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0 });

  let actorName: string | null = null;
  const actorId = actorIdOf(notif);
  if (actorId) {
    const { data } = await admin
      .schema('core')
      .from('profiles')
      .select('full_name')
      .eq('id', actorId)
      .maybeSingle<{ full_name: string | null }>();
    actorName = data?.full_name ?? null;
  }

  const msg = buildPushMessage(notif, actorName);
  const stale: string[] = [];
  const web = subs.filter((s) => s.platform === 'web');
  const native = subs.filter((s) => s.platform !== 'web');

  const results = await Promise.allSettled([
    ...web.map((s) =>
      sendWeb(s, msg, notif.id).then((r) => {
        if (r === 'gone') stale.push(s.id);
      }),
    ),
    sendExpo(native, msg, notif.id).then((gone) => {
      stale.push(...gone);
    }),
  ]);

  if (stale.length > 0) {
    await admin.schema('ops').from('push_subscriptions').delete().in('id', stale);
  }

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String(r.reason));
  if (failed.length > 0) console.error('send-push failures', failed);

  return json({ devices: subs.length, stale: stale.length, failed: failed.length });
});
