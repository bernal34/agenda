-- =====================================================================
-- 210_task_start_at.sql
-- Fase 1 de "task con hora de inicio": agrega start_at timestamptz a
-- ops.tasks para tareas tipo agenda. Nullable; cuando no se llena la
-- tarea se comporta como antes (solo fecha vía due_date).
--
-- El index sirve para la Fase 3 (edge function cron que busca tareas
-- próximas a su hora de inicio para disparar push notifications).
-- =====================================================================

alter table ops.tasks
  add column if not exists start_at timestamptz;

create index if not exists tasks_start_at_idx on ops.tasks (start_at)
  where archived_at is null and start_at is not null;
