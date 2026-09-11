-- =====================================================================
-- 240_fix_archive_tz_and_notif_kinds.sql
--
-- 1. notifications.kind: el check re-definido en 070 no incluye
--    'task_start_soon', que 220 inserta desde el cron de recordatorios.
--    Sin esto cada corrida de ops_task_reminders falla por check
--    violation y los avisos de hora de inicio nunca llegan.
--
-- 2. Auto-archivado (160) en hora de CDMX. El job original corría a las
--    03:00 UTC (21:00 CDMX) y cortaba en date_trunc('day', now()) según
--    la zona de la DB (UTC), así que una tarea completada en la mañana
--    desaparecía esa misma noche. Ahora corre a las 00:05 CDMX y el corte
--    es la medianoche de CDMX, sin depender del timezone de la sesión.
--    México no tiene horario de verano desde 2022, así que 06:05 UTC
--    equivale siempre a 00:05 CDMX (pg_cron agenda en UTC).
--
-- Idempotente.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Check de notifications.kind
-- ------------------------------------------------------------
alter table ops.notifications drop constraint if exists notifications_kind_check;
alter table ops.notifications add constraint notifications_kind_check
  check (kind in ('task_assigned','task_due','task_start_soon','mention','comment'));

-- ------------------------------------------------------------
-- 2. Auto-archivado en hora local
-- ------------------------------------------------------------
create or replace function ops.fn_auto_archive_done()
returns integer
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_count integer;
begin
  update ops.tasks
     set archived_at = now()
   where status = 'done'
     and archived_at is null
     and completed_at is not null
     and completed_at < (date_trunc('day', now() at time zone 'America/Mexico_City')
                         at time zone 'America/Mexico_City');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function ops.fn_auto_archive_done() from public, anon, authenticated;
grant execute on function ops.fn_auto_archive_done() to postgres, service_role;

do $$
begin
  perform cron.unschedule('ops-auto-archive-done');
exception when others then null;
end $$;

select cron.schedule(
  'ops-auto-archive-done',
  '5 6 * * *',
  $cron$ select ops.fn_auto_archive_done(); $cron$
);
