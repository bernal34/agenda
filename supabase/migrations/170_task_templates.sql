-- ============================================================
-- 170 — Plantillas de tareas por tablero
--   - task_templates: bundle nombrado de N items
--   - task_template_items: cada item se convierte en una tarea
--     'todo' al aplicar la plantilla.
--   - RLS: miembros del área pueden leer y escribir.
-- ============================================================

create table if not exists ops.task_templates (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references ops.areas(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists task_templates_area_idx
  on ops.task_templates(area_id, created_at);

create table if not exists ops.task_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references ops.task_templates(id) on delete cascade,
  position    int not null default 0,
  title       text not null,
  description text,
  priority    text not null default 'normal'
              check (priority in ('low','normal','high','urgent')),
  labels      text[] not null default '{}'
);

create index if not exists task_template_items_template_idx
  on ops.task_template_items(template_id, position);

alter table ops.task_templates      enable row level security;
alter table ops.task_template_items enable row level security;

drop policy if exists "task_templates read"  on ops.task_templates;
drop policy if exists "task_templates write" on ops.task_templates;
create policy "task_templates read"  on ops.task_templates
  for select to authenticated using (ops.is_area_member(area_id));
create policy "task_templates write" on ops.task_templates
  for all to authenticated
  using (ops.is_area_member(area_id))
  with check (ops.is_area_member(area_id));

drop policy if exists "task_template_items read"  on ops.task_template_items;
drop policy if exists "task_template_items write" on ops.task_template_items;
create policy "task_template_items read" on ops.task_template_items
  for select to authenticated
  using (exists(
    select 1 from ops.task_templates t
     where t.id = task_template_items.template_id
       and ops.is_area_member(t.area_id)
  ));
create policy "task_template_items write" on ops.task_template_items
  for all to authenticated
  using (exists(
    select 1 from ops.task_templates t
     where t.id = task_template_items.template_id
       and ops.is_area_member(t.area_id)
  ))
  with check (exists(
    select 1 from ops.task_templates t
     where t.id = task_template_items.template_id
       and ops.is_area_member(t.area_id)
  ));
