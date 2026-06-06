-- ============================================================
-- 031 — Fix recursión en policy de core.profiles
-- ============================================================
-- La policy "profiles self read" original incluía un subquery a
-- core.profiles que disparaba RLS recursivamente, causando que
-- cualquier SELECT desde el cliente devolviera 500.
-- ============================================================

create or replace function core.my_org_id() returns uuid
  language sql stable security definer
  set search_path = core, public
as $$
  select org_id from core.profiles where id = auth.uid()
$$;

grant execute on function core.my_org_id() to anon, authenticated, service_role;

drop policy if exists "profiles self read" on core.profiles;
create policy "profiles self read" on core.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or core.is_super_admin()
    or org_id = core.my_org_id()
  );
