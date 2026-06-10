-- ============================================================
-- 160 — Auto-archivado de tareas hechas
--   - Nueva col ops.tasks.completed_at: se setea al pasar a 'done'
--     y se borra si vuelve a otro estado.
--   - pg_cron: job diario a las 03:00 UTC (≈ 00:00 ART) que setea
--     archived_at = now() para tareas en 'done' cuya completed_at
--     sea anterior al inicio del día actual.
--   - Visualmente las cards en 'done' se muestran tachadas hoy
--     y desaparecen del kanban al día siguiente.
-- ============================================================

alter table ops.tasks
  add column if not exists completed_at timestamptz;

create or replace function ops.touch_completed_at()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'done' and (OLD.status is null or OLD.status <> 'done') then
    NEW.completed_at := coalesce(NEW.completed_at, now());
  elsif NEW.status <> 'done' and OLD.status = 'done' then
    NEW.completed_at := null;
  end if;
  return NEW;
end $$;

drop trigger if exists touch_completed_at on ops.tasks;
create trigger touch_completed_at
  before update on ops.tasks
  for each row execute function ops.touch_completed_at();

-- Backfill: a las que YA están en 'done' las marcamos con created_at
-- para que el cron las archive en la próxima corrida.
update ops.tasks
   set completed_at = created_at
 where status = 'done'
   and completed_at is null
   and archived_at is null;

-- pg_cron daily job
create extension if not exists pg_cron with schema extensions;
grant usage on schema cron to postgres;

-- Re-créa el job (unschedule si ya existe)
do $$
begin
  perform cron.unschedule('ops-auto-archive-done');
exception when others then null;
end $$;

select cron.schedule(
  'ops-auto-archive-done',
  '0 3 * * *',
  $cron$
    update ops.tasks
       set archived_at = now()
     where status = 'done'
       and archived_at is null
       and completed_at is not null
       and completed_at < date_trunc('day', now());
  $cron$
);
