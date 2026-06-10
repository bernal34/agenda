-- ============================================================
-- 130 — Dependencias entre tareas
--   - Nueva tabla ops.task_dependencies (task_id depends_on)
--   - "task_id depende de depends_on" ↔ "depends_on bloquea a task_id"
--   - RLS: leer si sos miembro de cualquiera de las dos áreas;
--          escribir si sos miembro de ambas.
--   - Sin detección de ciclos en v1 (a futuro: WITH RECURSIVE).
-- ============================================================

create table if not exists ops.task_dependencies (
  task_id     uuid not null references ops.tasks(id) on delete cascade,
  depends_on  uuid not null references ops.tasks(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);

create index if not exists task_dependencies_dep_idx
  on ops.task_dependencies(depends_on);

alter table ops.task_dependencies enable row level security;

drop policy if exists "task_deps read" on ops.task_dependencies;
create policy "task_deps read" on ops.task_dependencies
  for select to authenticated
  using (
    exists(
      select 1 from ops.tasks t
       where t.id = task_dependencies.task_id
         and ops.is_area_member(t.area_id)
    )
    or exists(
      select 1 from ops.tasks t
       where t.id = task_dependencies.depends_on
         and ops.is_area_member(t.area_id)
    )
  );

drop policy if exists "task_deps write" on ops.task_dependencies;
create policy "task_deps write" on ops.task_dependencies
  for all to authenticated
  using (
    exists(
      select 1 from ops.tasks t
       where t.id = task_dependencies.task_id
         and ops.is_area_member(t.area_id)
    )
  )
  with check (
    exists(
      select 1 from ops.tasks t
       where t.id = task_dependencies.task_id
         and ops.is_area_member(t.area_id)
    )
    and exists(
      select 1 from ops.tasks t
       where t.id = task_dependencies.depends_on
         and ops.is_area_member(t.area_id)
    )
  );
