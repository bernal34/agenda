-- ============================================================
-- 200 — Canal de chat automático por cada área
--   - Al crear una ops.areas se crea un ops.channels (kind='area')
--   - Al insertar en ops.area_members se suma a ops.channel_members
--   - Backfill: canal para cada área existente + sus miembros
-- ============================================================

create or replace function ops.on_area_created_make_channel()
returns trigger
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_ch uuid;
begin
  insert into ops.channels (area_id, name, kind)
    values (NEW.id, NEW.name, 'area')
    returning id into v_ch;
  insert into ops.channel_members (channel_id, user_id)
    select v_ch, user_id from ops.area_members where area_id = NEW.id
    on conflict do nothing;
  return NEW;
end $$;

drop trigger if exists on_area_created_make_channel on ops.areas;
create trigger on_area_created_make_channel
  after insert on ops.areas
  for each row execute function ops.on_area_created_make_channel();

create or replace function ops.on_area_member_join_channel()
returns trigger
language plpgsql security definer set search_path = ops, core, public
as $$
begin
  insert into ops.channel_members (channel_id, user_id)
    select c.id, NEW.user_id
      from ops.channels c
     where c.area_id = NEW.area_id and c.kind = 'area'
  on conflict do nothing;
  return NEW;
end $$;

drop trigger if exists on_area_member_join_channel on ops.area_members;
create trigger on_area_member_join_channel
  after insert on ops.area_members
  for each row execute function ops.on_area_member_join_channel();

-- Backfill: crear canales faltantes y rellenar miembros.
do $$
declare
  r record;
  v_ch uuid;
begin
  for r in
    select a.* from ops.areas a
     where not exists (
       select 1 from ops.channels c
        where c.area_id = a.id and c.kind = 'area'
     )
  loop
    insert into ops.channels (area_id, name, kind)
      values (r.id, r.name, 'area')
      returning id into v_ch;
    insert into ops.channel_members (channel_id, user_id)
      select v_ch, user_id from ops.area_members where area_id = r.id
      on conflict do nothing;
  end loop;

  -- Para áreas con canal pero miembros faltantes (por ej. miembros
  -- agregados antes del trigger), rellenar:
  insert into ops.channel_members (channel_id, user_id)
    select c.id, m.user_id
      from ops.channels c
      join ops.area_members m on m.area_id = c.area_id
     where c.kind = 'area'
       and not exists (
         select 1 from ops.channel_members cm
          where cm.channel_id = c.id and cm.user_id = m.user_id
       );
end $$;
