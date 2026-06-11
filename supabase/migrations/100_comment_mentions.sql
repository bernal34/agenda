-- ============================================================
-- 100 — Menciones en comentarios de tareas
--   - Nueva columna ops.task_comments.mentions uuid[]
--   - Trigger que genera notificaciones kind='mention' para
--     cada usuario mencionado (excepto el autor).
--   - Se evita duplicar con la notif 'comment' del 020:
--     el trigger de comentario salta a los usuarios que ya
--     están en NEW.mentions.
-- ============================================================

alter table ops.task_comments
  add column if not exists mentions uuid[] not null default '{}';

-- Trigger: notificar a cada mencionado (≠ autor)
create or replace function ops.notify_comment_mentions() returns trigger
language plpgsql security definer set search_path = ops, core, public as $$
declare
  v_task ops.tasks%rowtype;
  v_user uuid;
begin
  if NEW.mentions is null or array_length(NEW.mentions, 1) is null then
    return NEW;
  end if;

  select * into v_task from ops.tasks where id = NEW.task_id;

  foreach v_user in array NEW.mentions loop
    if v_user is null or v_user = NEW.author_id then
      continue;
    end if;
    insert into ops.notifications (user_id, kind, payload) values (
      v_user,
      'mention',
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

drop trigger if exists notify_on_comment_mentions on ops.task_comments;
create trigger notify_on_comment_mentions
  after insert on ops.task_comments
  for each row execute function ops.notify_comment_mentions();

-- Re-emite la fn del 020 con un filtro extra: no duplicar
-- notificaciones a usuarios que ya recibieron 'mention'.
create or replace function ops.notify_task_comment() returns trigger
language plpgsql security definer set search_path = ops, core, public as $$
declare
  v_task ops.tasks%rowtype;
  v_user uuid;
begin
  select * into v_task from ops.tasks where id = NEW.task_id;

  for v_user in
    select user_id from ops.task_assignees
     where task_id = NEW.task_id
       and user_id <> NEW.author_id
       and (NEW.mentions is null or not (user_id = any(NEW.mentions)))
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
