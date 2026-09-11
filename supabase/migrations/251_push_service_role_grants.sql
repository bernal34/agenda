-- =====================================================================
-- 251_push_service_role_grants.sql
-- Parche de 250. 011 solo dio permisos de tabla a anon/authenticated, así
-- que la edge function send-push (cliente con service_role) fallaba con
-- "permission denied for table notifications". Solo lo que la función lee:
--   - ops.notifications  → la notificación a enviar
--   - core.profiles      → nombre de quien la provocó
-- ops.push_subscriptions ya tiene grant desde 250.
-- Idempotente.
-- =====================================================================

grant select on ops.notifications to service_role;
grant select on core.profiles     to service_role;
