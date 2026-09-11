-- =====================================================================
-- 250_push_subscriptions.sql
-- Push notifications reales (web + nativo) sobre ops.notifications.
--
-- - ops.push_subscriptions: un registro por dispositivo.
--     web:          endpoint del PushSubscription + llaves p256dh/auth
--     ios/android:  endpoint = ExponentPushToken[...]
-- - Escritura solo vía RPC (register/unregister). register reasigna el
--   dispositivo al usuario actual si otro lo tenía (equipo compartido).
-- - Trigger AFTER INSERT en ops.notifications: si el destinatario tiene
--   dispositivos, llama por pg_net a la edge function `send-push`.
--   Nunca hace fallar el insert de la notificación.
--
-- Configuración manual (una vez; NO va en la migración):
--   select vault.create_secret('https://mgfjswovpfrzjutmbevr.supabase.co/functions/v1/send-push', 'ops_push_function_url');
--   select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'ops_push_webhook_secret');
-- Sin esos secrets el trigger es no-op.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------
-- 1. Tabla
-- ------------------------------------------------------------
create table if not exists ops.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('web','ios','android')),
  endpoint      text not null unique,
  p256dh_key    text,
  auth_key      text,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  constraint push_subscriptions_web_keys
    check (platform <> 'web' or (p256dh_key is not null and auth_key is not null))
);

create index if not exists push_subscriptions_user_idx on ops.push_subscriptions(user_id);

alter table ops.push_subscriptions enable row level security;

grant select on ops.push_subscriptions to authenticated;
grant all    on ops.push_subscriptions to service_role;

drop policy if exists "push_subscriptions self read" on ops.push_subscriptions;
create policy "push_subscriptions self read" on ops.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. RPCs de registro
-- ------------------------------------------------------------
create or replace function ops.register_push_subscription(
  p_platform   text,
  p_endpoint   text,
  p_p256dh     text default null,
  p_auth       text default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ops, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No authenticated user';
  end if;

  insert into ops.push_subscriptions (user_id, platform, endpoint, p256dh_key, auth_key, user_agent)
  values (v_uid, p_platform, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        p256dh_key   = excluded.p256dh_key,
        auth_key     = excluded.auth_key,
        user_agent   = excluded.user_agent,
        last_seen_at = now();
end;
$$;

create or replace function ops.unregister_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = ops, public
as $$
  delete from ops.push_subscriptions
   where endpoint = p_endpoint
     and user_id = auth.uid();
$$;

revoke all on function ops.register_push_subscription(text, text, text, text, text) from public, anon;
revoke all on function ops.unregister_push_subscription(text) from public, anon;
grant execute on function ops.register_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function ops.unregister_push_subscription(text) to authenticated;

-- ------------------------------------------------------------
-- 3. Dispatcher: notificación nueva → edge function send-push
-- ------------------------------------------------------------
create or replace function ops.tg_dispatch_push()
returns trigger
language plpgsql security definer set search_path = ops, public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from ops.push_subscriptions where user_id = NEW.user_id) then
    return NEW;
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'ops_push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ops_push_webhook_secret';
  if v_url is null or v_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url                  := v_url,
    body                 := jsonb_build_object('notification_id', NEW.id),
    headers              := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return NEW;
exception when others then
  raise warning 'ops.tg_dispatch_push: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists dispatch_push_on_notification on ops.notifications;
create trigger dispatch_push_on_notification
  after insert on ops.notifications
  for each row execute function ops.tg_dispatch_push();
