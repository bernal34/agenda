# CLAUDE.md — agenda (OpsBoard)

App interna de Grupo Prelar para tareas, tableros kanban y chat por área. En tiendas se llama **"Mi Agenda"** (`app.json`); en código y DB, **OpsBoard** / schema `ops`. Una sola base de código Expo para **web, iOS y Android**.

Es parte del ecosistema de `portal-hub`, pero **se despliega aparte**: el Launcher del portal la abre con un magic link (`VITE_OPSBOARD_URL`) y esta app consume la sesión con `detectSessionInUrl`. En móvil nativo el usuario inicia sesión aquí directo (mismo `auth.users`).

> **Expo 56 cambió mucho.** Antes de escribir código de Expo/RN, revisa la doc versionada: https://docs.expo.dev/versions/v56.0.0/ (ver `AGENTS.md`).

## Stack (lo que realmente se usa)

| Capa | Tecnología |
|---|---|
| App | Expo 56 · React Native 0.85 · React 19 · Expo Router (typed routes) |
| Estilos | `StyleSheet` de RN + tokens de `constants/theme.ts` |
| Estado global | Zustand (`stores/authStore.ts`, solo sesión) |
| Data fetching | TanStack Query v5 — hooks en `lib/queries/` |
| Forms | React Hook Form + Zod (hoy solo en las pantallas de `(auth)`) |
| Drag & drop | Propio, con `react-native-reanimated` + `react-native-gesture-handler` |
| Iconos | `lucide-react-native` |
| Backend | Supabase "Prelar Unificada" |
| Tests | Jest + `jest-expo` |
| Push | `expo-notifications` (nativo) + Web Push/VAPID en `public/sw.js` (web) → edge function `send-push` |

No hay NativeWind/Tailwind ni `@gorhom/bottom-sheet`: se instalaron al inicio pero nunca se cablearon ni usaron (el detalle de tarea es una ruta modal, no un sheet). Sus archivos de config ya se borraron; si `package.json` todavía los lista, falta correr `npm uninstall nativewind tailwindcss @gorhom/bottom-sheet`.

## Comandos

```
npm run web          # expo start --web
npm start            # expo start (QR para Expo Go / dev client)
npm run android | ios
npm run build:web    # expo export --platform web → dist/
npm test             # jest
npx tsc --noEmit     # typecheck (lo mismo que corre CI)
npm run gen:types    # tipos de ops + core → types/database.ts (requiere `npx supabase login` una vez)
deno check --node-modules-dir=none supabase/functions/send-push/index.ts   # typecheck de la edge function
```

`supabase/functions/` es Deno: tsconfig lo excluye y Jest solo toca sus módulos puros (p. ej. `message.ts`).

CI (`.github/workflows/test.yml`) corre typecheck + tests en push a `main` y en PRs. No hay script de lint.

## Backend: Supabase "Prelar Unificada"

Project ID **`mgfjswovpfrzjutmbevr`** (el mismo de portal-hub). El proyecto viejo `bqbidqffijfizsciksnv` está pausado.

`.env` (gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://mgfjswovpfrzjutmbevr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_VAPID_PUBLIC_KEY=...   # Web Push; también debe estar en las env vars de Vercel
```

`.env.push.local` (gitignored) guarda los secretos del servidor de push (VAPID privada, secreto del webhook). Nunca van al cliente.

`lib/supabase.ts` crea el cliente con `db: { schema: 'ops' }`, así que `supabase.from('tasks')` va a `ops.tasks`. Para `core` (perfiles, `is_super_admin`) usa `sbCore()`. Almacenamiento de sesión: `SecureStore` en nativo y `localStorage` en web. Flujo PKCE.

`core` y `ops` tienen que estar en **Dashboard → Settings → API → Exposed schemas**; eso no se puede hacer desde SQL (ver `011_grants_core_ops.sql`).

## Permisos (dos capas)

1. **Portal (`core`)**: `core.can_view('ops', módulo)` / `core.can_edit('ops', módulo)`, con módulos `tasks`, `boards`, `chat`, `notifications`, `admin`. Todas las policies de `ops` los usan.
2. **Por área (`ops`)**: `ops.area_members.role` ∈ `owner | admin | member`. `ops.is_area_member(area_id)` (super_admin siempre pasa) filtra casi todo. `ops.can_manage_area_members(area_id)` decide quién gestiona miembros, custom fields, etc.

La pantalla `admin` se gatea con `core.is_super_admin()` (`useIsAdmin` en `lib/queries/admin.ts`). La app **no** revisa `core.user_app_access` al entrar: un usuario sin acceso a `ops` inicia sesión y ve todo vacío, porque RLS filtra.

## Modelo de datos (`ops.*`)

- **`areas`**: tableros. `personal = true` es el tablero propio de cada empleado; se crea automáticamente al alta en `core.profiles`, y la RPC `ensure_my_personal_board()` funciona como red de seguridad desde el cliente. Crear un tablero personal: `create_personal_area(name, color)`. La policy `areas write` solo deja escribir `ops.areas` a un admin de ops, así que todo lo demás pasa por RPC security definer: `create_area(name, color)` (tablero de equipo, el creador queda como `owner`) y `rename_area(area, name)` (pide `can_manage_area_members`), ambas en 260, más `delete_area(area)` (270, borra en cascada tareas, etapas, canales, plantillas, reglas y miembros). Las tres piden `can_manage_area_members` salvo `create_area`, que solo pide acceso al módulo `boards`.
- **`board_stages`**: columnas configurables por área (`code`, `label`, `color`, `sort_order`, `is_done`). **`tasks.status` es texto libre** que apunta a `board_stages.code`; los defaults son `todo | in_progress | in_review | done`. No hardcodees estados.
- **`tasks`**: `priority` (`low|normal|high|urgent`), `progress` 0-100, `start_date` + `due_date` (rango; `due_date` es la "fecha final"), `start_at` (hora de inicio, anclada a `start_date`), `recurrence_rule` jsonb, `completed_at`, `archived_at`.
- Subrecursos de tarea: `task_assignees` (con `snoozed_until` por asignado), `task_labels`, `task_comments` (con `mentions uuid[]`), `task_attachments`, `subtasks`, `task_dependencies`, `task_custom_values`.
- Por área: `custom_fields`, `task_templates` + `task_template_items`, `automation_rules`.
- Chat: `channels` (`kind` = `area | direct | group`) · `channel_members` (`last_read_at` para no leídos) · `messages` (`parent_id` para responder, `task_ref` para enlazar una tarea).
- `notifications` (por usuario) y `activity_log`.

**Eliminados**: `projects` (060) y `sprints` (070), junto con las notificaciones `sprint_closed`. No los reintroduzcas sin decisión de producto.

Los identificadores de `ops` están **en inglés** (`tasks`, `areas`, `due_date`), a diferencia de `esc`/`rh`. Los textos de UI van en español. No traduzcas identificadores en ninguna dirección.

## Lógica que vive en la DB

Mucho comportamiento no está en el cliente. Antes de implementar algo "en el front", revisa si ya existe como trigger:

| Qué | Dónde |
|---|---|
| Notificación al asignar, comentar o mencionar | 020, 100 |
| Activity log (creada, cambio de estado, completada, comentario, adjunto, asignación…) | 090 |
| Siguiente instancia de una tarea recurrente al pasar a `done` | 140 |
| `completed_at` + auto-archivado diario (pg_cron `ops-auto-archive-done` → `ops.fn_auto_archive_done()`, 00:05 CDMX, corte a medianoche CDMX) | 160, 240 |
| Reglas de automatización (`status_changed_to`/`created` → `set_priority`/`assign_to`/`add_label`/`set_status`/`archive`); `pg_trigger_depth() <= 2` evita loops | 190 |
| Canal de chat automático por área + sincronización de miembros | 200 |
| Aviso `task_start_soon` (pg_cron `ops_task_reminders`, cada minuto) | 220 |
| Etapas default al crear un área | 040 |

## Realtime

Solo `ops.messages` y `ops.notifications` están en la publication `supabase_realtime` (010), y las suscripciones usan `schema: 'ops'` (`lib/queries/channels.ts`, `lib/queries/notifications.ts`). Si agregas realtime a otra tabla, necesitas **las dos cosas**: `alter publication supabase_realtime add table ops.x` **y** `schema: 'ops'` en el `.on('postgres_changes', …)`. Si falta una, la mutación funciona pero la UI no refresca (mismo gotcha documentado en portal-hub).

## Push notifications

Flujo: insert en `ops.notifications` → trigger `ops.tg_dispatch_push` (250) → `net.http_post` a la edge function `send-push` con `{ notification_id }` y el header `x-push-secret` → la función arma el texto (`message.ts`) y lo manda a cada dispositivo del usuario en `ops.push_subscriptions`: Web Push (VAPID) para `web` y Expo Push API para `ios`/`android`. Las suscripciones que el proveedor reporta como muertas se borran.

- **Cliente**: `lib/push.ts` (nativo) y `lib/push.web.ts` (web) exportan la misma API (`getPushStatus`, `enablePush`, `disablePush`, `syncPush`, `forgetThisDevice`, `usePushNavigation`). Metro elige el archivo por plataforma, pero tsc solo ve `push.ts`, así que **cualquier cambio de firma va en los dos**. La lógica pura (estados, auto-sync, llave VAPID) vive en `lib/pushModel.ts`.
- El usuario activa las push desde Perfil. `usePushSync` re-registra el dispositivo al abrir la app si ya había permiso, y `signOut` lo da de baja antes de cerrar la sesión.
- En web, `enablePush` llama a `Notification.requestPermission()` antes de cualquier otro `await`, porque Safari exige que ocurra dentro del gesto del usuario. En iPhone solo funciona con la PWA instalada en la pantalla de inicio.
- Al tocar una push: en web lo resuelve `notificationclick` en `public/sw.js`; en nativo, `usePushNavigation`.
- Si agregas un `kind` de notificación, agrega su texto en `supabase/functions/send-push/message.ts`, junto con su test.

Configuración fuera del repo (una vez):
1. Secrets de la función: `PUSH_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (valores en `.env.push.local`).
2. Deploy: `supabase functions deploy send-push --project-ref mgfjswovpfrzjutmbevr --no-verify-jwt`. La autenticación es el `x-push-secret`, no un JWT.
3. Secrets de Vault `ops_push_function_url` y `ops_push_webhook_secret` (ver cabecera de 250). Sin ellos, el trigger no hace nada.
4. `EXPO_PUBLIC_VAPID_PUBLIC_KEY` en Vercel.
5. Nativo, además: `eas init` (agrega el `projectId`) y credenciales de APNs/FCM con `eas credentials`.

Los pasos 1-4 ya están hechos en producción; falta el 5.

`service_role` **no** tiene grants de tabla en `ops`/`core`: 011 solo cubre `anon`/`authenticated`. Si una edge function lee una tabla más, necesita su `grant select … to service_role` (ver 251); sin él responde `permission denied for table …`.

En Windows, el CLI de Supabase: `npx.cmd` si PowerShell bloquea `npx.ps1`, y `supabase login` en una terminal propia (el `!` de Claude Code no es TTY).

## Storage

- `avatars`: público.
- `task-attachments`: privado; path `<task_id>/<random>.<ext>`; acceso gateado por membresía al área de la tarea (080).

## Migraciones

`supabase/migrations/` contiene las migraciones de **todo el proyecto unificado**, no solo `ops`: también `000_core_identity`, `003_admin_user_list`, `004_esc_schema` y `005_esc_perfiles_sync`. portal-hub no tiene carpeta de migraciones; buscarlas allá es un error común.

- Numeración de 10 en 10; la siguiente libre es **280**.
- Zona horaria del negocio: `America/Mexico_City`. pg_cron agenda en UTC y la sesión de la DB también es UTC, así que toda lógica de "hoy" o "medianoche" debe convertir explícitamente (ver 240). Nunca uses `date_trunc('day', now())` a secas.
- Si agregas un `kind` de notificación, actualiza también el check `notifications_kind_check` (hoy vive en 240). Los parches de una migración usan +1 (`031`, `121`).
- Escríbelas idempotentes (`if not exists`, `drop policy if exists`, `create or replace`), como las existentes.
- Se aplican al proyecto con la herramienta `apply_migration` del MCP de Supabase; no hay CLI configurado en el repo.
- RLS habilitado en toda tabla nueva. Nunca uses la service key en el cliente.

## Estructura

```
app/
├── _layout.tsx               # QueryClient, sesión, guard de rutas, modo recovery
├── (auth)/                   # login, forgot-password, reset-password
└── (app)/
    ├── (tabs)/               # Inicio · Tableros · Chats · Avisos · Perfil (+ FAB "nueva tarea")
    │   ├── index.tsx         # Mis tareas
    │   ├── boards/           # lista de áreas y kanban [areaId]
    │   ├── chat/             # canales y [channelId]
    │   ├── notifications.tsx
    │   └── profile.tsx
    ├── tasks/new.tsx, tasks/[id].tsx   # modales
    ├── delegated.tsx         # tareas que asigné a otros
    ├── activity.tsx          # feed de actividad
    ├── admin.tsx             # super_admin: usuarios ↔ áreas
    └── area-members/ · automations/ · custom-fields/ · templates/   # config por [areaId]
components/  ui/ (Button, Card, Avatar, SearchDialog, ShortcutsDialog…) · tasks/ · board/ · calendar/
lib/         supabase.ts · queries/ (un archivo por dominio) · lógica pura + __tests__/
stores/      authStore.ts
constants/   theme.ts (tokens)
supabase/    migrations/ · functions/send-push/ (Deno)
public/      index.html (template HTML), manifest.webmanifest, sw.js (PWA + push)
```

## Convenciones

- **Estilos**: `StyleSheet.create` + tokens de `constants/theme.ts`. En componentes, prefiere los roles semánticos (`tokens.bg.surface`, `tokens.text.muted`) sobre `palette.*` directo. El color de marca es el púrpura `#534AB7`.
- **Queries**: cada acceso a Supabase va como hook de React Query en `lib/queries/<dominio>.ts`. Después de una mutación, invalida todas las keys afectadas (ver `admin.ts` como referencia).
- **Lógica pura** (mapeos, fechas, stats, grilla de calendario) va en `lib/*.ts` sin dependencias de Supabase, con test en `lib/__tests__/`. Es la única parte con tests; mantenla así.
- **Alertas**: usa `notify()` de `lib/notify.ts` (hace `window.alert` en web y `Alert.alert` en nativo), no `Alert` directo.
- **Web**: hay atajos de teclado (`c` para nueva tarea, `cmd+k` o `/` para buscar, `g+i/t/c/n/p` para navegar, `?` para ver atajos) definidos en `app/(app)/(tabs)/_layout.tsx`. Si agregas una pantalla principal, agrega su atajo.
- TypeScript estricto. No hay tipos generados de Supabase (`types/` está vacío) y los mapeos usan `any`.

## Despliegue

- **Web**: Vercel, con `expo export --platform web` hacia `dist/` y rewrite de SPA en `vercel.json`. Tras un deploy puede hacer falta un hard refresh (Ctrl+Shift+R).
- **HTML base = `public/index.html`**. Con el output SPA (el default; `app.json` no define `web.output`), Expo usa ese archivo como template: reemplaza `%WEB_TITLE%` e inyecta los scripts antes de `</body>`. **`app/+html.tsx` no aplica en SPA** (solo con `web.output: "static"`); por eso durante meses la PWA salió sin manifest ni service worker, y el archivo se eliminó. El manifest, los meta tags de PWA/iOS, la fuente Inter y el registro de `sw.js` viven en `public/index.html`. Para comprobarlo: `npx expo export --platform web` y revisar `dist/index.html`.
- Gotcha del template: Expo sustituye con `String.replace`, o sea **solo la primera aparición** de `%WEB_TITLE%`, `</head>` y `</body>`. Si alguno aparece en un comentario, el título queda sin reemplazar o el `<script>` del bundle termina dentro del comentario y la app no carga. No los escribas en comentarios.
- `public/sw.js` es network-first, nunca cachea `/rest/` ni `/auth/`, y maneja `push`/`notificationclick`.
- **Nativo**: EAS (`eas.json`, perfiles development/preview/production). Bundle id: `com.grupoprelar.opsboard`. El submit de iOS no está configurado (`ascAppId` vacío).

## Deuda conocida / no confiar en

- **`task_due` no tiene productor**: está en el check y en el tipo del cliente, pero ningún trigger ni cron lo genera.
- **`'done'` hardcodeado en la DB**: `touch_completed_at` (160), el auto-archivado (240) y la recurrencia (140) comparan `status = 'done'` en lugar de usar `board_stages.is_done`. Una etapa personalizada marcada como final no archiva ni recurre.
- `delegated.tsx` también hardcodea los 4 estados default.
- Nombre inconsistente: la PWA instalada se llama "OpsBoard" (`manifest.webmanifest`), pero la app en tiendas y el título web dicen "Mi Agenda". En iPhone, el nombre del manifest es el que aparece en las push.
- `design-system/opsboard/MASTER.md` (gitignored) trae una paleta roja/dorada autogenerada que **no** es la de la app. La fuente de verdad es `constants/theme.ts`.
- `docs/architecture/` es el plan original de la unificación: histórico, con dominios de ejemplo y pendientes que ya se resolvieron.
