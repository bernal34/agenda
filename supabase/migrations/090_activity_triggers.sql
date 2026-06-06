-- 090_activity_triggers.sql
-- Activity feed: triggers que pueblan ops.activity_log con eventos clave
-- para mostrar "qué pasó hoy en mi área".
--
-- Eventos cubiertos:
--   - task.created
--   - task.status_changed
--   - task.completed (atajo separado para destacarlo en el feed)
--   - subtask.completed
--   - comment.added
--   - attachment.added
--   - task.assigned (skip self-assigns)
--
-- Todos los triggers son SECURITY DEFINER pero setean user_id = auth.uid()
-- para que la policy de read funcione correctamente.

-- ------------------------------------------------------------
-- 1. task.created + task.status_changed + task.completed
-- ------------------------------------------------------------
create or replace function ops.log_task_activity()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into ops.activity_log (task_id, user_id, action, payload)
    values (
      NEW.id,
      coalesce(NEW.created_by, auth.uid()),
      'task.created',
      jsonb_build_object('title', NEW.title, 'area_id', NEW.area_id)
    );
  elsif TG_OP = 'UPDATE' then
    if NEW.status is distinct from OLD.status then
      insert into ops.activity_log (task_id, user_id, action, payload)
      values (
        NEW.id,
        auth.uid(),
        case when NEW.status = 'done' then 'task.completed' else 'task.status_changed' end,
        jsonb_build_object('title', NEW.title, 'from', OLD.status, 'to', NEW.status)
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists log_task_activity_ins on ops.tasks;
create trigger log_task_activity_ins
  after insert on ops.tasks
  for each row execute function ops.log_task_activity();

drop trigger if exists log_task_activity_upd on ops.tasks;
create trigger log_task_activity_upd
  after update on ops.tasks
  for each row execute function ops.log_task_activity();

-- ------------------------------------------------------------
-- 2. subtask.completed
-- ------------------------------------------------------------
create or replace function ops.log_subtask_activity()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
begin
  if NEW.done = true and OLD.done = false then
    insert into ops.activity_log (task_id, user_id, action, payload)
    values (
      NEW.task_id,
      auth.uid(),
      'subtask.completed',
      jsonb_build_object('title', NEW.title)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists log_subtask_activity on ops.subtasks;
create trigger log_subtask_activity
  after update on ops.subtasks
  for each row execute function ops.log_subtask_activity();

-- ------------------------------------------------------------
-- 3. comment.added
-- ------------------------------------------------------------
create or replace function ops.log_comment_activity()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
begin
  insert into ops.activity_log (task_id, user_id, action, payload)
  values (
    NEW.task_id,
    NEW.author_id,
    'comment.added',
    jsonb_build_object(
      'preview', left(NEW.body, 120)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists log_comment_activity on ops.task_comments;
create trigger log_comment_activity
  after insert on ops.task_comments
  for each row execute function ops.log_comment_activity();

-- ------------------------------------------------------------
-- 4. attachment.added
-- ------------------------------------------------------------
create or replace function ops.log_attachment_activity()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
begin
  insert into ops.activity_log (task_id, user_id, action, payload)
  values (
    NEW.task_id,
    coalesce(NEW.uploaded_by, auth.uid()),
    'attachment.added',
    jsonb_build_object(
      'filename', NEW.filename,
      'mime_type', NEW.mime_type
    )
  );
  return NEW;
end;
$$;

drop trigger if exists log_attachment_activity on ops.task_attachments;
create trigger log_attachment_activity
  after insert on ops.task_attachments
  for each row execute function ops.log_attachment_activity();

-- ------------------------------------------------------------
-- 5. task.assigned (skip self-assigns)
-- ------------------------------------------------------------
create or replace function ops.log_assignee_activity()
  returns trigger
  language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Skip self-assigns para reducir ruido
  if NEW.user_id = v_actor then
    return NEW;
  end if;

  insert into ops.activity_log (task_id, user_id, action, payload)
  values (
    NEW.task_id,
    v_actor,
    'task.assigned',
    jsonb_build_object('to_user_id', NEW.user_id)
  );
  return NEW;
end;
$$;

drop trigger if exists log_assignee_activity on ops.task_assignees;
create trigger log_assignee_activity
  after insert on ops.task_assignees
  for each row execute function ops.log_assignee_activity();
