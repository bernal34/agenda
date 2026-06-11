-- ============================================================
-- 110 — Archivado manual de tareas
--   - Nueva columna ops.tasks.archived_at timestamptz null
--   - El kanban / "mis tareas" filtran archived_at is null.
--   - El detalle expone botón "Archivar" / "Restaurar".
--   - Borrado físico sigue disponible (delete).
-- ============================================================

alter table ops.tasks
  add column if not exists archived_at timestamptz;

create index if not exists tasks_archived_idx
  on ops.tasks(area_id, archived_at)
  where archived_at is null;
