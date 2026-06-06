-- 050_personal_boards.sql
-- Tableros personales: cada empleado puede tener uno o más tableros propios
-- aunque no sea admin de ops. Se creará uno automáticamente al alta de un perfil.

-- ------------------------------------------------------------
-- 1. Columna `personal` en ops.areas
-- ------------------------------------------------------------
alter table ops.areas
  add column if not exists personal boolean not null default false;

create index if not exists areas_personal_idx on ops.areas(personal);

-- ------------------------------------------------------------
-- 2. RPC: crear área personal con nombre + color (callable por any user)
-- ------------------------------------------------------------
create or replace function ops.create_personal_area(p_name text, p_color text default '#534AB7')
  returns uuid
  language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_area uuid;
  v_name text := nullif(trim(p_name), '');
  v_color text := coalesce(nullif(trim(p_color), ''), '#534AB7');
  v_slug text;
begin
  if v_uid is null then
    raise exception 'No authenticated user';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nombre demasiado corto';
  end if;

  select org_id into v_org from core.profiles where id = v_uid;
  if v_org is null then
    raise exception 'User has no organization';
  end if;

  v_slug := 'personal-' || replace(v_uid::text, '-', '')
            || '-' || substring(md5(random()::text || clock_timestamp()::text), 1, 6);

  insert into ops.areas (org_id, name, slug, color, personal)
    values (v_org, v_name, v_slug, v_color, true)
    returning id into v_area;

  insert into ops.area_members (area_id, user_id, role)
    values (v_area, v_uid, 'owner');

  return v_area;
end;
$$;

grant execute on function ops.create_personal_area(text, text) to authenticated;

-- ------------------------------------------------------------
-- 3. RPC: asegurar que el usuario actual tenga al menos un tablero personal
--    Idempotente. Pensado para llamarse desde el cliente al loguearse como
--    red de seguridad (por si el trigger no corrió o el perfil viene de antes).
-- ------------------------------------------------------------
create or replace function ops.ensure_my_personal_board()
  returns uuid
  language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_uid uuid := auth.uid();
  v_area uuid;
begin
  if v_uid is null then
    raise exception 'No authenticated user';
  end if;

  select a.id into v_area
    from ops.areas a
    join ops.area_members m on m.area_id = a.id and m.user_id = v_uid
   where a.personal = true
   order by a.created_at
   limit 1;

  if v_area is not null then
    return v_area;
  end if;

  return ops.create_personal_area('Mi tablero', '#534AB7');
end;
$$;

grant execute on function ops.ensure_my_personal_board() to authenticated;

-- ------------------------------------------------------------
-- 4. Trigger en core.profiles: auto-crear tablero personal a cada nuevo empleado
-- ------------------------------------------------------------
create or replace function ops.on_profile_created_personal_board()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_area uuid;
begin
  if new.org_id is null then
    return new;
  end if;

  -- Evitar duplicar si por alguna razón ya existe
  if exists(
    select 1 from ops.areas a
      join ops.area_members m on m.area_id = a.id and m.user_id = new.id
     where a.personal = true
  ) then
    return new;
  end if;

  insert into ops.areas (org_id, name, slug, color, personal)
    values (
      new.org_id,
      'Mi tablero',
      'personal-' || replace(new.id::text, '-', '')
        || '-' || substring(md5(random()::text || clock_timestamp()::text), 1, 6),
      '#534AB7',
      true
    )
    returning id into v_area;

  insert into ops.area_members (area_id, user_id, role)
    values (v_area, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists ensure_personal_board on core.profiles;
create trigger ensure_personal_board
  after insert on core.profiles
  for each row execute function ops.on_profile_created_personal_board();

-- ------------------------------------------------------------
-- 5. Backfill: crear tablero personal para cada empleado existente
--    que aún no tenga uno.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_area uuid;
begin
  for r in
    select p.id, p.org_id
      from core.profiles p
     where p.org_id is not null
       and not exists(
         select 1 from ops.areas a
           join ops.area_members m on m.area_id = a.id and m.user_id = p.id
          where a.personal = true
       )
  loop
    insert into ops.areas (org_id, name, slug, color, personal)
      values (
        r.org_id,
        'Mi tablero',
        'personal-' || replace(r.id::text, '-', '')
          || '-' || substring(md5(random()::text || clock_timestamp()::text), 1, 6),
        '#534AB7',
        true
      )
      returning id into v_area;

    insert into ops.area_members (area_id, user_id, role)
      values (v_area, r.id, 'owner');
  end loop;
end $$;
