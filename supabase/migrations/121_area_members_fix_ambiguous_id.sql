-- ============================================================
-- 121 — Fix: column reference "id" is ambiguous en list_org_users_for_area
-- El nombre de OUT param "id" del RETURNS TABLE chocaba con p.id
-- dentro del query. Se agrega el pragma #variable_conflict use_column.
-- ============================================================

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
#variable_conflict use_column
declare
  v_org uuid;
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para gestionar miembros';
  end if;

  select org_id into v_org from ops.areas where id = p_area;
  if v_org is null then
    raise exception 'Area inexistente';
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
