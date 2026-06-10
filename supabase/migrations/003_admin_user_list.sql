-- Migration: 003_admin_user_list
-- Adds a SECURITY DEFINER function so super_admins can list all users
-- with their auth.users email + app/module/role aggregates in one round trip.
--
-- This is purely read-only. Write operations go through normal RLS on the
-- user_app_access / user_module_access / user_global_roles tables (already
-- limited to super_admin by existing policies).

create or replace function core.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  status text,
  org_id uuid,
  org_name text,
  is_super_admin boolean,
  app_codes text[],
  module_count integer,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path = core, public
as $$
  select
    p.id,
    u.email::text,
    p.full_name,
    p.avatar_url,
    p.phone,
    p.status,
    p.org_id,
    o.name as org_name,
    exists (
      select 1 from core.user_global_roles r
       where r.user_id = p.id and r.role = 'super_admin'
    ) as is_super_admin,
    coalesce(
      (select array_agg(a.app_code order by a.app_code)
         from core.user_app_access a
        where a.user_id = p.id),
      array[]::text[]
    ) as app_codes,
    coalesce(
      (select count(*)::int from core.user_module_access m where m.user_id = p.id),
      0
    ) as module_count,
    u.created_at,
    u.last_sign_in_at
  from core.profiles p
  join auth.users u on u.id = p.id
  left join core.organizations o on o.id = p.org_id
  where core.is_super_admin()
  order by p.full_name;
$$;

revoke all on function core.admin_list_users() from public;
grant execute on function core.admin_list_users() to authenticated;

comment on function core.admin_list_users() is
  'Returns all users with their emails and access summary. Only super_admins get rows; others get empty set.';

-- Helper to fetch full module breakdown for a single user (for the detail view).
create or replace function core.admin_get_user_modules(p_user_id uuid)
returns table (
  app_code text,
  module_code text,
  module_name text,
  app_name text,
  module_sort integer,
  can_edit boolean,
  has_access boolean
)
language sql
security definer
set search_path = core, public
as $$
  select
    m.app_code,
    m.code as module_code,
    m.name as module_name,
    a.name as app_name,
    m.sort_order as module_sort,
    coalesce(ma.can_edit, false) as can_edit,
    (ma.user_id is not null) as has_access
  from core.modules m
  join core.apps a on a.code = m.app_code
  left join core.user_module_access ma
    on ma.app_code = m.app_code
   and ma.module_code = m.code
   and ma.user_id = p_user_id
  where core.is_super_admin()
  order by a.sort_order, m.sort_order;
$$;

revoke all on function core.admin_get_user_modules(uuid) from public;
grant execute on function core.admin_get_user_modules(uuid) to authenticated;

comment on function core.admin_get_user_modules(uuid) is
  'Returns all modules with the target user''s access flags. Only callable by super_admins.';
