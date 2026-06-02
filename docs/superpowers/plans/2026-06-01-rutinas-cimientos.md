# Rutinas — Plan 1: Cimientos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener una app SvelteKit con auth funcional, base de datos Supabase con todo el esquema y RLS, y una pantalla de dashboard con tarjetas placeholder. Al terminar este plan, el usuario puede registrarse, entrar, ver el hub vacío, y cerrar sesión.

**Architecture:** SvelteKit con adaptador de Cloudflare Pages. Supabase para auth + Postgres con RLS estricto. Cliente Supabase del lado del servidor en hooks; del lado del navegador para operaciones autenticadas simples. Tailwind para estilos.

**Tech Stack:** SvelteKit, TypeScript, TailwindCSS, Supabase (auth + Postgres), `@supabase/ssr`, `@sveltejs/adapter-cloudflare`. Spec: [docs/superpowers/specs/2026-06-01-rutinas-design.md](../specs/2026-06-01-rutinas-design.md).

---

## Pre-requisitos manuales (hacer una vez antes de empezar)

1. **Crear proyecto Supabase** en https://supabase.com → New project. Anotar `Project URL`, `anon public key`, `service_role key` (Settings → API).
2. **Instalar Node.js 20+** (`node --version` debe decir v20 o superior).
3. **Instalar Git** y configurar `user.name` / `user.email`.

Estos valores se usan en Task 3.

---

### Task 1: Scaffold del proyecto SvelteKit

**Files:**
- Create: `package.json`, `svelte.config.js`, `tsconfig.json`, `vite.config.ts`, `src/app.html`, `src/app.d.ts`, `.gitignore` (todo generado por el scaffold)

- [ ] **Step 1: Crear el proyecto con el scaffold oficial**

Desde `C:\Web rutinas`:

```bash
npm create svelte@latest .
```

Responder al wizard:
- *Which Svelte app template?* → **Skeleton project**
- *Add type checking with TypeScript?* → **Yes, using TypeScript syntax**
- *Select additional options* → marcar **ESLint** y **Prettier** (no Playwright/Vitest aún).

- [ ] **Step 2: Instalar dependencias**

```bash
npm install
```

Esperado: termina sin errores, crea `node_modules/` y `package-lock.json`.

- [ ] **Step 3: Verificar que arranca**

```bash
npm run dev
```

Abrir http://localhost:5173. Esperado: ver "Welcome to SvelteKit". `Ctrl+C` para parar.

- [ ] **Step 4: Inicializar git y primer commit**

```bash
git init
git add .
git commit -m "chore: scaffold sveltekit project"
```

---

### Task 2: Configurar adaptador Cloudflare y Tailwind

**Files:**
- Modify: `svelte.config.js`
- Modify: `package.json` (vía npm install)
- Create: `tailwind.config.js`, `postcss.config.js`, `src/app.css`
- Modify: `src/routes/+layout.svelte` (crear si no existe)

- [ ] **Step 1: Instalar adaptador de Cloudflare**

```bash
npm install -D @sveltejs/adapter-cloudflare
```

- [ ] **Step 2: Cambiar adaptador en svelte.config.js**

Reemplazar `svelte.config.js` por:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: { include: ['/*'], exclude: ['<all>'] }
    })
  }
};

export default config;
```

- [ ] **Step 3: Instalar Tailwind**

```bash
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 4: Configurar `tailwind.config.js`**

Reemplazar contenido por:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 5: Crear `src/app.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  font-size: 18px;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
```

- [ ] **Step 6: Crear `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '../app.css';
</script>

<slot />
```

- [ ] **Step 7: Verificar build y dev**

```bash
npm run dev
```

Esperado: la página de bienvenida ahora se ve con la tipografía system-ui más grande y fondo gris claro.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: add cloudflare adapter and tailwind"
```

---

### Task 3: Variables de entorno y cliente Supabase

**Files:**
- Create: `.env`, `.env.example`
- Create: `src/lib/server/env.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Crear `.env.example`**

```
# Supabase
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Anthropic (se usa en planes posteriores)
ANTHROPIC_API_KEY=YOUR_KEY

# Google OAuth (se usa en planes posteriores)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Cifrado de tokens OAuth (32 bytes base64). Generar con:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_TOKEN_ENCRYPTION_KEY=
```

- [ ] **Step 2: Crear `.env` copiando desde `.env.example` y rellenando con los valores reales del proyecto Supabase**

Editar `.env` y poner los valores reales del Project URL, anon key y service_role key obtenidos en los pre-requisitos. Dejar Anthropic/Google vacíos por ahora.

- [ ] **Step 3: Asegurar que `.env` está en `.gitignore`**

Verificar que `.gitignore` contiene `.env`. Si no, añadirlo:

```
.env
```

- [ ] **Step 4: Crear `src/lib/server/env.ts` con un helper tipado**

```typescript
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const env = {
  supabaseUrl: PUBLIC_SUPABASE_URL,
  supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY
};
```

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore src/lib/server/env.ts
git commit -m "chore: add env config and example"
```

---

### Task 4: Esquema de base de datos y RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

Este migration crea TODAS las tablas del spec, aunque algunas se usen en planes posteriores. Mejor cerrarlo de una.

- [ ] **Step 1: Crear el directorio `supabase/migrations/`**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Crear `supabase/migrations/0001_init.sql` con el siguiente contenido**

```sql
-- Extensión necesaria para gen_random_uuid()
create extension if not exists pgcrypto;

-- =====================================================
-- profiles
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text not null default 'Europe/Madrid',
  locale text not null default 'es',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger: crear fila en profiles al registrarse un usuario nuevo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- events
-- =====================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  category text not null default 'otro'
    check (category in ('medico', 'familia', 'trabajo', 'personal', 'otro')),
  source text not null default 'manual'
    check (source in ('manual', 'ai_text', 'ai_email')),
  created_at timestamptz not null default now()
);

create index events_user_starts on public.events (user_id, starts_at);

alter table public.events enable row level security;

create policy "events_select_own" on public.events for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert with check (auth.uid() = user_id);
create policy "events_update_own" on public.events for update using (auth.uid() = user_id);
create policy "events_delete_own" on public.events for delete using (auth.uid() = user_id);

-- =====================================================
-- bills
-- =====================================================
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'EUR',
  due_date date not null,
  paid boolean not null default false,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'monthly', 'yearly')),
  provider text,
  notes text,
  source text not null default 'manual'
    check (source in ('manual', 'ai_text', 'ai_email')),
  created_at timestamptz not null default now()
);

create index bills_user_due on public.bills (user_id, due_date);

alter table public.bills enable row level security;

create policy "bills_select_own" on public.bills for select using (auth.uid() = user_id);
create policy "bills_insert_own" on public.bills for insert with check (auth.uid() = user_id);
create policy "bills_update_own" on public.bills for update using (auth.uid() = user_id);
create policy "bills_delete_own" on public.bills for delete using (auth.uid() = user_id);

-- =====================================================
-- oauth_tokens (acceso solo desde service_role)
-- =====================================================
create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_tokens enable row level security;
-- Sin políticas: ningún cliente puede leer ni escribir. Solo service_role (bypass RLS).

-- =====================================================
-- email_classifications
-- =====================================================
create table public.email_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_name text,
  from_email text,
  subject text,
  snippet text,
  received_at timestamptz,
  category text not null
    check (category in ('urgente', 'importante', 'informativo', 'ruido')),
  one_line_summary text,
  suggested_action text not null default 'ninguna'
    check (suggested_action in ('crear_evento', 'crear_factura', 'ninguna')),
  classified_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index email_class_user_received on public.email_classifications (user_id, received_at desc);

alter table public.email_classifications enable row level security;

create policy "email_class_select_own" on public.email_classifications for select using (auth.uid() = user_id);
create policy "email_class_insert_own" on public.email_classifications for insert with check (auth.uid() = user_id);
create policy "email_class_update_own" on public.email_classifications for update using (auth.uid() = user_id);
create policy "email_class_delete_own" on public.email_classifications for delete using (auth.uid() = user_id);

-- =====================================================
-- daily_summaries
-- =====================================================
create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_summaries enable row level security;

create policy "daily_select_own" on public.daily_summaries for select using (auth.uid() = user_id);
create policy "daily_insert_own" on public.daily_summaries for insert with check (auth.uid() = user_id);
create policy "daily_update_own" on public.daily_summaries for update using (auth.uid() = user_id);
```

- [ ] **Step 3: Aplicar el migration en Supabase**

En el dashboard de Supabase: **SQL Editor → New query** → pegar el contenido completo de `0001_init.sql` → **Run**.

Esperado: "Success. No rows returned." Sin errores.

- [ ] **Step 4: Verificar tablas creadas**

En Supabase: **Table Editor**. Verificar que aparecen: `profiles`, `events`, `bills`, `oauth_tokens`, `email_classifications`, `daily_summaries`. Cada una con el icono de candado (RLS activo).

- [ ] **Step 5: Verificar el trigger funciona — crear un usuario de prueba**

En Supabase: **Authentication → Users → Add user → Create new user**. Email: `test@example.com`, contraseña: `Test12345!`, marcar "Auto Confirm User".

Después en **Table Editor → profiles**, debe aparecer una fila con ese `id`.

- [ ] **Step 6: Borrar el usuario de prueba**

En **Authentication → Users**, clic en `...` junto al usuario de prueba → **Delete user**. Verificar que la fila de `profiles` también desaparece (cascade).

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: initial database schema with RLS"
```

---

### Task 5: Cliente Supabase del lado servidor y manejo de sesión

**Files:**
- Modify: `src/app.d.ts`
- Create: `src/hooks.server.ts`
- Create: `src/lib/server/supabase.ts`

Para SvelteKit + Cloudflare, usamos `@supabase/ssr` que crea clientes con cookies.

- [ ] **Step 1: Instalar `@supabase/ssr` y `@supabase/supabase-js`**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Editar `src/app.d.ts`**

Reemplazar todo el archivo por:

```typescript
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
      session: Session | null;
      user: User | null;
    }
    interface PageData {
      session: Session | null;
      user: User | null;
    }
  }
}

export {};
```

- [ ] **Step 3: Crear `src/hooks.server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { env } from '$lib/server/env';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        }
      }
    }
  );

  event.locals.safeGetSession = async () => {
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    // getUser revalida contra el servidor de Supabase (no confía solo en la cookie)
    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();

    if (error) return { session: null, user: null };
    return { session, user };
  };

  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  });
};
```

- [ ] **Step 4: Crear `src/lib/server/supabase.ts` — cliente con service_role para tareas administrativas**

```typescript
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Cliente con service_role. Bypasea RLS. Usar solo en endpoints +server.ts
 * para operaciones donde necesitamos saltarnos RLS (ej. oauth_tokens).
 * NUNCA exponer al navegador.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
```

- [ ] **Step 5: Crear `src/routes/+layout.server.ts` para pasar user/session a las páginas**

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    session: locals.session,
    user: locals.user
  };
};
```

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
npm run check
```

Esperado: 0 errores, 0 warnings (puede haber warnings menores sobre rutas no usadas — ignorarlos).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: supabase server client and session hook"
```

---

### Task 6: Landing y página de login

**Files:**
- Modify: `src/routes/+page.svelte`
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/login/+page.server.ts`

- [ ] **Step 1: Reemplazar `src/routes/+page.svelte` (landing)**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<svelte:head>
  <title>Rutinas</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center p-6">
  <div class="max-w-xl w-full text-center space-y-8">
    <h1 class="text-5xl font-bold tracking-tight">Rutinas</h1>
    <p class="text-xl text-slate-600">
      Una sola pantalla con todo lo importante de tu día: tu correo ordenado,
      tus citas, tus facturas. Sin ruido.
    </p>
    <div class="flex gap-4 justify-center pt-4">
      {#if data.user}
        <a href="/dashboard" class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800">
          Ir a mi dashboard
        </a>
      {:else}
        <a href="/signup" class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800">
          Crear cuenta
        </a>
        <a href="/login" class="border border-slate-300 px-6 py-3 rounded-lg font-medium hover:bg-slate-100">
          Entrar
        </a>
      {/if}
    </div>
  </div>
</main>
```

- [ ] **Step 2: Crear `src/routes/login/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.session) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      return fail(400, { email, error: 'Introduce email y contraseña.' });
    }

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail(400, { email, error: 'Email o contraseña incorrectos.' });
    }

    throw redirect(303, '/dashboard');
  }
};
```

- [ ] **Step 3: Crear `src/routes/login/+page.svelte`**

```svelte
<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>Entrar — Rutinas</title></svelte:head>

<main class="min-h-screen flex items-center justify-center p-6">
  <form method="POST" class="max-w-sm w-full space-y-5 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
    <h1 class="text-2xl font-bold">Entrar</h1>

    {#if form?.error}
      <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">{form.error}</p>
    {/if}

    <label class="block">
      <span class="text-sm font-medium text-slate-700">Email</span>
      <input
        type="email"
        name="email"
        required
        value={form?.email ?? ''}
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
      />
    </label>

    <label class="block">
      <span class="text-sm font-medium text-slate-700">Contraseña</span>
      <input
        type="password"
        name="password"
        required
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
      />
    </label>

    <button type="submit" class="w-full bg-slate-900 text-white py-2.5 rounded-md font-medium hover:bg-slate-800">
      Entrar
    </button>

    <p class="text-center text-sm text-slate-600">
      ¿No tienes cuenta? <a href="/signup" class="text-slate-900 font-medium underline">Crea una</a>
    </p>
  </form>
</main>
```

- [ ] **Step 4: Verificar visualmente**

```bash
npm run dev
```

Abrir http://localhost:5173/login. Esperado: formulario centrado con título "Entrar", dos campos, botón. Probar enviar vacío → "Introduce email y contraseña." Probar credenciales inválidas → "Email o contraseña incorrectos."

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: landing and login page"
```

---

### Task 7: Página de registro y logout

**Files:**
- Create: `src/routes/signup/+page.svelte`
- Create: `src/routes/signup/+page.server.ts`
- Create: `src/routes/logout/+server.ts`

- [ ] **Step 1: Crear `src/routes/signup/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.session) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const formData = await request.formData();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const fullName = String(formData.get('full_name') ?? '').trim();

    if (!email || !password) {
      return fail(400, { email, fullName, error: 'Email y contraseña son obligatorios.' });
    }
    if (password.length < 8) {
      return fail(400, { email, fullName, error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const { error } = await locals.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${url.origin}/login`
      }
    });

    if (error) {
      return fail(400, { email, fullName, error: error.message });
    }

    return { success: true, email };
  }
};
```

- [ ] **Step 2: Crear `src/routes/signup/+page.svelte`**

```svelte
<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>Crear cuenta — Rutinas</title></svelte:head>

<main class="min-h-screen flex items-center justify-center p-6">
  <form method="POST" class="max-w-sm w-full space-y-5 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
    <h1 class="text-2xl font-bold">Crear cuenta</h1>

    {#if form?.success}
      <p class="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm">
        Te enviamos un email de confirmación a <strong>{form.email}</strong>. Ábrelo para activar la cuenta.
      </p>
    {/if}

    {#if form?.error}
      <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">{form.error}</p>
    {/if}

    <label class="block">
      <span class="text-sm font-medium text-slate-700">Nombre (opcional)</span>
      <input
        type="text"
        name="full_name"
        value={form?.fullName ?? ''}
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
      />
    </label>

    <label class="block">
      <span class="text-sm font-medium text-slate-700">Email</span>
      <input
        type="email"
        name="email"
        required
        value={form?.email ?? ''}
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
      />
    </label>

    <label class="block">
      <span class="text-sm font-medium text-slate-700">Contraseña (mínimo 8 caracteres)</span>
      <input
        type="password"
        name="password"
        required
        minlength="8"
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
      />
    </label>

    <button type="submit" class="w-full bg-slate-900 text-white py-2.5 rounded-md font-medium hover:bg-slate-800">
      Crear cuenta
    </button>

    <p class="text-center text-sm text-slate-600">
      ¿Ya tienes cuenta? <a href="/login" class="text-slate-900 font-medium underline">Entra</a>
    </p>
  </form>
</main>
```

- [ ] **Step 3: Crear `src/routes/logout/+server.ts`**

```typescript
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  await locals.supabase.auth.signOut();
  throw redirect(303, '/');
};
```

- [ ] **Step 4: Verificar registro funcional**

```bash
npm run dev
```

Ir a http://localhost:5173/signup. Crear una cuenta con un email real al que tengas acceso. Esperado: mensaje verde "Te enviamos un email…". Confirmar desde el email. En Supabase **Authentication → Users** debe aparecer el usuario como confirmado, y **Table Editor → profiles** debe tener su fila.

> Si no quieres confirmar por email durante desarrollo: en Supabase **Authentication → Providers → Email**, desactivar "Confirm email" temporalmente.

- [ ] **Step 5: Probar login**

Ir a `/login`, entrar con esas credenciales. Esperado: redirige a `/dashboard` (que aún no existe → 404). Eso se arregla en la próxima task.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: signup and logout"
```

---

### Task 8: Dashboard con auth guard y hub de intención (placeholder)

**Files:**
- Create: `src/routes/dashboard/+layout.server.ts`
- Create: `src/routes/dashboard/+layout.svelte`
- Create: `src/routes/dashboard/+page.server.ts`
- Create: `src/routes/dashboard/+page.svelte`

- [ ] **Step 1: Crear `src/routes/dashboard/+layout.server.ts` (auth guard)**

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) {
    throw redirect(303, '/login');
  }
  return {
    user: locals.user
  };
};
```

- [ ] **Step 2: Crear `src/routes/dashboard/+layout.svelte` (chrome común)**

```svelte
<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>

<div class="min-h-screen">
  <header class="border-b border-slate-200 bg-white">
    <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/dashboard" class="font-bold text-lg">Rutinas</a>
      <nav class="flex items-center gap-4 text-sm">
        <a href="/ajustes" class="text-slate-600 hover:text-slate-900">Ajustes</a>
        <form method="POST" action="/logout">
          <button type="submit" class="text-slate-600 hover:text-slate-900">Cerrar sesión</button>
        </form>
      </nav>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-6 py-8">
    <slot />
  </main>
</div>
```

- [ ] **Step 3: Crear `src/routes/dashboard/+page.server.ts` (carga de perfil)**

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('full_name, timezone')
    .eq('id', locals.user!.id)
    .single();

  return {
    profile: profile ?? { full_name: '', timezone: 'Europe/Madrid' }
  };
};
```

- [ ] **Step 4: Crear `src/routes/dashboard/+page.svelte` (hub de intención)**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const name = data.profile.full_name?.trim() || 'qué bueno verte';

  // Las tarjetas con su micro-estado placeholder. Los conteos reales llegan en planes siguientes.
  const cards = [
    { href: '/correo', icon: '📧', title: 'Ordenar mi correo', state: 'Conecta Gmail en una próxima versión', accent: true },
    { href: '/eventos', icon: '📅', title: 'Mis citas', state: 'Sin citas guardadas' },
    { href: '/facturas', icon: '💰', title: 'Mis facturas', state: 'Sin facturas guardadas' },
    { href: '/agregar', icon: '➕', title: 'Añadir algo', state: 'Citas, facturas, recordatorios' }
  ];
</script>

<svelte:head><title>Dashboard — Rutinas</title></svelte:head>

<section class="space-y-2 mb-8">
  <p class="text-slate-600">Hola, {name}.</p>
  <h1 class="text-3xl font-bold">¿Qué quieres hacer hoy?</h1>
</section>

<div class="grid gap-4 sm:grid-cols-2">
  {#each cards as card}
    <a
      href={card.href}
      class="block p-6 rounded-xl border bg-white hover:bg-slate-50 transition
             {card.accent ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}"
    >
      <div class="text-3xl mb-2">{card.icon}</div>
      <h2 class="text-lg font-semibold">{card.title}</h2>
      <p class="text-sm text-slate-600 mt-1">{card.state}</p>
    </a>
  {/each}
</div>
```

- [ ] **Step 5: Verificar end-to-end**

```bash
npm run dev
```

1. Ir a http://localhost:5173/dashboard sin estar logueado → debe redirigir a `/login`.
2. Entrar con la cuenta creada → debe llegar a `/dashboard`, ver el saludo y las 4 tarjetas.
3. Pulsar "Cerrar sesión" → vuelve a `/` y al intentar `/dashboard` redirige a `/login`.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: dashboard hub with auth guard"
```

---

### Task 9: Página de ajustes (perfil)

**Files:**
- Create: `src/routes/ajustes/+page.server.ts`
- Create: `src/routes/ajustes/+page.svelte`

- [ ] **Step 1: Crear `src/routes/ajustes/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('full_name, timezone, locale')
    .eq('id', locals.user.id)
    .single();

  return {
    profile: profile ?? { full_name: '', timezone: 'Europe/Madrid', locale: 'es' }
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');

    const formData = await request.formData();
    const fullName = String(formData.get('full_name') ?? '').trim();
    const timezone = String(formData.get('timezone') ?? '').trim() || 'Europe/Madrid';

    const { error } = await locals.supabase
      .from('profiles')
      .update({ full_name: fullName, timezone })
      .eq('id', locals.user.id);

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true };
  }
};
```

- [ ] **Step 2: Crear `src/routes/ajustes/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;

  // Lista corta de zonas horarias comunes. El usuario puede teclear cualquiera válida.
  const commonTimezones = [
    'Europe/Madrid',
    'Europe/London',
    'America/Argentina/Buenos_Aires',
    'America/Mexico_City',
    'America/Bogota',
    'America/New_York',
    'America/Los_Angeles'
  ];
</script>

<svelte:head><title>Ajustes — Rutinas</title></svelte:head>

<h1 class="text-2xl font-bold mb-6">Ajustes</h1>

<form method="POST" class="space-y-5 max-w-md">
  {#if form?.success}
    <p class="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm">
      Guardado.
    </p>
  {/if}
  {#if form?.error}
    <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">{form.error}</p>
  {/if}

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Nombre</span>
    <input
      type="text"
      name="full_name"
      value={data.profile.full_name ?? ''}
      class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
    />
  </label>

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Zona horaria</span>
    <input
      type="text"
      name="timezone"
      list="timezones"
      value={data.profile.timezone}
      class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
    />
    <datalist id="timezones">
      {#each commonTimezones as tz}
        <option value={tz}></option>
      {/each}
    </datalist>
  </label>

  <button type="submit" class="bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800">
    Guardar
  </button>
</form>
```

- [ ] **Step 3: Verificar**

```bash
npm run dev
```

Ir a `/dashboard` → "Ajustes". Cambiar nombre, guardar. Recargar el dashboard: el saludo debe usar el nuevo nombre.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: settings page for profile"
```

---

### Task 10: Smoke test del flujo completo

No es un test automatizado — es una checklist manual que debes ejecutar antes de dar el plan por cerrado.

- [ ] **Step 1: Arrancar limpio**

```bash
npm run dev
```

- [ ] **Step 2: Recorrido completo**

Marca cada paso a medida que lo verifiques:

- [ ] `/` muestra landing con botones "Crear cuenta" y "Entrar" cuando no hay sesión.
- [ ] `/dashboard` sin sesión redirige a `/login`.
- [ ] `/signup` permite crear una segunda cuenta de prueba (diferente a la del test inicial).
- [ ] Aparece la fila correspondiente en `profiles` (verificar en Supabase Table Editor).
- [ ] `/login` con credenciales correctas redirige a `/dashboard`.
- [ ] `/dashboard` muestra saludo con el nombre (o el fallback) y las 4 tarjetas.
- [ ] `/ajustes` permite cambiar el nombre y se ve reflejado en `/dashboard` al volver.
- [ ] "Cerrar sesión" cierra y al ir a `/dashboard` redirige a `/login`.
- [ ] Crear un segundo usuario, entrar con él, no debe ver datos del primero (esto se valida de verdad en planes siguientes cuando haya datos, pero el aislamiento de `profiles` ya se puede comprobar).

- [ ] **Step 3: Verificar typecheck final**

```bash
npm run check
```

Esperado: `0 errors and 0 warnings`.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: foundation milestone complete" --allow-empty
```

---

## Self-Review (hecho por quien escribió el plan)

- **Spec coverage:** las 6 piezas del MVP que estaban en el spec — auth (T6/T7), tablas + RLS (T4), aislamiento por usuario (T4 RLS + verificación T10), shell del dashboard (T8) y página de ajustes (T9) — están cubiertas en este plan. El triage de correo, parseo NL y resumen diario quedan explícitamente para los planes 2-4. La tabla `oauth_tokens` se crea ya con RLS restrictiva aunque no se use hasta el plan 3.
- **Placeholders:** revisado. No hay TBDs, TODOs ni "implementar más tarde" en pasos. Lo que se deja para planes futuros está marcado como tal en las micro-states del dashboard.
- **Type consistency:** los tipos de `App.Locals` (`supabase`, `safeGetSession`, `session`, `user`) se usan consistentemente en hooks (T5), guards (T8), settings (T9) y logout (T7). Los nombres de columnas (`full_name`, `timezone`) coinciden entre migration (T4), load (T8/T9) y formularios (T9).

---

## Próximos planes

- **Plan 2:** Entrada manual + parseo de lenguaje natural + listas de eventos y facturas.
- **Plan 3:** Triage de Gmail (OAuth + cifrado de tokens + clasificación Claude).
- **Plan 4:** Resumen diario + pulido + despliegue a Cloudflare Pages.
