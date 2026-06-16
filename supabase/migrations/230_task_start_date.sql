-- =====================================================================
-- 230_task_start_date.sql
-- Agrega start_date (DATE) a ops.tasks para soportar tareas con rango
-- de fechas (inicio + fin). due_date pasa a comportarse como "fecha
-- final" en la UI; mantenemos el nombre de columna para no romper
-- queries históricas. Nullable: tareas sin fecha de inicio explícita
-- siguen funcionando igual.
--
-- start_at (la hora de inicio, agregada en 210) se ancla a start_date,
-- no a due_date; eso permite que la tarea cubra varios días y aun así
-- el aviso se dispare en el momento correcto.
-- =====================================================================

alter table ops.tasks
  add column if not exists start_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_date_range_chk' and conrelid = 'ops.tasks'::regclass
  ) then
    alter table ops.tasks
      add constraint tasks_date_range_chk
      check (start_date is null or due_date is null or start_date <= due_date);
  end if;
end $$;

create index if not exists tasks_start_date_idx on ops.tasks (start_date)
  where archived_at is null and start_date is not null;
