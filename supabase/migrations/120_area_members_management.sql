-- ============================================================
-- 120 — Gestión de miembros de tableros compartidos
--   - Helpers RPC para que el owner/admin del área pueda
--     agregar/remover/cambiar rol de miembros sin requerir
--     ser admin global de ops.
--   - Listado de empleados de la org para sumar al tablero
--     (bypassea RLS de core.profiles vía security definer,
--     con check de permiso por área).
-- ============================================================

-- ¿Puede el caller gestionar miembros de este área?
create or replace function ops.can_manage_area_members(p_area uuid)
returns boolean
language sql stable security definer set search_path = ops, core, public
as $$
  select core.is_super_admin()
      or core.can_edit('ops','admin')
      or exists(
           select 1 from ops.area_members
            where area_id = p_area
              and user_id = auth.uid()
              and role in ('owner','admin')
         );
$$;

grant execute on function ops.can_manage_area_members(uuid) to authenticated;

-- Listar empleados de la org del área (id, nombre, avatar, ya_miembro)
create or replace function ops.list_org_users_for_area(p_area uuid)
returns table (
  id           uuid,
  full_name    text,
  avatar_url   text,
  is_member    boolean,
  member_role  text
)
language plpgsql stable security definer set search_path = ops, core, public
as $$
declare
  v_org uuid;
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para gestionar miembros';
  end if;

  select org_id into v_org from ops.areas where id = p_area;
  if v_org is null then
    raise exception 'Área inexistente';
  end if;

  return query
    select p.id,
           p.full_name,
           p.avatar_url,
           (m.user_id is not null) as is_member,
           m.role::text             as member_role
      from core.profiles p
      left join ops.area_members m
        on m.area_id = p_area and m.user_id = p.id
     where p.org_id = v_org
     order by p.full_name nulls last;
end;
$$;

grant execute on function ops.list_org_users_for_area(uuid) to authenticated;

-- Agregar miembro (idempotente: si ya está, actualiza el rol)
create or replace function ops.add_area_member(
  p_area uuid,
  p_user uuid,
  p_role text default 'member'
)
returns void
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_personal boolean;
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para gestionar miembros';
  end if;
  if p_role not in ('owner','admin','member') then
    raise exception 'Rol inválido: %', p_role;
  end if;

  select personal into v_personal from ops.areas where id = p_area;
  if v_personal then
    raise exception 'No se pueden agregar miembros a un tablero personal';
  end if;

  insert into ops.area_members (area_id, user_id, role)
    values (p_area, p_user, p_role)
  on conflict (area_id, user_id)
    do update set role = excluded.role;
end;
$$;

grant execute on function ops.add_area_member(uuid, uuid, text) to authenticated;

-- Quitar miembro (no permite dejar el área sin owners)
create or replace function ops.remove_area_member(
  p_area uuid,
  p_user uuid
)
returns void
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_owners_left int;
  v_role text;
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para gestionar miembros';
  end if;

  select role into v_role
    from ops.area_members where area_id = p_area and user_id = p_user;
  if v_role is null then
    return;
  end if;

  if v_role = 'owner' then
    select count(*) into v_owners_left
      from ops.area_members
     where area_id = p_area and role = 'owner' and user_id <> p_user;
    if v_owners_left = 0 then
      raise exception 'El tablero quedaría sin owners';
    end if;
  end if;

  delete from ops.area_members
   where area_id = p_area and user_id = p_user;
end;
$$;

grant execute on function ops.remove_area_member(uuid, uuid) to authenticated;

-- Cambiar el rol de un miembro
create or replace function ops.update_area_member_role(
  p_area uuid,
  p_user uuid,
  p_role text
)
returns void
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_owners_left int;
  v_current text;
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para gestionar miembros';
  end if;
  if p_role not in ('owner','admin','member') then
    raise exception 'Rol inválido: %', p_role;
  end if;

  select role into v_current
    from ops.area_members where area_id = p_area and user_id = p_user;
  if v_current is null then
    raise exception 'El usuario no es miembro';
  end if;

  if v_current = 'owner' and p_role <> 'owner' then
    select count(*) into v_owners_left
      from ops.area_members
     where area_id = p_area and role = 'owner' and user_id <> p_user;
    if v_owners_left = 0 then
      raise exception 'El tablero quedaría sin owners';
    end if;
  end if;

  update ops.area_members
     set role = p_role
   where area_id = p_area and user_id = p_user;
end;
$$;

grant execute on function ops.update_area_member_role(uuid, uuid, text) to authenticated;
