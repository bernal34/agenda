-- =====================================================================
-- 270_delete_area.sql
-- Completa 260: borrar un tablero también sale de la policy "areas write"
-- (010, admin de ops), así que la UI ofrecía el botón a cualquier owner y
-- le fallaba. Misma regla que rename_area: ops.can_manage_area_members.
--
-- El borrado arrastra en cascada tasks, board_stages, channels,
-- custom_fields, task_templates, automation_rules y area_members (FKs de
-- 010 con on delete cascade). No hay vuelta atrás.
--
-- Borrar un tablero personal está permitido: el usuario queda sin tablero
-- propio hasta que ensure_my_personal_board() le cree otro al entrar.
-- Idempotente.
-- =====================================================================

create or replace function ops.delete_area(p_area uuid)
returns void
language plpgsql security definer set search_path = ops, core, public
as $$
begin
  if not ops.can_manage_area_members(p_area) then
    raise exception 'Sin permiso para eliminar este tablero';
  end if;

  delete from ops.areas where id = p_area;
end;
$$;

revoke all on function ops.delete_area(uuid) from public, anon;
grant execute on function ops.delete_area(uuid) to authenticated;
