-- ============================================================
-- 000 — Capa core: identidad, organizaciones, apps y permisos
-- ============================================================
-- Esta migración crea el schema `core` que es la fuente única de
-- verdad de identidad y permisos para los 3 sistemas:
--   - rh  (ex rrhh-portal)
--   - esc (ex escrituracion / condotrack)
--   - ops (OpsBoard / agenda)
--
-- Cada sistema vive en su propio schema y consulta `core.*` para
-- determinar acceso. Los helpers `core.can_view/can_edit` son SECURITY
-- DEFINER y devuelven boolean, así las policies RLS son one-liners.
-- ============================================================

create schema if not exists core;
create schema if not exists rh;
create schema if not exists esc;
create schema if not exists ops;

-- ------------------------------------------------------------
-- Organización (multi-tenant ready aunque hoy haya una sola)
-- ------------------------------------------------------------
create table core.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Perfil unificado por usuario (1:1 con auth.users)
-- ------------------------------------------------------------
create table core.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid not null references core.organizations(id),
  full_name    text not null,
  avatar_url   text,
  phone        text,
  status       text not null default 'active' check (status in ('active','inactive','invited')),
  -- vínculo opcional con empleado de RRHH (para portal del empleado)
  employee_id  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_org_idx on core.profiles(org_id);
create index profiles_employee_idx on core.profiles(employee_id) where employee_id is not null;

-- ------------------------------------------------------------
-- Catálogo de apps que viven detrás del portal
-- ------------------------------------------------------------
create table core.apps (
  code        text primary key,                  -- 'rh' | 'esc' | 'ops'
  name        text not null,
  url         text not null,                     -- URL de despliegue para el launcher
  icon        text,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

insert into core.apps (code, name, url, sort_order) values
  ('rh',  'Recursos Humanos', 'https://portal.example.com/rh',  10),
  ('esc', 'Escrituración',    'https://portal.example.com/esc', 20),
  ('ops', 'OpsBoard',         'https://opsboard.example.com',   30);

-- ------------------------------------------------------------
-- Módulos de cada app (granularidad de permisos)
-- ------------------------------------------------------------
create table core.modules (
  app_code   text not null references core.apps(code) on delete cascade,
  code       text not null,
  name       text not null,
  sort_order int  not null default 0,
  primary key (app_code, code)
);

-- Módulos heredados de rrhh-portal
insert into core.modules (app_code, code, name) values
  ('rh','empleados','Empleados'),
  ('rh','sucursales','Sucursales'),
  ('rh','puestos','Puestos'),
  ('rh','horarios','Horarios'),
  ('rh','asistencia','Asistencia'),
  ('rh','incidencias','Incidencias'),
  ('rh','vacaciones','Vacaciones'),
  ('rh','actas','Actas'),
  ('rh','nomina','Nómina'),
  ('rh','documentos','Documentos'),
  ('rh','reportes','Reportes'),
  ('rh','usuarios','Usuarios');

-- Módulos derivados de escrituración (mapeo desde roles)
insert into core.modules (app_code, code, name) values
  ('esc','unidades','Unidades'),
  ('esc','compradores','Compradores'),
  ('esc','procesos','Procesos'),
  ('esc','pagos','Pagos'),
  ('esc','catalogos','Catálogos'),
  ('esc','reportes','Reportes'),
  ('esc','admin','Administración');

-- Módulos de OpsBoard
insert into core.modules (app_code, code, name) values
  ('ops','tasks','Tareas'),
  ('ops','boards','Tableros'),
  ('ops','chat','Chat'),
  ('ops','notifications','Notificaciones'),
  ('ops','admin','Administración');

-- ------------------------------------------------------------
-- Rol global (super_admin del portal)
-- ------------------------------------------------------------
create table core.user_global_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('super_admin')),
  primary key (user_id, role)
);

-- ------------------------------------------------------------
-- Acceso a app (gate al entrar al launcher)
-- ------------------------------------------------------------
create table core.user_app_access (
  user_id    uuid not null references auth.users(id) on delete cascade,
  app_code   text not null references core.apps(code) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, app_code)
);

-- ------------------------------------------------------------
-- Acceso por módulo (visibilidad + edición)
-- ------------------------------------------------------------
create table core.user_module_access (
  user_id     uuid    not null references auth.users(id) on delete cascade,
  app_code    text    not null,
  module_code text    not null,
  can_edit    boolean not null default false,
  granted_by  uuid    references auth.users(id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, app_code, module_code),
  foreign key (app_code, module_code) references core.modules(app_code, code) on delete cascade
);

create index user_module_access_user_idx on core.user_module_access(user_id);

-- ============================================================
-- Helpers (security definer, stable)
-- ============================================================

create or replace function core.is_super_admin() returns boolean
  language sql stable security definer set search_path = core, public
as $$
  select exists(
    select 1 from core.user_global_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function core.can_access_app(p_app text) returns boolean
  language sql stable security definer set search_path = core, public
as $$
  select core.is_super_admin()
      or exists(select 1 from core.user_app_access
                where user_id = auth.uid() and app_code = p_app);
$$;

create or replace function core.can_view(p_app text, p_module text) returns boolean
  language sql stable security definer set search_path = core, public
as $$
  select core.is_super_admin()
      or exists(select 1 from core.user_module_access
                where user_id = auth.uid()
                  and app_code = p_app
                  and module_code = p_module);
$$;

create or replace function core.can_edit(p_app text, p_module text) returns boolean
  language sql stable security definer set search_path = core, public
as $$
  select core.is_super_admin()
      or exists(select 1 from core.user_module_access
                where user_id = auth.uid()
                  and app_code = p_app
                  and module_code = p_module
                  and can_edit = true);
$$;

-- ============================================================
-- Vistas para el frontend del portal
-- ============================================================

-- Apps a las que el usuario actual puede entrar
create or replace view core.my_apps as
  select a.code, a.name, a.url, a.icon, a.sort_order
    from core.apps a
   where a.active
     and (core.is_super_admin()
          or exists(select 1 from core.user_app_access
                    where user_id = auth.uid() and app_code = a.code));

grant select on core.my_apps to authenticated;

-- Módulos a los que el usuario actual puede entrar (por app)
create or replace view core.my_modules as
  select m.app_code, m.code as module_code, m.name,
         core.can_edit(m.app_code, m.code) as can_edit
    from core.modules m
   where core.can_view(m.app_code, m.code);

grant select on core.my_modules to authenticated;

-- ============================================================
-- RLS sobre las tablas de core
-- ============================================================
alter table core.profiles            enable row level security;
alter table core.organizations       enable row level security;
alter table core.user_app_access     enable row level security;
alter table core.user_module_access  enable row level security;
alter table core.user_global_roles   enable row level security;

-- profiles: cada usuario lee su propio perfil + los del mismo org
create policy "profiles self read" on core.profiles
  for select to authenticated
  using (id = auth.uid()
         or core.is_super_admin()
         or org_id in (select org_id from core.profiles where id = auth.uid()));

create policy "profiles self update" on core.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles super admin write" on core.profiles
  for all to authenticated
  using (core.is_super_admin()) with check (core.is_super_admin());

-- organizations: solo lectura para autenticados, escritura super_admin
create policy "orgs read" on core.organizations
  for select to authenticated using (true);
create policy "orgs admin write" on core.organizations
  for all to authenticated
  using (core.is_super_admin()) with check (core.is_super_admin());

-- access tables: usuario ve los propios, super_admin todo
create policy "app access self read" on core.user_app_access
  for select to authenticated using (user_id = auth.uid() or core.is_super_admin());
create policy "app access admin write" on core.user_app_access
  for all to authenticated
  using (core.is_super_admin()) with check (core.is_super_admin());

create policy "module access self read" on core.user_module_access
  for select to authenticated using (user_id = auth.uid() or core.is_super_admin());
create policy "module access admin write" on core.user_module_access
  for all to authenticated
  using (core.is_super_admin()) with check (core.is_super_admin());

create policy "global roles self read" on core.user_global_roles
  for select to authenticated using (user_id = auth.uid() or core.is_super_admin());
create policy "global roles admin write" on core.user_global_roles
  for all to authenticated
  using (core.is_super_admin()) with check (core.is_super_admin());

-- ------------------------------------------------------------
-- Auto-crear profile en el primer login
-- ------------------------------------------------------------
create or replace function core.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = core, public
as $$
declare
  default_org uuid;
begin
  select id into default_org from core.organizations limit 1;
  if default_org is null then
    return new; -- no hay org configurada todavía; el super_admin debe crearla
  end if;
  insert into core.profiles (id, org_id, full_name)
  values (new.id, default_org, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function core.handle_new_auth_user();
