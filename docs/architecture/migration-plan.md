# Plan de migración — Sin downtime

## Premisas
- Hoy hay **2 proyectos Supabase activos** con datos en producción (RH y Escrituración).
- La meta es **un solo proyecto unificado** con schemas `core`, `rh`, `esc`, `ops`.
- **Nadie pierde acceso ni datos**. RH y Esc siguen funcionando hasta el momento del cutover; existe rollback inmediato si algo falla.
- Hay **pocos usuarios concurrentes** (~30-50 empleados, app interna). Esto nos permite una ventana corta de mantenimiento por app (~30 min) en vez de una migración online completa con dual-write — que sería sobreingeniería.

## Estrategia general

**Big-bang por app, no por tabla.** Migramos RH y Esc en ventanas separadas (un fin de semana cada uno, o un par de noches). En cada ventana:

1. Snapshot del proyecto viejo (read-only).
2. `pg_dump` del schema → `pg_restore` al schema renombrado en el unificado.
3. Reescribir RLS para usar `core.*`.
4. Apuntar el frontend al proyecto unificado.
5. Smoke tests + monitoreo 24h.
6. Solo después de validar: archivar el proyecto viejo (no borrar por 30 días).

Esto es más simple y seguro que dual-write y, dado el volumen y el patrón de uso (interno, horario laboral), no compensa la complejidad de mantener dos backends sincronizados.

---

## Fase 0 — Preparación (sin tocar prod)

**Día 1-3.**

- [ ] Crear nuevo proyecto Supabase: nombre `portal-unified`, misma región que RRHH actual (minimiza latencia).
- [ ] Aplicar `000_core_identity.sql` → schemas `core/rh/esc/ops` vacíos + tablas core + seeds.
- [ ] Crear usuario `super_admin` (vos): `insert into core.user_global_roles values (auth.uid(), 'super_admin');` después del primer signup.
- [ ] Crear la org default: `insert into core.organizations (name, slug) values ('OrgPrincipal','main');`.
- [ ] Setup del nuevo repo `portal-hub` (estructura del doc anterior, sin lógica todavía, solo skeleton).
- [ ] Configurar Vercel preview pointing al unified.
- [ ] Setup local de la herramienta de migración:
  ```bash
  brew install postgresql@17    # o equivalente en Windows: choco install postgresql17
  ```

**Criterio de salida:** `core.my_apps` devuelve las 3 apps cuando consultás como super_admin.

---

## Fase 1 — Migración de RRHH (RH primero, porque es el más maduro)

**Por qué RH primero:**
- Ya tiene el sistema de permisos por módulo → su lógica mapea 1:1 al `core`.
- Schema más estable (24 migraciones vs 17 de esc, pero más adoptado por usuarios).
- Su frontend en TypeScript es más fácil de portar al portal sin sorpresas.

### 1.1 — Pre-cutover (sin downtime)

**Días -7 a -1 antes del cutover.**

- [ ] **Dump de schema** del proyecto RRHH actual:
  ```bash
  pg_dump -h db.<rh>.supabase.co -U postgres -n public --schema-only -F p \
    --no-owner --no-acl -f rh_schema.sql
  ```
- [ ] **Transformar**: renombrar `schema public` → `schema rh` en el dump (sed o script).
  ```bash
  sed -i 's/public\./rh\./g; s/SCHEMA public/SCHEMA rh/g' rh_schema.sql
  ```
  Revisar manualmente las referencias a `auth.*` que no deben renombrarse, y a funciones del extensions schema (`extensions.*`).
- [ ] **Aplicar el schema** al proyecto unificado en un entorno de prueba (Supabase Branching o un proyecto staging temporal).
- [ ] **Sustituir RLS de RH** por las nuevas que usan `core.can_view/can_edit`:
  - Crear `001_rh_shims.sql` con los 3 wrappers (`current_user_es_admin`, `current_user_puede_ver`, `current_user_puede_editar`).
  - Las policies existentes que llaman a esos nombres siguen funcionando sin cambios.
- [ ] **Test de queries clave**: levantar el frontend de RRHH apuntando al staging unified y validar:
  - Login con un usuario admin.
  - Listado de empleados.
  - Crear/editar empleado, alta de checada, generación de pre-nómina.
- [ ] **Generar tipos TS** del schema `rh` con `supabase gen types` para `portal-hub/src/shared/types/rh.ts`.
- [ ] **Portar `rrhh-portal/src` → `portal-hub/src/apps/rh/`**:
  - Reemplazar imports `from '@/lib/supabase'` por `import { sbRh } from '@/shared/lib/supabase'`.
  - Reemplazar `supabase.from('empleados')` por `sbRh().from('empleados')`.
  - `mis_modulos` view → `core.my_modules` filtrando por `app_code='rh'`.
  - Tests visuales/manuales de cada pantalla.

### 1.2 — Cutover (ventana de mantenimiento, ~30 min)

**Ejemplo: viernes 22:00.**

1. **Anuncio interno**: "RH no disponible 22:00-23:00, mantenimiento".
2. **Read-only en proyecto RRHH viejo**:
   ```sql
   -- en el proyecto viejo
   revoke insert, update, delete on all tables in schema public from authenticated;
   ```
3. **Dump de datos** del proyecto viejo (solo datos, schema ya está en unified):
   ```bash
   pg_dump -h db.<rh>.supabase.co -U postgres -n public --data-only \
     --disable-triggers -F p -f rh_data.sql
   ```
4. **Transformar** `public.` → `rh.` igual que en schema:
   ```bash
   sed -i 's/public\./rh\./g' rh_data.sql
   ```
5. **Restore al unified**:
   ```bash
   psql "postgresql://postgres:<pass>@db.<unified>.supabase.co/postgres" -f rh_data.sql
   ```
6. **Migrar `auth.users`** (los que existen en RRHH y no en unified):
   - Edge function que para cada user de `auth.users` viejo: crear en nuevo via Admin API con `email_confirm: true` y el mismo `id` (UUID).
   - Mantener `id` UUID = mantener identidad referencial con `rh.empleados.user_id`.
   - **No se migran contraseñas hasheadas** (Supabase usa bcrypt distinto en cada proyecto). Workaround: mandar `reset password` email al cutover.
   - Alternativa más amigable: usar API admin para setear password manualmente si tenemos acceso a los hashes (lo soporta `auth.admin.createUser` con `password_hash`).
7. **Poblar permisos en core**: para cada usuario migrado, replicar su fila de `usuarios_rol` y `usuarios_modulos` viejas:
   ```sql
   -- script SQL one-shot
   insert into core.user_app_access (user_id, app_code)
   select user_id, 'rh' from rh.usuarios_rol;

   insert into core.user_module_access (user_id, app_code, module_code, can_edit)
   select user_id, 'rh', modulo, puede_editar from rh.usuarios_modulos;

   insert into core.user_global_roles (user_id, role)
   select user_id, 'super_admin' from rh.usuarios_rol where rol = 'admin_rh';
   ```
8. **Smoke test rápido** (5 min):
   - Login como admin → ver lista de empleados → contar (debe matchear con prod viejo).
   - Login como usuario normal → ver solo sus módulos.
9. **Cambiar DNS / env**: el nuevo `portal-hub` apunta a `<unified>`. Si todavía no está el portal listo, RRHH viejo redirige a `portal.example.com/rh`.
10. **Anuncio**: "Listo, accedan vía portal.example.com".

### 1.3 — Validación 24h

- Monitorear errores en Supabase logs (`get_logs`).
- Monitorear `auth.audit_log_entries` para fallos de login.
- Mantener proyecto RRHH viejo encendido pero read-only — rollback es repointear DNS.

### 1.4 — Rollback (si algo se rompe)

1. Revertir env var del frontend al proyecto viejo.
2. Revertir el `revoke` que pusimos en read-only.
3. Investigar offline. Las inserciones que pasaron al unified se reaplican manualmente al viejo si hicieran falta (esperable: ninguna, porque el frontend estaba apuntando al unified todo el tiempo de la falla).

**Punto sin retorno:** después de 7 días de funcionamiento sin issues, marcar proyecto viejo como "archived" en Supabase y bajar el frontend RRHH original.

---

## Fase 2 — Migración de Escrituración

**Una vez RH lleva ≥1 semana estable.**

Mismo procedimiento que Fase 1, con estas diferencias:

### Mapeo de roles → permisos
Escrituración hoy usa `perfiles.rol IN ('admin','gerencia','asesor')` directamente en RLS. Hay que **traducir cada usuario** a `core.user_module_access` antes del cutover.

Script de migración a correr durante el cutover:

```sql
-- super_admin (rol='admin')
insert into core.user_global_roles (user_id, role)
select id, 'super_admin' from esc.perfiles where rol = 'admin';

-- acceso a la app esc para todos los perfiles
insert into core.user_app_access (user_id, app_code)
select id, 'esc' from esc.perfiles;

-- gerencia: edición full en los módulos operativos
insert into core.user_module_access (user_id, app_code, module_code, can_edit)
select id, 'esc', m.code, true
  from esc.perfiles, (values ('unidades'),('compradores'),('procesos'),('pagos'),('reportes')) as m(code)
 where rol = 'gerencia';

-- asesor: lectura general + edición de procesos
insert into core.user_module_access (user_id, app_code, module_code, can_edit)
select id, 'esc', m.code, m.editable
  from esc.perfiles,
       (values ('unidades',false),('compradores',true),('procesos',true),('pagos',false),('reportes',false)) as m(code, editable)
 where rol = 'asesor';
```

Adicionalmente: el RLS de "asesor solo sus procesos" (`responsable_id = auth.uid()`) se mantiene como AND extra:

```sql
create policy "asesor solo sus procesos write" on esc.procesos
  for update to authenticated
  using (core.can_edit('esc','procesos')
         and (core.is_super_admin()
              or responsable_id = auth.uid()
              or exists(select 1 from core.user_module_access
                        where user_id = auth.uid()
                          and app_code = 'esc' and module_code = 'admin')));
```

### Frontend: JS → TS gradual
El código actual es JS. **No bloqueante migrar a TS antes del cutover**. Lo movemos como JS a `portal-hub/src/apps/esc/`, funciona, y la conversión a TS es un follow-up por componente.

### Reescritura de queries
- Quitar referencias a `perfiles.rol` en frontend → reemplazar por `useCanEdit('esc', module)`.
- Reemplazar imports del cliente Supabase por `sbEsc()`.

---

## Fase 3 — OpsBoard (nuevo, sin migración)

Como es greenfield:
- Aplicar `001_ops_schema.sql` (próxima migración a redactar) al proyecto unified.
- El proyecto Expo actual (`agenda/`) cambia su `.env`:
  - `EXPO_PUBLIC_SUPABASE_URL` → unified.
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` → del unified.
- Configurar `lib/supabase.ts` para usar `schema('ops')` por default:
  ```ts
  createClient(url, key, { db: { schema: 'ops' } });
  ```
- Login en el portal genera magic link → OpsBoard web autosesionado.
- En móvil nativo: login propio dentro de Expo (auth.users compartido).

---

## Fase 4 — Limpieza

**Día +30 post-cutover de cada app:**
- Archivar proyecto viejo (Supabase: `pause_project`).
- Marcar repo `rrhh-portal` y `escrituracion` como archived en GitHub.
- README de cada uno apunta a `portal-hub`.

---

## Checklist resumido por fase

| Fase | Duración | Riesgo | Rollback |
|------|----------|--------|----------|
| 0. Preparación | 3 días | bajo | descartar proyecto unified |
| 1. RH cutover | 30 min ventana + 7 días observación | medio | re-point DNS al proyecto viejo |
| 2. Esc cutover | 30 min ventana + 7 días observación | medio | re-point DNS al proyecto viejo |
| 3. OpsBoard | progresivo (no migración) | bajo | n/a |
| 4. Limpieza | 1 día +30 después | bajo | n/a |

## Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| **Passwords no se transfieren entre proyectos** | Disparar reset-password masivo en el cutover, o usar `password_hash` en createUser si Supabase libera esa API; comunicar a usuarios con 48h de anticipación. |
| **Llaves foráneas a `public.perfiles` desde RH no rompen pero quedan huérfanas** | No hay cross-refs entre RH y Esc; cada uno usa su propio "perfil legacy" mapeado a `auth.users`. Validar con `\d` post-restore. |
| **RLS olvidada en alguna tabla migrada** | Después del restore, query:`select tablename from pg_tables where schemaname in ('rh','esc') and rowsecurity = false;` debe devolver 0 filas. |
| **`auth.uid()` distinto entre proyectos** | Los `id` UUID se preservan en la migración de `auth.users`; verificarlo en pre-cutover con 1 usuario de prueba. |
| **Edge functions del proyecto viejo** | Re-deployarlas al unified pre-cutover, mismo nombre. Listar con `list_edge_functions`. |
| **Storage** | Los buckets no se "migran" automáticamente; copiar con `rclone` o un script que itere `storage.from(...).list()` y `download → upload`. Ventana adicional de ~1h o hacer pre-sync. |
| **Realtime** | Crear publicaciones manualmente post-restore: `alter publication supabase_realtime add table ops.messages, ops.notifications`. |

## Lo que necesito de tu parte para arrancar Fase 0

1. **Confirmar nombre de la org**: ¿se llama "OrgPrincipal" o tiene un nombre real?
2. **Confirmar dominio**: para el seed de `core.apps.url` (`portal.tudominio.com/rh`, etc.).
3. **Confirmar región del proyecto unified**: hoy RH está en X (a confirmar con `list_projects`), Esc en `us-west-1`. Sugiero la región del RH actual para minimizar latencia del más usado.
4. **Decisión sobre passwords**: ¿hacemos reset masivo o investigamos el endpoint admin de hash-import?

Con eso arranco Fase 0 y dejo el unified listo para que validemos el primer login.
