-- =====================================================================
-- 260_area_self_service.sql
-- Tableros de equipo sin pasar por un admin del portal:
--   - ops.create_area(name, color): cualquier usuario con acceso al módulo
--     boards crea un tablero compartido y queda como owner.
--   - ops.rename_area(area, name): lo renombra quien puede gestionar el
--     área (owner/admin del área, o admin de ops), igual que miembros,
--     custom fields y automatizaciones.
--
-- La policy "areas write" (010) es `for all` con core.can_edit('ops','admin'),
-- así que un owner normal no puede tocar ops.areas por tabla directa. Por eso
-- ambas van como RPC security definer, el mismo patrón de
-- ops.create_personal_area (050).
--
-- Las etapas default del tablero las pone el trigger de 040.
-- Idempotente.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Crear tablero de equipo
-- ------------------------------------------------------------
create or replace function ops.create_area(p_name text, p_color text default '#534AB7')
returns uuid
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_area  uuid;
  v_name  text := nullif(trim(p_name), '');
  v_color text := coalesce(nullif(trim(p_color), ''), '#534AB7');
  v_slug  text;
begin
  if v_uid is null then
    raise exception 'No authenticated user';
  end if;
  if not core.can_view('ops', 'boards') then
    raise exception 'Sin acceso a tableros';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nombre demasiado corto';
  end if;

  select org_id into v_org from core.profiles where id = v_uid;
  if v_org is null then
    raise exception 'User has no organization';
  end if;

  -- Sufijo aleatorio: dos tableros pueden llamarse igual, el slug no.
  v_slug := coalesce(nullif(btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'tablero')
            || '-' || substring(md5(random()::text || clock_timestamp()::text), 1, 6);

  insert into ops.areas (org_id, name, slug, color, personal)
    values (v_org, v_name, v_slug, v_color, false)
    returning id into v_area;

  insert into ops.area_members (area_id, user_id, role)
    values (v_area, v_uid, 'owner');

  return v_area;
end;
$$;

-- ------------------------------------------------------------
-- 2. Renombrar tablero
-- ------------------------------------------------------------
create or replace function ops.rename_area(p_area uuid, p_name text)
returns void
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_name text := nullif(trim(p_name), '');
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para editar este tablero';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nombre demasiado corto';
  end if;

  update ops.areas set name = v_name where id = p_area;
end;
$$;

revoke all on function ops.create_area(text, text) from public, anon;
revoke all on function ops.rename_area(uuid, text) from public, anon;
grant execute on function ops.create_area(text, text) to authenticated;
grant execute on function ops.rename_area(uuid, text) to authenticated;
