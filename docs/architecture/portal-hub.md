# Portal Hub — Arquitectura del repo

## Qué resuelve
Consolidar **escrituración + RRHH** en un solo repo Vite, con un launcher (portal) que centraliza login y dispara la app correspondiente. **OpsBoard se linkea desde el portal pero corre independiente** (Expo, mobile + web).

## Decisión de empaquetado: un Vite, varias apps internas

Tres opciones consideradas:

| Opción | Pros | Contras |
|--------|------|---------|
| **A. Microfrontends (Module Federation)** | Deploy independiente por app, equipos paralelos. | Sobreingeniería para 2 apps y un solo dev. Tooling pesado. |
| **B. Monorepo (pnpm workspaces) + 1 app shell** | Aislamiento real de deps por app. | Setup de pnpm + scripts; CI más complejo. Vercel necesita ajustes. |
| **C. Un solo Vite con rutas por app** ⭐ | Simple, 1 build, 1 deploy, 1 Vercel. Compartir code es trivial. | Bundle más grande (mitigado con lazy routes). |

**Elegida: C.** Hoy es lo más simple y eficiente. Si crece, migrar a B es localizado (mover `/apps/rh/*` y `/apps/esc/*` a sus paquetes).

## Stack del portal

- **Vite 5** + **React 18** + **TypeScript** (rrhh-portal ya es TS — el migrate de escrituración de JS a TS se hace gradual, conviven).
- **React Router v6** con `createBrowserRouter` + `lazy()` por sección.
- **TanStack Query** (lo introducimos ahora; rrhh-portal no lo usa hoy).
- **Supabase JS** con cliente único exportado desde `shared/lib/supabase.ts`.
- **Tailwind** (ambos repos ya lo usan, config unificada).
- **shadcn/ui** o componentes propios — TBD, no bloqueante.

## Estructura de carpetas

```
portal/                            # nuevo repo: portal-hub
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── vercel.json
├── public/
├── supabase/
│   ├── migrations/                # solo 'core'; RH/Esc viven en el proyecto pero los migra el portal
│   └── functions/                 # edge functions cross-app (invitaciones, etc.)
└── src/
    ├── main.tsx
    ├── App.tsx                    # Router root
    ├── routes.tsx                 # Definición de rutas con lazy()
    │
    ├── portal/                    # ★ El "launcher" propiamente dicho
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Launcher.tsx       # Grilla de apps a las que el user tiene acceso
    │   │   ├── Profile.tsx
    │   │   └── admin/
    │   │       ├── Users.tsx      # CRUD de usuarios + permisos
    │   │       ├── Apps.tsx
    │   │       └── Modules.tsx
    │   └── components/
    │
    ├── apps/
    │   ├── rh/                    # ex rrhh-portal/src
    │   │   ├── index.tsx          # Layout + sub-rutas
    │   │   ├── pages/
    │   │   ├── components/
    │   │   ├── lib/queries/       # React Query hooks (rh.*)
    │   │   └── README.md
    │   │
    │   └── esc/                   # ex escrituracion/src (migrado JS → TS gradual)
    │       ├── index.tsx
    │       ├── pages/
    │       ├── components/
    │       ├── lib/queries/       # React Query hooks (esc.*)
    │       └── README.md
    │
    ├── shared/                    # ★ Código compartido por las 3 capas
    │   ├── lib/
    │   │   ├── supabase.ts        # cliente único
    │   │   ├── auth.ts            # signIn/signOut, getSession
    │   │   ├── permissions.ts     # hooks useCanView/useCanEdit/useMyApps
    │   │   └── query-client.ts    # QueryClient compartido
    │   ├── components/            # Button, Input, Modal, EmptyState, etc.
    │   ├── hooks/
    │   └── types/
    │       ├── core.ts            # Tipos generados de schema core
    │       ├── rh.ts              # Tipos generados de schema rh
    │       └── esc.ts             # Tipos generados de schema esc
    │
    ├── styles/
    │   └── globals.css
    └── env.d.ts
```

## Routing y carga

`src/routes.tsx`:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RequireAuth, RequireApp } from '@/shared/lib/auth-guards';

const Login    = lazy(() => import('@/portal/pages/Login'));
const Launcher = lazy(() => import('@/portal/pages/Launcher'));
const RhApp    = lazy(() => import('@/apps/rh'));
const EscApp   = lazy(() => import('@/apps/esc'));

export const router = createBrowserRouter([
  { path: '/login',  element: <Login /> },
  { path: '/',       element: <RequireAuth><Launcher /></RequireAuth> },
  { path: '/rh/*',   element: <RequireAuth><RequireApp app="rh"><RhApp /></RequireApp></RequireAuth> },
  { path: '/esc/*',  element: <RequireAuth><RequireApp app="esc"><EscApp /></RequireApp></RequireAuth> },
  { path: '*',       element: <Navigate to="/" /> },
]);
```

- `RequireAuth` checa sesión Supabase. Si no, redirect a `/login`.
- `RequireApp` checa `core.user_app_access` via `useCanAccessApp(app)`. Si no, 403 + link al launcher.
- Cada `app` define sus sub-rutas internamente (`/rh/empleados`, `/rh/nomina/*`, etc.).
- `lazy()` por app → bundle inicial solo carga `portal/` y `shared/`.

## Sesión compartida con OpsBoard

OpsBoard corre en otro dominio (Expo web) pero comparte el mismo proyecto Supabase. Dos opciones para el SSO:

| Estrategia | Cómo |
|------------|------|
| **A. Login redundante** | OpsBoard tiene su propia pantalla de login. Mismo email/password → mismo `auth.users` → misma identidad. Más simple, UX peor. |
| **B. Magic link cross-domain** ⭐ | El portal genera un magic link con `supabase.auth.signInWithOtp` y abre `https://opsboard.example.com?token=...`. OpsBoard llama `setSession(token)`. Una sola pantalla de login en el portal. |

**Elegida: B** para web, **A** para móvil nativo (en móvil el usuario inicia desde la app de Expo directamente). Mismo backend, mismas tablas, misma sesión.

Implementación del launch desde el portal:

```tsx
// portal/components/AppLauncherCard.tsx
async function launchOpsBoard() {
  const { data: { session } } = await supabase.auth.getSession();
  // En web compartiendo cookies del mismo top-level domain alcanza.
  // Si no, usar el flow de transferencia de sesión:
  window.location.href = `https://opsboard.example.com/?refresh_token=${session.refresh_token}`;
}
```

OpsBoard del lado mobile (Expo) lee `refresh_token` del query param (solo en web) o login propio.

## Permisos en el frontend

`shared/lib/permissions.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useMyApps() {
  return useQuery({
    queryKey: ['core', 'my_apps'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('core').from('my_apps').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useMyModules(appCode: string) {
  return useQuery({
    queryKey: ['core', 'my_modules', appCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('core').from('my_modules')
        .select('*').eq('app_code', appCode);
      if (error) throw error;
      return data;
    },
  });
}

export function useCanEdit(appCode: string, moduleCode: string) {
  const { data } = useMyModules(appCode);
  return data?.find(m => m.module_code === moduleCode)?.can_edit ?? false;
}
```

Patrón en componentes:

```tsx
const canEdit = useCanEdit('rh', 'empleados');
return <Button disabled={!canEdit}>Editar</Button>;
```

La policy de RLS sigue siendo la última línea de defensa — el `disabled` es solo UX.

## Cliente Supabase con search_path

Para que el código de cada app no tenga que prefijar `rh.` o `esc.`, se inicializa **un cliente por schema**:

```ts
// shared/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);         // expone schema('core'), schema('rh'), etc.
export const sbCore   = () => supabase.schema('core');
export const sbRh     = () => supabase.schema('rh');
export const sbEsc    = () => supabase.schema('esc');
export const sbOps    = () => supabase.schema('ops');
```

Uso en queries:

```ts
const { data } = await sbRh().from('empleados').select('id, nombre');
const { data } = await sbEsc().from('procesos').select('id, comprador_id');
```

## Tipos generados

Por schema, separados:

```bash
supabase gen types typescript --project-id <unified> --schema core > src/shared/types/core.ts
supabase gen types typescript --project-id <unified> --schema rh   > src/shared/types/rh.ts
supabase gen types typescript --project-id <unified> --schema esc  > src/shared/types/esc.ts
```

Script en `package.json`: `"gen:types": "npm run gen:types:core && npm run gen:types:rh && npm run gen:types:esc"`.

## Variables de entorno

```
VITE_SUPABASE_URL=https://<unified>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_OPSBOARD_URL=https://opsboard.example.com
```

## Deploy

- **Vercel**: un solo proyecto, build `npm run build`, output `dist/`. SPA rewrite a `index.html` en `vercel.json`.
- **Dominio sugerido**: `portal.tudominio.com` (RH y Esc en `/rh` y `/esc`), OpsBoard en `opsboard.tudominio.com`.
- **Preview branches**: cada PR genera un preview Vercel con un `VITE_SUPABASE_URL` apuntando al proyecto (o a una branch de Supabase si se usa Supabase Branching).

## Nombre del repo

Sugerencia: **`portal-hub`** (o `portal`), creado nuevo. RRHH y Escrituración no se borran inmediatamente — quedan en read-only hasta que el cutover esté validado en prod (ver migration plan).
