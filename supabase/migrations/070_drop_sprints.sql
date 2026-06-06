-- 070_drop_sprints.sql
-- Elimina la capa de "sprints" del modelo. Decisión de producto:
-- sprint es vocabulario Scrum y para una org operativa (no equipo de
-- software) introduce jerga forzada sin valor real. La organización
-- temporal se hace por `due_date` directamente.
--
-- DESTRUCTIVO. Borra:
--   - La columna `tasks.sprint_id` (incluye FK e índice automáticamente)
--   - La tabla `ops.sprints` con sus políticas RLS y datos
--   - Todas las notificaciones de tipo `sprint_closed`
--   - El valor 'sprint_closed' del check constraint de `notifications.kind`
--
-- Las tareas conservan su área y due_date.

-- 1. Borrar notificaciones de tipo sprint_closed (necesario antes de cambiar el check)
delete from ops.notifications where kind = 'sprint_closed';

-- 2. Re-definir el check constraint sin 'sprint_closed'
alter table ops.notifications drop constraint if exists notifications_kind_check;
alter table ops.notifications add constraint notifications_kind_check
  check (kind in ('task_assigned','task_due','mention','comment'));

-- 3. Drop policies on ops.sprints
drop policy if exists "sprints read"  on ops.sprints;
drop policy if exists "sprints write" on ops.sprints;

-- 4. Drop column sprint_id en ops.tasks (FK y tasks_sprint_idx caen automáticamente)
alter table ops.tasks drop column if exists sprint_id;

-- 5. Drop table ops.sprints
drop table if exists ops.sprints;
