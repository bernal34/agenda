-- =====================================================================
-- 220_task_start_reminder.sql
-- Fases 2-3 (versión in-app de "aviso de hora de inicio").
--
-- pg_cron cada 1 min ejecuta ops.fn_dispatch_task_reminders(): busca
-- tareas no archivadas con start_at próximo (dentro de lead_time_minutes)
-- y aún no notificadas, y para cada assignee inserta una fila en
-- ops.notifications con kind='task_start_soon'. Realtime ya entrega esa
-- notif a la pestaña abierta del usuario.
--
-- Cuando Expo Push (APNs/FCM) esté configurado, se agregará una edge
-- function suscrita al insert en ops.notifications que enviará el push
-- real; el dispatcher SQL no cambia.
-- =====================================================================

-- 1. Columnas en tasks
alter table ops.tasks
  add column if not exists reminded_at timestamptz,
  add column if not exists lead_time_minutes integer not null default 5
    check (lead_time_minutes between 0 and 1440);

-- 2. Función dispatcher
create or replace function ops.fn_dispatch_task_reminders()
returns integer
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_count integer := 0;
  r_task record;
begin
  for r_task in
    select t.id, t.title, t.start_at, t.area_id
      from ops.tasks t
     where t.archived_at is null
       and t.start_at is not null
       and t.reminded_at is null
       and t.start_at <= now() + make_interval(mins => t.lead_time_minutes)
       and t.start_at >= now() - interval '15 minutes' -- tareas viejas perdidas
  loop
    insert into ops.notifications (user_id, kind, payload)
    select ta.user_id,
           'task_start_soon',
           jsonb_build_object(
             'task_id',    r_task.id,
             'task_title', r_task.title,
             'start_at',   r_task.start_at,
             'area_id',    r_task.area_id
           )
      from ops.task_assignees ta
     where ta.task_id = r_task.id;

    update ops.tasks set reminded_at = now() where id = r_task.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function ops.fn_dispatch_task_reminders() from public, anon, authenticated;
grant execute on function ops.fn_dispatch_task_reminders() to postgres, service_role;

-- 3. Cron schedule (cada 1 min). pg_cron ya está habilitada.
do $$
begin
  perform cron.unschedule('ops_task_reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'ops_task_reminders',
  '* * * * *',
  $$ select ops.fn_dispatch_task_reminders(); $$
);

-- 4. Trigger: si el start_at o el lead_time cambian, limpiamos reminded_at
--    para volver a notificar con los nuevos parámetros.
create or replace function ops.tg_reset_task_reminder()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if new.start_at is distinct from old.start_at
     or new.lead_time_minutes is distinct from old.lead_time_minutes then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_reset_task_reminder on ops.tasks;
create trigger tg_reset_task_reminder
  before update on ops.tasks
  for each row execute function ops.tg_reset_task_reminder();
