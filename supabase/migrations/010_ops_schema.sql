-- ============================================================
-- 010 — OpsBoard schema (ops.*)
-- ============================================================
-- Depende de:
--   - 000_core_identity.sql  (schema core, helpers can_view/can_edit)
-- Idempotente: usa `if not exists` y `drop policy if exists` donde aplica.
-- Toca solo el schema `ops` (vacío hasta esta migración) y publication realtime.
-- No modifica `public`, `auth`, `core`, `rh`, `esc`.
-- ============================================================

-- ------------------------------------------------------------
-- Áreas / departamentos (mismo concepto que en CLAUDE.md)
-- ------------------------------------------------------------
create table ops.areas (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references core.organizations(id),
  name       text not null,
  slug       text not null,
  color      text not null default '#534AB7',
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table ops.area_members (
  area_id uuid not null references ops.areas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index area_members_user_idx on ops.area_members(user_id);

-- ------------------------------------------------------------
-- Proyectos y sprints
-- ------------------------------------------------------------
create table ops.projects (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references ops.areas(id) on delete cascade,
  name       text not null,
  status     text not null default 'active' check (status in ('active','archived','completed')),
  created_at timestamptz not null default now()
);

create table ops.sprints (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references ops.areas(id) on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  status     text not null default 'planned' check (status in ('planned','active','closed')),
  created_at timestamptz not null default now()
);

create index sprints_area_idx on ops.sprints(area_id, status);

-- ------------------------------------------------------------
-- Tareas
-- ------------------------------------------------------------
create table ops.tasks (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references ops.areas(id) on delete cascade,
  project_id  uuid references ops.projects(id) on delete set null,
  sprint_id   uuid references ops.sprints(id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo','in_progress','in_review','done')),
  priority    text not null default 'normal'
              check (priority in ('low','normal','high','urgent')),
  progress    int  not null default 0 check (progress between 0 and 100),
  due_date    date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_area_idx       on ops.tasks(area_id);
create index tasks_status_idx     on ops.tasks(area_id, status);
create index tasks_sprint_idx     on ops.tasks(sprint_id) where sprint_id is not null;
create index tasks_due_idx        on ops.tasks(due_date) where due_date is not null;

create table ops.task_assignees (
  task_id uuid not null references ops.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on ops.task_assignees(user_id);

create table ops.task_labels (
  task_id uuid not null references ops.tasks(id) on delete cascade,
  label   text not null,
  primary key (task_id, label)
);

create table ops.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references ops.tasks(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  parent_id   uuid references ops.task_comments(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index task_comments_task_idx on ops.task_comments(task_id, created_at);

create table ops.task_attachments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references ops.tasks(id) on delete cascade,
  storage_path text not null,
  filename   text not null,
  mime_type  text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table ops.subtasks (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references ops.tasks(id) on delete cascade,
  title     text not null,
  done      boolean not null default false,
  sort_order int not null default 0
);

-- ------------------------------------------------------------
-- Chat
-- ------------------------------------------------------------
create table ops.channels (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid references ops.areas(id) on delete cascade,
  name       text not null,
  kind       text not null default 'area' check (kind in ('area','direct','group')),
  created_at timestamptz not null default now()
);

create table ops.channel_members (
  channel_id uuid not null references ops.channels(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_idx on ops.channel_members(user_id);

create table ops.messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references ops.channels(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  parent_id   uuid references ops.messages(id) on delete cascade,
  task_ref    uuid references ops.tasks(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index messages_channel_idx on ops.messages(channel_id, created_at desc);

-- ------------------------------------------------------------
-- Notificaciones
-- ------------------------------------------------------------
create table ops.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null
             check (kind in ('task_assigned','task_due','mention','comment','sprint_closed')),
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on ops.notifications(user_id, read_at, created_at desc);

-- ------------------------------------------------------------
-- Activity log
-- ------------------------------------------------------------
create table ops.activity_log (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid references ops.tasks(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_task_idx on ops.activity_log(task_id, created_at desc);

-- ============================================================
-- updated_at trigger genérico (en core para que también lo use rh/esc luego)
-- ============================================================
create or replace function core.touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger ops_tasks_touch_updated_at
  before update on ops.tasks
  for each row execute function core.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table ops.areas             enable row level security;
alter table ops.area_members      enable row level security;
alter table ops.projects          enable row level security;
alter table ops.sprints           enable row level security;
alter table ops.tasks             enable row level security;
alter table ops.task_assignees    enable row level security;
alter table ops.task_labels       enable row level security;
alter table ops.task_comments     enable row level security;
alter table ops.task_attachments  enable row level security;
alter table ops.subtasks          enable row level security;
alter table ops.channels          enable row level security;
alter table ops.channel_members   enable row level security;
alter table ops.messages          enable row level security;
alter table ops.notifications     enable row level security;
alter table ops.activity_log      enable row level security;

-- Helper: el usuario es miembro del área de un recurso
create or replace function ops.is_area_member(p_area_id uuid) returns boolean
  language sql stable security definer set search_path = ops, core, public
as $$
  select core.is_super_admin()
      or exists(select 1 from ops.area_members
                where area_id = p_area_id and user_id = auth.uid());
$$;

-- areas: read si tenés can_view('ops','boards') Y sos miembro (o super_admin)
create policy "areas read" on ops.areas for select to authenticated
  using (core.can_view('ops','boards') and ops.is_area_member(id));

create policy "areas write" on ops.areas for all to authenticated
  using (core.can_edit('ops','admin')) with check (core.can_edit('ops','admin'));

-- area_members: lectura por miembros del área
create policy "area_members read" on ops.area_members for select to authenticated
  using (core.can_view('ops','boards') and ops.is_area_member(area_id));

create policy "area_members write" on ops.area_members for all to authenticated
  using (core.can_edit('ops','admin')) with check (core.can_edit('ops','admin'));

-- projects + sprints siguen la misma regla que areas
create policy "projects read" on ops.projects for select to authenticated
  using (core.can_view('ops','boards') and ops.is_area_member(area_id));
create policy "projects write" on ops.projects for all to authenticated
  using (core.can_edit('ops','boards') and ops.is_area_member(area_id))
  with check (core.can_edit('ops','boards') and ops.is_area_member(area_id));

create policy "sprints read" on ops.sprints for select to authenticated
  using (core.can_view('ops','boards') and ops.is_area_member(area_id));
create policy "sprints write" on ops.sprints for all to authenticated
  using (core.can_edit('ops','boards') and ops.is_area_member(area_id))
  with check (core.can_edit('ops','boards') and ops.is_area_member(area_id));

-- tasks
create policy "tasks read" on ops.tasks for select to authenticated
  using (core.can_view('ops','tasks') and ops.is_area_member(area_id));
create policy "tasks insert" on ops.tasks for insert to authenticated
  with check (core.can_edit('ops','tasks') and ops.is_area_member(area_id));
create policy "tasks update" on ops.tasks for update to authenticated
  using (core.can_edit('ops','tasks') and ops.is_area_member(area_id))
  with check (core.can_edit('ops','tasks') and ops.is_area_member(area_id));
create policy "tasks delete" on ops.tasks for delete to authenticated
  using (core.can_edit('ops','tasks') and ops.is_area_member(area_id));

-- task subresources: si podés ver la tarea, podés ver sus subresources
create policy "task_assignees read" on ops.task_assignees for select to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "task_assignees write" on ops.task_assignees for all to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)))
  with check (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)));

create policy "task_labels read" on ops.task_labels for select to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "task_labels write" on ops.task_labels for all to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)))
  with check (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)));

create policy "task_comments read" on ops.task_comments for select to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "task_comments insert" on ops.task_comments for insert to authenticated
  with check (author_id = auth.uid()
              and exists(select 1 from ops.tasks t where t.id = task_id
                         and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "task_comments delete own" on ops.task_comments for delete to authenticated
  using (author_id = auth.uid() or core.is_super_admin());

create policy "task_attachments read" on ops.task_attachments for select to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "task_attachments write" on ops.task_attachments for all to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)))
  with check (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)));

create policy "subtasks read" on ops.subtasks for select to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "subtasks write" on ops.subtasks for all to authenticated
  using (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)))
  with check (exists(select 1 from ops.tasks t where t.id = task_id
                and core.can_edit('ops','tasks') and ops.is_area_member(t.area_id)));

-- chat
create policy "channels read" on ops.channels for select to authenticated
  using (core.can_view('ops','chat')
         and exists(select 1 from ops.channel_members
                    where channel_id = ops.channels.id and user_id = auth.uid())
         or core.is_super_admin());
create policy "channels write" on ops.channels for all to authenticated
  using (core.can_edit('ops','admin')) with check (core.can_edit('ops','admin'));

create policy "channel_members read" on ops.channel_members for select to authenticated
  using (user_id = auth.uid() or core.is_super_admin());
create policy "channel_members write" on ops.channel_members for all to authenticated
  using (core.can_edit('ops','admin') or user_id = auth.uid())
  with check (core.can_edit('ops','admin') or user_id = auth.uid());

create policy "messages read" on ops.messages for select to authenticated
  using (core.can_view('ops','chat')
         and exists(select 1 from ops.channel_members
                    where channel_id = ops.messages.channel_id and user_id = auth.uid()));
create policy "messages insert" on ops.messages for insert to authenticated
  with check (author_id = auth.uid()
              and exists(select 1 from ops.channel_members
                         where channel_id = ops.messages.channel_id and user_id = auth.uid()));
create policy "messages delete own" on ops.messages for delete to authenticated
  using (author_id = auth.uid() or core.is_super_admin());

-- notifications: cada user ve solo las propias
create policy "notifications self" on ops.notifications for all to authenticated
  using (user_id = auth.uid() or core.is_super_admin())
  with check (user_id = auth.uid() or core.is_super_admin());

-- activity_log: lectura por miembros del área de la tarea
create policy "activity read" on ops.activity_log for select to authenticated
  using (task_id is null
         or exists(select 1 from ops.tasks t where t.id = task_id
                   and core.can_view('ops','tasks') and ops.is_area_member(t.area_id)));
create policy "activity insert" on ops.activity_log for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- ============================================================
-- Realtime (solo messages y notifications, como dice CLAUDE.md)
-- ============================================================
alter publication supabase_realtime add table ops.messages;
alter publication supabase_realtime add table ops.notifications;
