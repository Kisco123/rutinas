# Rutinas — Plan 4: Resumen diario + despliegue Cloudflare Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dashboard saluda al usuario con un párrafo amigable generado por IA que resume su día (próximas citas, facturas que vencen, etc.), cacheado para no regenerar entre cargas. Tras eso, la app queda desplegada en Cloudflare Pages con URL pública para que el usuario pueda usarla desde cualquier dispositivo.

**Architecture:** Endpoint server-side que consulta eventos/facturas próximos, los envía a Groq (Llama 3.3 70B) para que genere un párrafo cálido en español, y cachea el resultado en `daily_summaries`. El dashboard llama a este endpoint (o usa caché). Deploy con el adaptador Cloudflare de SvelteKit, repo conectado a GitHub para auto-deploy.

**Tech Stack:** Groq SDK ya instalado, Supabase `daily_summaries` ya existe en BD, `@sveltejs/adapter-cloudflare` ya configurado. Spec: [docs/superpowers/specs/2026-06-01-rutinas-design.md](../specs/2026-06-01-rutinas-design.md).

---

## Pre-requisitos manuales

- **Cuenta de GitHub** (gratis, en https://github.com si no tienes)
- **Cuenta de Cloudflare** (gratis, en https://dash.cloudflare.com/sign-up)
- Tener instalada la **GitHub CLI** (`gh --version`) — si no, instalar desde https://cli.github.com. Alternativa: hacer los pasos de GitHub manualmente desde su web.

---

### Task 1: Generador del resumen diario

**Files:**
- Create: `src/lib/server/daily-summary.ts`
- Create: `src/lib/server/daily-summary.test.ts`

Igual que `parse-intent`, hacemos una función pura testeable + una async que llama a Groq.

- [ ] **Step 1: Crear `src/lib/server/daily-summary.ts`**:

```typescript
import type Groq from 'groq-sdk';
import { GROQ_MODELS } from './groq';

export type SummaryContext = {
  fullName: string | null;
  events: Array<{
    title: string;
    starts_at: string;
    location: string | null;
    category: string;
  }>;
  bills: Array<{
    title: string;
    amount: number | null;
    currency: string;
    due_date: string;
    paid: boolean;
  }>;
};

const SYSTEM_PROMPT = `Eres un asistente cálido y conciso que escribe el resumen del día para un usuario en español.

Recibes en JSON:
- nombre del usuario (puede ser null)
- lista de eventos próximos (próximos 7 días) con título, fecha/hora ISO, lugar, categoría
- lista de facturas próximas a vencer (próximos 14 días) con título, importe, fecha, si están pagadas

Escribes UN PÁRRAFO CORTO (máximo 3 frases) que:
- Salude por su nombre si lo tiene, o use un saludo general si no
- Mencione lo más relevante de hoy y los próximos días
- Si hay facturas urgentes, las prioriza
- Tono cálido pero claro, sin emojis innecesarios, sin frases vacías como "espero que tengas un buen día"
- NUNCA inventes citas o facturas que no estén en los datos
- Si no hay nada relevante (listas vacías), di algo breve tipo "Hoy no tienes nada agendado. Buen momento para descansar o añadir lo que tengas pendiente."

Devuelves SOLO el párrafo. Sin markdown, sin comillas, sin prefijos.`;

export function buildUserPrompt(ctx: SummaryContext, todayIso: string): string {
  return `Hoy es ${todayIso}.\n\nDatos del usuario:\n${JSON.stringify(ctx, null, 2)}`;
}

export async function generateDailySummary(
  client: Groq,
  ctx: SummaryContext,
  todayIso: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: GROQ_MODELS.llama,
    temperature: 0.5,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx, todayIso) }
    ]
  });

  return (completion.choices[0]?.message?.content ?? '').trim();
}

/**
 * Devuelve un resumen de emergencia sin llamar a IA — usado si la llamada
 * a Groq falla o devuelve vacío. Sin él, el dashboard se rompería.
 */
export function fallbackSummary(ctx: SummaryContext): string {
  const greeting = ctx.fullName?.trim()
    ? `Hola, ${ctx.fullName.trim()}.`
    : 'Hola.';

  const eventCount = ctx.events.length;
  const billCount = ctx.bills.filter((b) => !b.paid).length;

  if (eventCount === 0 && billCount === 0) {
    return `${greeting} Hoy no tienes nada agendado. Buen momento para añadir lo que tengas pendiente.`;
  }

  const parts: string[] = [];
  if (eventCount > 0) parts.push(`${eventCount} cita${eventCount === 1 ? '' : 's'} próxima${eventCount === 1 ? '' : 's'}`);
  if (billCount > 0) parts.push(`${billCount} factura${billCount === 1 ? '' : 's'} por pagar`);

  return `${greeting} Tienes ${parts.join(' y ')}.`;
}
```

- [ ] **Step 2: Crear `src/lib/server/daily-summary.test.ts`**:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUserPrompt, fallbackSummary } from './daily-summary';

describe('buildUserPrompt', () => {
  it('incluye la fecha de hoy y los datos en JSON', () => {
    const prompt = buildUserPrompt(
      { fullName: 'Pablo', events: [], bills: [] },
      '2026-06-04'
    );
    expect(prompt).toContain('2026-06-04');
    expect(prompt).toContain('"fullName": "Pablo"');
  });
});

describe('fallbackSummary', () => {
  it('saluda por nombre si existe', () => {
    const result = fallbackSummary({ fullName: 'Pablo', events: [], bills: [] });
    expect(result).toMatch(/^Hola, Pablo\./);
  });

  it('usa saludo genérico sin nombre', () => {
    const result = fallbackSummary({ fullName: null, events: [], bills: [] });
    expect(result).toMatch(/^Hola\./);
  });

  it('dice que no hay nada cuando listas están vacías', () => {
    const result = fallbackSummary({ fullName: null, events: [], bills: [] });
    expect(result).toContain('nada agendado');
  });

  it('cuenta citas y facturas pendientes', () => {
    const result = fallbackSummary({
      fullName: 'Ana',
      events: [
        { title: 'A', starts_at: '2026-06-05T10:00:00Z', location: null, category: 'otro' },
        { title: 'B', starts_at: '2026-06-06T10:00:00Z', location: null, category: 'otro' }
      ],
      bills: [
        { title: 'Luz', amount: 50, currency: 'EUR', due_date: '2026-06-10', paid: false },
        { title: 'Agua', amount: 20, currency: 'EUR', due_date: '2026-06-15', paid: true }
      ]
    });
    expect(result).toContain('2 citas próximas');
    expect(result).toContain('1 factura por pagar');
  });

  it('omite facturas pagadas del conteo', () => {
    const result = fallbackSummary({
      fullName: null,
      events: [],
      bills: [
        { title: 'X', amount: 10, currency: 'EUR', due_date: '2026-06-10', paid: true }
      ]
    });
    expect(result).toContain('nada agendado');
  });
});
```

- [ ] **Step 3: Correr tests**
```
npm test
```
Esperado: **11 passing** (6 de parse-intent + 5 de daily-summary).

- [ ] **Step 4: Commit**
```
git add src/lib/server/daily-summary.ts src/lib/server/daily-summary.test.ts
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: daily summary generator with fallback"
```

---

### Task 2: Endpoint del resumen con caché

**Files:**
- Create: `src/routes/api/daily-summary/+server.ts`

- [ ] **Step 1: Crear `src/routes/api/daily-summary/+server.ts`**:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGroqClient } from '$lib/server/groq';
import { generateDailySummary, fallbackSummary, type SummaryContext } from '$lib/server/daily-summary';

const CACHE_FRESH_MINUTES = 240; // 4 horas

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const userId = locals.user.id;
  const todayIso = new Date().toISOString().slice(0, 10);

  // 1) Comprobar caché
  const { data: cached } = await locals.supabase
    .from('daily_summaries')
    .select('content, generated_at')
    .eq('user_id', userId)
    .eq('date', todayIso)
    .maybeSingle();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.generated_at).getTime();
    if (ageMs < CACHE_FRESH_MINUTES * 60 * 1000) {
      return json({ content: cached.content, cached: true });
    }
  }

  // 2) Recopilar contexto
  const nowIso = new Date().toISOString();
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, eventsRes, billsRes] = await Promise.all([
    locals.supabase.from('profiles').select('full_name').eq('id', userId).single(),
    locals.supabase
      .from('events')
      .select('title, starts_at, location, category')
      .eq('user_id', userId)
      .gte('starts_at', nowIso)
      .lte('starts_at', in7Days)
      .order('starts_at', { ascending: true })
      .limit(20),
    locals.supabase
      .from('bills')
      .select('title, amount, currency, due_date, paid')
      .eq('user_id', userId)
      .gte('due_date', todayIso)
      .lte('due_date', in14Days)
      .order('due_date', { ascending: true })
      .limit(20)
  ]);

  const ctx: SummaryContext = {
    fullName: profileRes.data?.full_name ?? null,
    events: eventsRes.data ?? [],
    bills: billsRes.data ?? []
  };

  // 3) Llamar a Groq; si falla, fallback determinista
  let content: string;
  try {
    content = await generateDailySummary(getGroqClient(), ctx, todayIso);
    if (!content || content.length < 5) content = fallbackSummary(ctx);
  } catch (err) {
    console.error('daily-summary generation failed:', err);
    content = fallbackSummary(ctx);
  }

  // 4) Guardar caché (upsert)
  await locals.supabase
    .from('daily_summaries')
    .upsert(
      { user_id: userId, date: todayIso, content, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  return json({ content, cached: false });
};
```

- [ ] **Step 2: Verify**
```
npm run check
```

- [ ] **Step 3: Commit**
```
git add src/routes/api/daily-summary/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: daily-summary endpoint with cache and fallback"
```

---

### Task 3: Mostrar el resumen en el dashboard

**Files:**
- Modify: `src/routes/dashboard/+page.server.ts`
- Modify: `src/routes/dashboard/+page.svelte`

Aprovechamos el load del dashboard para llamar al endpoint internamente (vía `fetch`) y pasar el resumen ya generado al cliente. Así el usuario abre el dashboard y el saludo aparece de una.

- [ ] **Step 1: Reemplazar `src/routes/dashboard/+page.server.ts`**:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
  const userId = locals.user!.id;
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, eventsRes, billsRes, nextEventRes, summaryRes] = await Promise.all([
    locals.supabase.from('profiles').select('full_name, timezone').eq('id', userId).single(),
    locals.supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('starts_at', nowIso),
    locals.supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('paid', false)
      .gte('due_date', todayDate)
      .lte('due_date', in7Days),
    locals.supabase
      .from('events')
      .select('title, starts_at')
      .eq('user_id', userId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    fetch('/api/daily-summary')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  ]);

  return {
    profile: profileRes.data ?? { full_name: '', timezone: 'Europe/Madrid' },
    upcomingEventsCount: eventsRes.count ?? 0,
    upcomingBillsCount: billsRes.count ?? 0,
    nextEvent: nextEventRes.data,
    summary: summaryRes?.content ?? null
  };
};
```

- [ ] **Step 2: Reemplazar `src/routes/dashboard/+page.svelte`** para mostrar el resumen arriba:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  const name = $derived(data.profile.full_name?.trim() || 'qué bueno verte');

  function formatNext(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  const cards = $derived([
    {
      href: '/correo',
      icon: '📧',
      title: 'Ordenar mi correo',
      state: 'Conecta Gmail en una próxima versión',
      accent: true
    },
    {
      href: '/dashboard/eventos',
      icon: '📅',
      title: 'Mis citas',
      state: data.upcomingEventsCount === 0
        ? 'Sin citas próximas'
        : data.nextEvent
          ? `${data.upcomingEventsCount} próximas · siguiente: ${formatNext(data.nextEvent.starts_at)}`
          : `${data.upcomingEventsCount} próximas`
    },
    {
      href: '/dashboard/facturas',
      icon: '💰',
      title: 'Mis facturas',
      state: data.upcomingBillsCount === 0
        ? 'Sin facturas próximas'
        : `${data.upcomingBillsCount} vence${data.upcomingBillsCount === 1 ? '' : 'n'} esta semana`
    },
    {
      href: '/dashboard/agregar',
      icon: '➕',
      title: 'Añadir algo',
      state: 'Citas, facturas, recordatorios'
    }
  ]);
</script>

<svelte:head><title>Dashboard — Rutinas</title></svelte:head>

<section class="space-y-2 mb-8">
  <p class="text-slate-600">Hola, {name}.</p>
  <h1 class="text-3xl font-bold">¿Qué quieres hacer hoy?</h1>
</section>

{#if data.summary}
  <div class="mb-8 p-5 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-200">
    <div class="flex items-start gap-3">
      <span class="text-2xl">☀️</span>
      <p class="text-slate-800 leading-relaxed">{data.summary}</p>
    </div>
  </div>
{/if}

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

- [ ] **Step 3: Smoke test manual**

Arranca dev. Entra a `/dashboard`. Debe aparecer una tarjeta dorada arriba con el párrafo del resumen. Recarga la página varias veces — la segunda carga es instantánea (caché). Borra una factura, recarga — el resumen no cambia (sigue cacheado). Espera 4 horas O borra manualmente la fila de `daily_summaries` en Supabase para forzar regeneración.

- [ ] **Step 4: Commit**
```
git add src/routes/dashboard/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: show daily summary on dashboard"
```

---

### Task 4: Preparar para Cloudflare Pages

**Files:**
- Create: `wrangler.toml`
- Modify: `package.json` (scripts si hace falta)
- Modify: `svelte.config.js` (revisar adapter)
- Create: `.dev.vars` (para `wrangler pages dev` local — opcional)

Cloudflare Pages necesita saber qué carpeta servir y a veces un `wrangler.toml` con metadata.

- [ ] **Step 1: Crear `wrangler.toml`** en la raíz:

```toml
name = "rutinas"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"
```

> `nodejs_compat` es necesario porque `groq-sdk`, `@supabase/supabase-js` y `@supabase/ssr` usan APIs de Node (Buffer, streams, etc.).

- [ ] **Step 2: Verificar que `npm run build` produce la salida en `.svelte-kit/cloudflare/`**:

```
npm run build
```

Esperado: `.svelte-kit/cloudflare/_worker.js/index.js` (entre otros). Si la carpeta de salida es diferente (puede ser `.svelte-kit/output` o `build/`), ajusta `pages_build_output_dir` en `wrangler.toml` para que coincida.

- [ ] **Step 3: Verificar `.gitignore`** tiene:
```
.svelte-kit
build
.env
.dev.vars
```

Si falta alguno (especialmente `.dev.vars`), añadirlo.

- [ ] **Step 4: Commit**
```
git add wrangler.toml .gitignore
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "chore: cloudflare pages wrangler config"
```

---

### Task 5: Subir el repo a GitHub

**Pre-requisitos:** cuenta de GitHub. `gh` CLI instalada O paciencia para hacerlo por la web.

- [ ] **Step 1 (con `gh` CLI):**

```
gh auth login
```
Sigue el prompt (elige GitHub.com, HTTPS, login con navegador).

Luego:
```
gh repo create rutinas --private --source=. --remote=origin --push
```

Esto crea el repo `rutinas` en tu cuenta como privado, lo conecta como remote `origin` y hace push de todo lo que tienes localmente.

- [ ] **Step 1 (alternativa sin `gh`):**

1. Ve a https://github.com/new
2. Repo name: `rutinas`, marca **Private**, **NO** marques "Add a README", "Add .gitignore" ni licencia (ya tenemos todo)
3. Crea el repo
4. Te dará instrucciones. Ejecuta las del bloque "...or push an existing repository":
```
git remote add origin https://github.com/TU_USUARIO/rutinas.git
git branch -M main
git push -u origin main
```
(Si tu rama actual se llama `master`, el `git branch -M main` la renombra a `main`.)

- [ ] **Step 2: Verificar**

```
git remote -v
git log origin/main --oneline -3
```

Esperado: ves el remote `origin` y los últimos commits con el hash.

---

### Task 6: Conectar Cloudflare Pages al repo

Esto es 100% manual en el dashboard de Cloudflare. Sigue estos pasos exactos.

- [ ] **Step 1: Ir al dashboard de Cloudflare**

https://dash.cloudflare.com → en el menú lateral izquierdo, **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.

- [ ] **Step 2: Autorizar GitHub**

Pulsa **Connect GitHub**. Te llevará a GitHub para autorizar la app de Cloudflare. Puedes darle acceso solo al repo `rutinas` (recomendado) o a todos. **Save**.

- [ ] **Step 3: Seleccionar el repo y configurar el build**

Selecciona el repo `rutinas` → **Begin setup**. Configura:

- **Project name:** `rutinas` (será parte de tu URL: `rutinas.pages.dev`)
- **Production branch:** `main`
- **Framework preset:** **SvelteKit**
- **Build command:** `npm run build` (debe rellenarse solo con el preset)
- **Build output directory:** `.svelte-kit/cloudflare`
- **Root directory:** dejar vacío
- **Node version:** en variables de entorno de **build**, añadir `NODE_VERSION=20`

- [ ] **Step 4: Añadir variables de entorno de runtime (importantísimo)**

En la sección **Environment variables** → **Production** → añadir una por una:

```
PUBLIC_SUPABASE_URL              = https://hubhrzqgbczwdauuhkfk.supabase.co
PUBLIC_SUPABASE_ANON_KEY         = sb_publishable_fZvPw2vPGK7wf8Vk_XKq3A_TD5WBrvK
SUPABASE_SERVICE_ROLE_KEY        = (el sb_secret_... — márcalo como Encrypted)
GROQ_API_KEY                     = (el gsk_... — Encrypted)
ANTHROPIC_API_KEY                = placeholder
GEMINI_API_KEY                   = placeholder
GOOGLE_CLIENT_ID                 = placeholder
GOOGLE_CLIENT_SECRET             = placeholder
OAUTH_TOKEN_ENCRYPTION_KEY       = (el de tu .env local — Encrypted)
```

> Marca como **Encrypted** las que contengan secretos (service_role, groq, encryption key). Las `PUBLIC_*` y `placeholder` pueden ir en plain text.

- [ ] **Step 5: Build & Deploy**

Pulsa **Save and Deploy**. Cloudflare clonará el repo y ejecutará `npm run build`. Tarda ~2-4 min la primera vez.

Si el build falla: lee el log. Errores típicos:
- Falta `NODE_VERSION` → añadir variable de build
- Adapter mismatch → verificar `svelte.config.js` usa `@sveltejs/adapter-cloudflare`
- Variables de entorno no encontradas → revisar Task 6 Step 4

- [ ] **Step 6: Apuntar el callback de Supabase Auth a la nueva URL**

En cuanto el deploy esté listo, tendrás una URL `https://rutinas.pages.dev` (o similar). Vamos a actualizar Supabase para que los emails de confirmación lleven a esa URL en lugar de a `localhost`.

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL:** poner `https://rutinas.pages.dev`
3. **Redirect URLs:** añadir tanto `https://rutinas.pages.dev/login` como `http://localhost:5173/login` (así sigues pudiendo desarrollar localmente sin romper la confirmación)
4. **Save**

---

### Task 7: Smoke test en producción

- [ ] **Step 1: Abrir la URL pública**

`https://rutinas.pages.dev` (o la que te dé Cloudflare). Debe cargar la landing.

- [ ] **Step 2: Registrar una cuenta nueva desde el móvil**

Abre la URL desde tu teléfono. Crea una cuenta nueva, confirma el email. El link de confirmación ahora debe llevar a `pages.dev`, no a `localhost`.

- [ ] **Step 3: Verificar el flujo completo**

- [ ] Login funciona
- [ ] Dashboard carga con el resumen amigable de IA
- [ ] `/dashboard/agregar` tab Escribir funciona (parsea con Groq)
- [ ] `/dashboard/eventos` y `/dashboard/facturas` muestran los datos
- [ ] Cerrar sesión → no se puede entrar a `/dashboard` sin auth

- [ ] **Step 4: Smoke test cross-dispositivo**

Inicia sesión desde móvil. Añade una cita. Comprueba en el ordenador que aparece. Cierra sesión en ambos dispositivos.

- [ ] **Step 5: Verificar redeploys automáticos**

Hacer un cambio menor en el repo, commit + push a `main`. En 2-3 min, Cloudflare detecta y redeplea. Verifica en el dashboard de Cloudflare Pages que aparece el nuevo deployment.

```
echo "" >> README.md
git add README.md
git commit -m "test: trigger auto-deploy"
git push
```

Verifica en Cloudflare → Pages → rutinas → Deployments que aparece un nuevo deploy.

---

## Self-Review

- **Spec coverage:** este plan implementa el Flujo C del spec (resumen diario con caché y fallback), y la pieza final del MVP: deploy. Se omite explícitamente el envío del resumen por email (estaba fuera de v1).
- **Modelo IA usado:** el spec original menciona Claude Sonnet 4.6 para el resumen; usamos Llama 3.3 70B (Groq) en su lugar por la decisión de coste cero. La calidad para 3 frases en español es suficiente.
- **Placeholders:** ninguno detectado. Todos los valores reales del usuario (URLs, project number) están explícitos.
- **Type consistency:** `SummaryContext` matcheo con lo que devuelven las consultas a Supabase en el endpoint (Task 2). `daily_summaries` upsert respeta el `unique (user_id, date)` que ya existe en BD desde Plan 1.

---

## ¡Hemos terminado el MVP!

Tras este plan tienes:

- App SvelteKit con auth multi-usuario, RLS estricto, hub de intención
- Entrada en lenguaje natural y formularios manuales para citas y facturas
- Listas con filtros, marcar pagada, eliminar
- Resumen diario amigable con IA (Llama 3.3 70B vía Groq, gratis)
- Deploy automático en Cloudflare Pages con dominio público accesible desde cualquier dispositivo
- Auto-deploy en cada push a `main`

Lo único que queda fuera del MVP original es el **Plan 3 (triage de Gmail)** — la "feature estrella" del spec. Lo dejamos voluntariamente para después porque implica configurar OAuth en Google Cloud Console, que es burocrático. Cuando quieras meterte, ahí está el spec esperando.
