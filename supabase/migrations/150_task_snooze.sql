-- ============================================================
-- 150 — Snooze / posponer tareas (por asignado)
--   - Nueva columna ops.task_assignees.snoozed_until timestamptz
--   - Si está en futuro, la tarea no aparece en "mis tareas" del
--     usuario asignado hasta que pase la fecha.
--   - No afecta status, ni a otros asignados, ni al kanban del área.
-- ============================================================

alter table ops.task_assignees
  add column if not exists snoozed_until timestamptz;

create index if not exists task_assignees_snoozed_idx
  on ops.task_assignees(user_id, snoozed_until)
  where snoozed_until is not null;
