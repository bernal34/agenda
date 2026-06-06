-- ============================================================
-- 020 — Triggers para generar notificaciones automáticamente
-- ============================================================

-- Al asignar un usuario a una tarea (excepto si se asigna a sí mismo)
create or replace function ops.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = ops, core, public as $$
declare
  v_task     ops.tasks%rowtype;
  v_actor    uuid := auth.uid();
begin
  if NEW.user_id = v_actor then
    return NEW;
  end if;

  select * into v_task from ops.tasks where id = NEW.task_id;

  insert into ops.notifications (user_id, kind, payload)
  values (
    NEW.user_id,
    'task_assigned',
    jsonb_build_object(
      'task_id',     NEW.task_id,
      'task_title',  v_task.title,
      'area_id',     v_task.area_id,
      'assigned_by', v_actor
    )
  );
  return NEW;
end $$;

drop trigger if exists notify_on_task_assigned on ops.task_assignees;
create trigger notify_on_task_assigned
  after insert on ops.task_assignees
  for each row execute function ops.notify_task_assigned();

-- Comentario en una tarea: notificar a todos los asignados excepto al autor
create or replace function ops.notify_task_comment() returns trigger
language plpgsql security definer set search_path = ops, core, public as $$
declare
  v_task     ops.tasks%rowtype;
  v_user     uuid;
begin
  select * into v_task from ops.tasks where id = NEW.task_id;

  for v_user in
    select user_id from ops.task_assignees
     where task_id = NEW.task_id
       and user_id <> NEW.author_id
  loop
    insert into ops.notifications (user_id, kind, payload) values (
      v_user,
      'comment',
      jsonb_build_object(
        'task_id',    NEW.task_id,
        'task_title', v_task.title,
        'comment_id', NEW.id,
        'author_id',  NEW.author_id,
        'preview',    left(NEW.body, 120)
      )
    );
  end loop;
  return NEW;
end $$;

drop trigger if exists notify_on_task_comment on ops.task_comments;
create trigger notify_on_task_comment
  after insert on ops.task_comments
  for each row execute function ops.notify_task_comment();
