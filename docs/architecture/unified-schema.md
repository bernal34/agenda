# Esquema Supabase unificado

## Objetivo
Un solo proyecto Supabase que sirve a las 3 aplicaciones (RH, Escrituración, OpsBoard) con:
- **Una sola sesión** reconocida por las 3 apps (mismo `auth.users`).
- **Permisos centralizados** por app/módulo, gestionados desde el portal.
- **Aislamiento lógico** entre dominios (no mezcla de nombres ni de RLS).

## Decisión de arquitectura: schemas separados por dominio

| Schema | Dueño | Contenido |
|--------|-------|-----------|
| `auth` | Supabase | Usuarios, sesiones (no se toca). |
| `core` | Portal | Identidad unificada, organizaciones, catálogo de apps/módulos, permisos. |
| `rh` | RH app | Todo lo que hoy vive en el `public` de `rrhh-portal`. |
| `esc` | Esc app | Todo lo que hoy vive en el `public` de `escrituracion`. |
| `ops` | OpsBoard | Tablas nuevas de OpsBoard. |
| `public` | (vacío / vistas) | Solo vistas de conveniencia si hacen falta. |

### Por qué schemas separados (no un único `public`)
1. **Colisión de nombres real:** RH y Esc tienen `documentos`, `notas`, `pagos`. Renombrar es ruidoso; aislar es limpio.
2. **Aislamiento de RLS:** cada schema define sus policies contra `core.can_view('rh', ...)` o `core.can_view('esc', ...)`. No hay forma de "saltar" entre apps sin permiso explícito.
3. **`search_path` por cliente:** cada app conecta con `options=-csearch_path=rh,core,public` (o `esc,core,public`, etc.). El código ve sus tablas como si vivieran en `public`, no necesita prefijar.
4. **Realtime selectivo:** publicación por schema. OpsBoard escucha `ops.messages` y `ops.notifications` sin enterarse de movimientos en RH.
5. **Backups/restores parciales** con `pg_dump --schema=rh`.

### Por qué no proyectos separados con FDW
- **Sesión única imposible:** dos proyectos = dos JWTs = dos `auth.users`. Tendríamos que sincronizar usuarios bidireccionalmente. Demasiada infra.
- Foreign Data Wrapper agrega latencia y complica RLS cross-DB.

## Modelo de identidad

```
auth.users                       (Supabase nativo)
   └─► core.profiles             (perfil unificado; 1:1)
          ├─► core.organizations
          └─► core.profiles.employee_id ──► rh.empleados.id  (opcional)
```

- **`auth.users`** sigue siendo la única fuente de identidad. Un email = un usuario.
- **`core.profiles`** extiende con datos no sensibles del portal (nombre, avatar, teléfono, status). 1:1 con `auth.users`.
- **`employee_id`** opcional vincula a `rh.empleados` para que el portal del empleado consuma su propia nómina.
- **`core.organizations`** está preparado para multi-tenant aunque hoy haya una sola org. No agrega complejidad y evita una migración futura.

## Modelo de permisos

Tres niveles, evaluados en este orden:

1. **`core.is_super_admin()`** → acceso total a todo. Para vos como dueño del sistema.
2. **`core.can_access_app(app)`** → puerta de entrada al launcher. Si no, el ícono no aparece.
3. **`core.can_view(app, module)`** / **`core.can_edit(app, module)`** → granularidad fina por pantalla.

### Tablas

| Tabla | Para qué |
|-------|----------|
| `core.user_global_roles` | Marcar usuarios como `super_admin`. |
| `core.user_app_access` | "El usuario X puede entrar a la app Y." |
| `core.user_module_access` | "El usuario X tiene acceso al módulo M de la app Y (con edición sí/no)." |
| `core.apps` | Catálogo de apps, con URL para el launcher. |
| `core.modules` | Módulos de cada app (12 en RH, 7 en Esc, 5 en Ops). |

### Cómo lo usa cada app

```sql
-- Cualquier tabla de RH, Esc u Ops, política tipo:
create policy "modulo read" on rh.empleados for select to authenticated
  using (core.can_view('rh','empleados'));

create policy "modulo write" on rh.empleados for all to authenticated
  using (core.can_edit('rh','empleados'))
  with check (core.can_edit('rh','empleados'));
```

### Compatibilidad con el código existente

Para no romper RH durante la migración, en el schema `rh` se conservan los nombres de funciones legacy como **shims**:

```sql
create or replace function rh.current_user_puede_ver(p_modulo text) returns boolean
  language sql stable security definer
as $$ select core.can_view('rh', p_modulo); $$;

create or replace function rh.current_user_puede_editar(p_modulo text) returns boolean
  language sql stable security definer
as $$ select core.can_edit('rh', p_modulo); $$;

create or replace function rh.current_user_es_admin() returns boolean
  language sql stable security definer
as $$ select core.is_super_admin(); $$;
```

Resultado: las RLS de RH compilan sin tocar el código. El frontend de RH llama a `mis_modulos` → se reemplaza por `select * from core.my_modules where app_code='rh'` (un cambio de query).

Para Escrituración el cambio es más sustancial porque hoy usa `rol IN ('admin','gerencia','asesor')` en RLS. Mapeo propuesto:

| Rol viejo | Acceso resultante |
|-----------|-------------------|
| `admin` | `core.user_global_roles(super_admin)` o `can_edit` en todos los módulos `esc` |
| `gerencia` | `can_edit` en `unidades`, `procesos`, `pagos`, `reportes` |
| `asesor` | `can_view` general + `can_edit` solo en `procesos` propios (RLS adicional por `responsable_id = auth.uid()`) |

El RLS por dueño (`responsable_id = auth.uid()`) se mantiene como AND adicional cuando aplica.

## Storage

Buckets centralizados, policies usan los mismos helpers:

| Bucket | Acceso | Policy |
|--------|--------|--------|
| `avatars` | público | escritura: `owner = auth.uid()` |
| `attachments` | privado | lectura: `core.can_view('ops','tasks')` (o el módulo del recurso) |
| `documentos-rh` | privado | lectura: `core.can_view('rh','documentos')` |
| `documentos-esc` | privado | lectura: `core.can_view('esc','procesos')` |

## Realtime

Publication separada por necesidad:

```sql
alter publication supabase_realtime add table ops.messages;
alter publication supabase_realtime add table ops.notifications;
```

Nada de RH ni Esc va a realtime salvo que lo pidamos explícitamente — controla costo de conexión.

## Lo que el SQL ya entrega

El archivo [`supabase/migrations/000_core_identity.sql`](../../supabase/migrations/000_core_identity.sql) crea:
- Los 4 schemas (`core`, `rh`, `esc`, `ops`).
- Las 7 tablas de `core` con RLS habilitado.
- Los 4 helpers (`is_super_admin`, `can_access_app`, `can_view`, `can_edit`).
- Las 2 vistas para el frontend (`my_apps`, `my_modules`).
- Trigger `on_auth_user_created` para autopoblar `core.profiles` al primer login.
- Seed de apps y módulos (24 módulos en total).

Lo que NO incluye (intencionalmente, va en migraciones posteriores):
- Tablas de `rh.*` (vienen del dump de RRHH).
- Tablas de `esc.*` (vienen del dump de escrituración).
- Tablas de `ops.*` (las define la 001 de OpsBoard, próxima migración).
- Shims de compatibilidad legacy (van en `001_rh_compat.sql` y `001_esc_compat.sql` post-restore).
