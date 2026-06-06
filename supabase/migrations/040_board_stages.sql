-- ============================================================
-- 040 — Etapas configurables del tablero (board_stages)
-- Reemplaza el enum hardcoded de tasks.status por una tabla
-- por área que se puede editar desde la UI.
-- ============================================================

alter table ops.tasks drop constraint if exists tasks_status_check;

create table if not exists ops.board_stages (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references ops.areas(id) on delete cascade,
  code text not null,
  label text not null,
  color text not null default '#888780',
  sort_order int not null default 0,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (area_id, code)
);

create index if not exists board_stages_area_idx on ops.board_stages(area_id, sort_order);

insert into ops.board_stages (area_id, code, label, color, sort_order, is_done)
select a.id, v.code, v.label, v.color, v.sort_order, v.is_done
from ops.areas a
cross join (values
  ('todo',        'Por hacer',   '#888780', 0, false),
  ('in_progress', 'En progreso', '#EF9F27', 1, false),
  ('in_review',   'En revisión', '#378ADD', 2, false),
  ('done',        'Hecho',       '#639922', 3, true)
) as v(code, label, color, sort_order, is_done)
on conflict (area_id, code) do nothing;

create or replace function ops.seed_default_stages() returns trigger
language plpgsql security definer set search_path = ops, public as $$
begin
  insert into ops.board_stages (area_id, code, label, color, sort_order, is_done)
  values
    (NEW.id, 'todo',        'Por hacer',   '#888780', 0, false),
    (NEW.id, 'in_progress', 'En progreso', '#EF9F27', 1, false),
    (NEW.id, 'in_review',   'En revisión', '#378ADD', 2, false),
    (NEW.id, 'done',        'Hecho',       '#639922', 3, true)
  on conflict (area_id, code) do nothing;
  return NEW;
end $$;

drop trigger if exists seed_stages_on_new_area on ops.areas;
create trigger seed_stages_on_new_area
  after insert on ops.areas
  for each row execute function ops.seed_default_stages();

alter table ops.board_stages enable row level security;

drop policy if exists "board_stages read" on ops.board_stages;
create policy "board_stages read" on ops.board_stages for select to authenticated
  using (core.can_view('ops','boards') and ops.is_area_member(area_id));

drop policy if exists "board_stages write" on ops.board_stages;
create policy "board_stages write" on ops.board_stages for all to authenticated
  using (core.can_edit('ops','boards') and ops.is_area_member(area_id))
  with check (core.can_edit('ops','boards') and ops.is_area_member(area_id));
