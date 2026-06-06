-- ============================================================
-- 011 — Grants para que authenticated/anon puedan hablar con
-- los schemas core y ops vía PostgREST.
-- ============================================================
-- RLS de cada tabla sigue filtrando acceso por fila. Estos
-- grants solo abren la puerta del API gateway; sin ellos
-- PostgREST devuelve "Invalid schema" o "permission denied".
--
-- Recordá también exponer `core, ops` en Dashboard →
-- Project Settings → API → Exposed schemas (no se puede
-- automatizar desde SQL).
-- ============================================================

grant usage on schema core to anon, authenticated, service_role;
grant usage on schema ops  to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema core to authenticated;
grant select, insert, update, delete on all tables in schema ops  to authenticated;
grant select on all tables in schema core to anon;
grant select on all tables in schema ops  to anon;

grant usage, select on all sequences in schema core to authenticated;
grant usage, select on all sequences in schema ops  to authenticated;

grant execute on all functions in schema core to anon, authenticated, service_role;
grant execute on all functions in schema ops  to anon, authenticated, service_role;

alter default privileges in schema core grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema ops  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema core grant select on tables to anon;
alter default privileges in schema ops  grant select on tables to anon;
alter default privileges in schema core grant usage, select on sequences to authenticated;
alter default privileges in schema ops  grant usage, select on sequences to authenticated;
alter default privileges in schema core grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema ops  grant execute on functions to anon, authenticated, service_role;
