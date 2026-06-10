-- ============================================================
-- 180 — Custom fields por tablero
--   - ops.custom_fields: definiciones (text/number/date/select/url)
--   - ops.task_custom_values: valor por tarea (jsonb)
--   - RLS: leer fields si sos miembro del área; escribir definiciones
--     solo owner/admin (reusamos can_manage_area_members del 120).
--     Valores: leer y escribir si sos miembro del área de la tarea.
-- ============================================================

create table if not exists ops.custom_fields (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references ops.areas(id) on delete cascade,
  key         text not null,
  label       text not null,
  type        text not null check (type in ('text','number','date','select','url')),
  options     jsonb,
  position    int not null default 0,
  required    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique(area_id, key)
);

create index if not exists custom_fields_area_idx
  on ops.custom_fields(area_id, position);

create table if not exists ops.task_custom_values (
  task_id     uuid not null references ops.tasks(id) on delete cascade,
  field_id    uuid not null references ops.custom_fields(id) on delete cascade,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (task_id, field_id)
);

create index if not exists task_custom_values_field_idx
  on ops.task_custom_values(field_id);

alter table ops.custom_fields      enable row level security;
alter table ops.task_custom_values enable row level security;

drop policy if exists "custom_fields read"  on ops.custom_fields;
drop policy if exists "custom_fields write" on ops.custom_fields;
create policy "custom_fields read" on ops.custom_fields
  for select to authenticated using (ops.is_area_member(area_id));
create policy "custom_fields write" on ops.custom_fields
  for all to authenticated
  using (ops.can_manage_area_members(area_id))
  with check (ops.can_manage_area_members(area_id));

drop policy if exists "task_custom_values read"  on ops.task_custom_values;
drop policy if exists "task_custom_values write" on ops.task_custom_values;
create policy "task_custom_values read" on ops.task_custom_values
  for select to authenticated
  using (exists(
    select 1 from ops.tasks t
     where t.id = task_custom_values.task_id
       and ops.is_area_member(t.area_id)
  ));
create policy "task_custom_values write" on ops.task_custom_values
  for all to authenticated
  using (exists(
    select 1 from ops.tasks t
     where t.id = task_custom_values.task_id
       and ops.is_area_member(t.area_id)
  ))
  with check (exists(
    select 1 from ops.tasks t
     where t.id = task_custom_values.task_id
       and ops.is_area_member(t.area_id)
  ));
