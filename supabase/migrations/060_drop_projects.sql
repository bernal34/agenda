-- 060_drop_projects.sql
-- Elimina la capa de "proyectos" del modelo. Decisión de producto:
-- la jerarquía área → proyecto → sprint → tarea es overkill para una org
-- de 30-50 personas. Se mantiene área → sprint → tarea.
--
-- DESTRUCTIVO. Borra:
--   - El valor de `tasks.project_id` para todas las tareas existentes
--   - La columna `tasks.project_id` (incluye FK e índices automáticos)
--   - La tabla `ops.projects` con todas sus políticas RLS y datos
--
-- Las tareas que tenían un proyecto asignado conservan su área y sprint;
-- solo pierden el campo `project_id`.

-- 1. Drop policies on ops.projects (necesario antes de drop table porque tiene RLS)
drop policy if exists "projects read"  on ops.projects;
drop policy if exists "projects write" on ops.projects;

-- 2. Drop column project_id en ops.tasks
--    (la FK y los índices asociados se borran automáticamente con la columna)
alter table ops.tasks drop column if exists project_id;

-- 3. Drop table ops.projects
drop table if exists ops.projects;
