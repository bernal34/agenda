# OpsBoard — Brief para Claude Code

## Descripción
App de gestión operativa interna tipo Notion/Monday para una organización de 30-50 empleados.
Disponible en **Web y App móvil (iOS + Android)** desde una sola base de código.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Mobile + Web | Expo (React Native) con Expo Router |
| Backend / DB | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| Deploy web | Vercel |
| Notificaciones push | Expo Push Notifications |
| Estilos | StyleSheet nativo de RN + NativeWind (Tailwind para RN) |
| Estado global | Zustand |
| Data fetching | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |

---

## Estructura de carpetas

```
opsboard/
├── app/                        # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── _layout.tsx         # Bottom tab navigator
│   │   ├── index.tsx           # Home / Mis tareas
│   │   ├── boards/
│   │   │   ├── index.tsx       # Lista de áreas
│   │   │   └── [areaId].tsx    # Tablero kanban del área
│   │   ├── chat/
│   │   │   ├── index.tsx       # Lista de canales
│   │   │   └── [channelId].tsx # Chat del canal
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   └── _layout.tsx             # Root layout
├── components/
│   ├── ui/                     # Componentes base (Button, Avatar, Badge, etc.)
│   ├── tasks/
│   │   ├── TaskCard.tsx        # Card de tarea en kanban
│   │   ├── TaskDetail.tsx      # Modal/sheet de detalle
│   │   └── TaskForm.tsx        # Formulario crear/editar tarea
│   ├── board/
│   │   ├── KanbanBoard.tsx     # Tablero con columnas
│   │   └── KanbanColumn.tsx    # Columna individual
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   └── ChannelList.tsx
│   └── notifications/
│       └── NotifItem.tsx
├── lib/
│   ├── supabase.ts             # Cliente Supabase
│   ├── auth.ts                 # Helpers de autenticación
│   └── queries/                # Queries de React Query por módulo
│       ├── tasks.ts
│       ├── channels.ts
│       └── notifications.ts
├── stores/
│   ├── authStore.ts            # Zustand: sesión y perfil
│   └── uiStore.ts              # Zustand: estado UI global
├── types/
│   └── database.ts             # Tipos generados de Supabase
├── constants/
│   └── colors.ts               # Paleta de colores OpsBoard
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Módulos y pantallas

### 1. Auth
- Login con email/password (Supabase Auth)
- Registro con invitación por org (no registro abierto)
- Persistencia de sesión con SecureStore

### 2. Home (index.tsx)
- Saludo personalizado con nombre y fecha
- Stats cards: "Mis tareas hoy" / "Vencen hoy"
- Chips de filtro por área
- Lista de tareas del usuario: En progreso → Por hacer → Completadas
- Cada TaskCard muestra: título, área, prioridad, fecha, progreso

### 3. Tablero Kanban (boards/[areaId].tsx)
- Columnas: `todo` | `in_progress` | `in_review` | `done`
- Scroll horizontal entre columnas
- Cards con: tag de área, título, avatares asignados, prioridad (dot), fecha
- Barra de progreso en tareas in_progress
- Botón "+ Agregar tarea" al pie de cada columna
- Filtros: por sprint, por asignado, por prioridad

### 4. Detalle de tarea (TaskDetail — Bottom Sheet)
- Título editable inline
- Descripción con markdown básico
- Asignados (multi-select de usuarios del área)
- Prioridad, fecha límite, área, proyecto, sprint
- Progreso (slider 0-100%)
- Subtareas
- Comentarios con menciones @
- Adjuntos (foto de cámara o archivo)
- Historial de actividad

### 5. Chat (chat/[channelId].tsx)
- Canales por área (automáticos al crear área)
- Mensajes en tiempo real via Supabase Realtime
- Burbujas: mensajes propios a la derecha, otros a la izquierda
- Menciones @usuario con highlight
- Responder a mensaje (reply thread)
- Link a tarea desde el chat
- Indicador de no leídos por canal

### 6. Notificaciones
- Lista separada: Nuevas / Anteriores
- Tipos: task_assigned, task_due, mention, comment, sprint_closed
- Marcar todas como leídas
- Tap en notif → navega al recurso relacionado

### 7. Perfil
- Avatar (subida a Supabase Storage)
- Nombre, cargo, área
- Preferencias de notificación
- Cerrar sesión

---

## Base de datos
El schema completo está en `supabase/migrations/001_initial_schema.sql`.
Tablas principales:
- `organizations` — tenant raíz
- `profiles` — usuarios (extiende auth.users)
- `areas` — departamentos con miembros
- `projects` + `pipeline_stages` — proyectos y fases
- `sprints` — sprints por área
- `tasks` + `task_assignees` + `task_labels` + `task_comments` — tareas completas
- `channels` + `messages` — chat en tiempo real
- `notifications` — alertas por usuario
- `activity_log` — historial de cambios

---

## Paleta de colores (constants/colors.ts)

```ts
export const colors = {
  brand: {
    primary:   '#534AB7',
    light:     '#EEEDFE',
    mid:       '#AFA9EC',
    dark:      '#3C3489',
  },
  status: {
    todo:       '#888780',
    progress:   '#EF9F27',
    review:     '#378ADD',
    done:       '#639922',
    urgent:     '#E24B4A',
  },
  areas: {
    design:     '#534AB7',
    engineering:'#185FA5',
    marketing:  '#0F6E56',
    operations: '#854F0B',
    hr:         '#993556',
  }
}
```

---

## Variables de entorno (.env)

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxx
```

---

## Reglas de desarrollo

1. Todos los componentes en TypeScript estricto
2. Cada query de Supabase va en `lib/queries/` como hook de React Query
3. RLS habilitado en todas las tablas — nunca bypassear con service key en cliente
4. Realtime habilitado solo en `messages` y `notifications` (costo de conexión)
5. Imágenes/avatares → Supabase Storage bucket `avatars` (público) y `attachments` (privado)
6. Navegación con Expo Router (file-based) — no usar React Navigation directamente
7. Bottom sheet para detalle de tarea → usar `@gorhom/bottom-sheet`
8. Drag & drop kanban → usar `react-native-drag-sortable` o similar

---

## Orden de implementación sugerido

1. Setup Expo + Supabase + NativeWind
2. Auth flow (login, sesión persistente)
3. Home screen con tareas del usuario
4. Tablero Kanban básico (sin drag & drop primero)
5. Crear/editar tarea (form + asignación)
6. Chat en tiempo real
7. Notificaciones (in-app + push)
8. Detalle completo de tarea (comentarios, adjuntos, subtareas)
9. Pipeline / proyectos
10. Dashboard de métricas
11. Drag & drop en kanban
12. Modo offline básico
