-- ============================================================
-- 190 — Reglas de automatización por tablero
--   - ops.automation_rules(area_id, trigger jsonb, action jsonb)
--   - Trigger kinds: 'status_changed_to' | 'created'
--   - Action kinds:  'set_priority' | 'assign_to' | 'add_label'
--                    'set_status'   | 'archive'
--   - Se ejecutan en AFTER INSERT/UPDATE de ops.tasks vía
--     ops.run_automations(). pg_trigger_depth() <= 2 evita loops.
-- ============================================================

create table if not exists ops.automation_rules (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references ops.areas(id) on delete cascade,
  name        text not null,
  enabled     boolean not null default true,
  "trigger"   jsonb not null,
  "action"    jsonb not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists automation_rules_area_idx
  on ops.automation_rules(area_id) where enabled;

alter table ops.automation_rules enable row level security;

drop policy if exists "automation_rules read"  on ops.automation_rules;
drop policy if exists "automation_rules write" on ops.automation_rules;
create policy "automation_rules read" on ops.automation_rules
  for select to authenticated using (ops.is_area_member(area_id));
create policy "automation_rules write" on ops.automation_rules
  for all to authenticated
  using (ops.can_manage_area_members(area_id))
  with check (ops.can_manage_area_members(area_id));

create or replace function ops.run_automations()
returns trigger
language plpgsql security definer set search_path = ops, core, public
as $$
declare
  r          record;
  v_trig     text;
  v_act      text;
  v_param    text;
  v_label    text;
  v_user     uuid;
  v_matches  boolean;
begin
  -- Cortafuegos: no permitir cascadas de más de 2 niveles
  if pg_trigger_depth() > 2 then
    return NEW;
  end if;

  for r in
    select * from ops.automation_rules
     where area_id = NEW.area_id
       and enabled = true
  loop
    v_trig := r."trigger"->>'kind';
    v_matches := false;

    if TG_OP = 'INSERT' and v_trig = 'created' then
      v_matches := true;
    elsif TG_OP = 'UPDATE' and v_trig = 'status_changed_to' then
      v_param := r."trigger"->>'status';
      v_matches := (OLD.status is distinct from NEW.status)
               and NEW.status = v_param;
    end if;

    if not v_matches then continue; end if;

    v_act := r."action"->>'kind';

    if v_act = 'set_priority' then
      v_param := r."action"->>'priority';
      if v_param in ('low','normal','high','urgent') and NEW.priority <> v_param then
        update ops.tasks set priority = v_param where id = NEW.id;
      end if;

    elsif v_act = 'assign_to' then
      v_user := nullif(r."action"->>'user_id','')::uuid;
      if v_user is not null then
        insert into ops.task_assignees (task_id, user_id)
          values (NEW.id, v_user)
          on conflict (task_id, user_id) do nothing;
      end if;

    elsif v_act = 'add_label' then
      v_label := r."action"->>'label';
      if coalesce(trim(v_label), '') <> '' then
        insert into ops.task_labels (task_id, label)
          values (NEW.id, v_label)
          on conflict (task_id, label) do nothing;
      end if;

    elsif v_act = 'set_status' then
      v_param := r."action"->>'status';
      if coalesce(trim(v_param),'') <> '' and NEW.status <> v_param then
        update ops.tasks set status = v_param where id = NEW.id;
      end if;

    elsif v_act = 'archive' then
      if NEW.archived_at is null then
        update ops.tasks set archived_at = now() where id = NEW.id;
      end if;
    end if;
  end loop;

  return NEW;
end $$;

drop trigger if exists run_automations_after_insert on ops.tasks;
create trigger run_automations_after_insert
  after insert on ops.tasks
  for each row execute function ops.run_automations();

drop trigger if exists run_automations_after_update on ops.tasks;
create trigger run_automations_after_update
  after update of status on ops.tasks
  for each row execute function ops.run_automations();
