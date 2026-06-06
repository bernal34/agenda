-- 080_task_attachments_bucket.sql
-- Bucket privado para adjuntos de tareas + policies de storage.
-- Path pattern: <task_id>/<random>.<ext>
-- Lectura/escritura gated por membresía al área de la tarea (vía RLS).

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do update set public = excluded.public;

-- Read: cualquier miembro del área de la tarea
drop policy if exists "attachments read" on storage.objects;
create policy "attachments read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-attachments'
    and exists(
      select 1 from ops.tasks t
       where t.id::text = (storage.foldername(name))[1]
         and ops.is_area_member(t.area_id)
    )
  );

-- Upload: cualquier miembro del área de la tarea
drop policy if exists "attachments upload" on storage.objects;
create policy "attachments upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and exists(
      select 1 from ops.tasks t
       where t.id::text = (storage.foldername(name))[1]
         and ops.is_area_member(t.area_id)
    )
  );

-- Update: solo el uploader (raramente usado, pero conviene)
drop policy if exists "attachments update own" on storage.objects;
create policy "attachments update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
  );

-- Delete: el uploader (consistente con que también puede borrar el row en ops.task_attachments)
drop policy if exists "attachments delete own" on storage.objects;
create policy "attachments delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
  );
