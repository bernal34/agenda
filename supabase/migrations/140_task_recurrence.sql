-- ============================================================
-- 140 — Recurrencia de tareas
--   - Nueva columna ops.tasks.recurrence_rule jsonb
--     Formato: { "freq": "daily"|"weekly"|"monthly", "interval": 1 }
--   - Trigger: cuando una tarea pasa a status='done' y tiene rule,
--     se inserta una nueva instancia "todo" con due_date desplazado
--     y la rule original. La regla se limpia en la tarea completada
--     para no re-disparar si la des-tildan/retildan.
--   - Copia asignados + labels al nuevo task.
-- ============================================================

alter table ops.tasks
  add column if not exists recurrence_rule jsonb;

create or replace function ops.spawn_next_recurrence()
returns trigger
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  v_rule     jsonb;
  v_freq     text;
  v_interval int;
  v_base     date;
  v_next_due date;
  v_new_id   uuid;
begin
  if OLD.status = 'done'
     or NEW.status <> 'done'
     or NEW.recurrence_rule is null then
    return NEW;
  end if;

  v_rule := NEW.recurrence_rule;
  v_freq := v_rule->>'freq';
  v_interval := greatest(coalesce((v_rule->>'interval')::int, 1), 1);
  v_base := coalesce(NEW.due_date, current_date);

  if v_freq = 'daily' then
    v_next_due := v_base + (v_interval * interval '1 day');
  elsif v_freq = 'weekly' then
    v_next_due := v_base + (v_interval * interval '1 week');
  elsif v_freq = 'monthly' then
    v_next_due := v_base + (v_interval * interval '1 month');
  else
    return NEW;
  end if;

  insert into ops.tasks (
    area_id, title, description, status, priority, progress,
    due_date, recurrence_rule, created_by
  ) values (
    NEW.area_id, NEW.title, NEW.description, 'todo', NEW.priority, 0,
    v_next_due, v_rule, NEW.created_by
  ) returning id into v_new_id;

  insert into ops.task_assignees (task_id, user_id)
    select v_new_id, user_id from ops.task_assignees where task_id = NEW.id;

  insert into ops.task_labels (task_id, label)
    select v_new_id, label from ops.task_labels where task_id = NEW.id;

  update ops.tasks
     set recurrence_rule = null
   where id = NEW.id;

  return NEW;
end $$;

drop trigger if exists spawn_next_recurrence on ops.tasks;
create trigger spawn_next_recurrence
  after update on ops.tasks
  for each row execute function ops.spawn_next_recurrence();
