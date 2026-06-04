# Rutinas — Plan 2: Entrada manual + parseo lenguaje natural + listas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el usuario añada eventos y facturas — a mano o en lenguaje natural ("médico martes 10am clínica San José") — y los vea en listas filtrables. Al terminar este plan, el dashboard muestra conteos reales y el usuario puede gestionar sus citas y facturas.

**Architecture:** Endpoint `+server.ts` que llama a Claude Haiku con un prompt estructurado para parsear texto natural → JSON con tipo y campos. La UI muestra un *preview* del parseo antes de guardar para que el usuario confirme. Formularios manuales como fallback. Listas con consultas Supabase directas (RLS hace el aislamiento).

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Claude Haiku 4.5 con prompt caching, SvelteKit form actions. Spec: [docs/superpowers/specs/2026-06-01-rutinas-design.md](../specs/2026-06-01-rutinas-design.md).

---

## Pre-requisitos manuales

1. **Crear cuenta y API key en Anthropic** en https://console.anthropic.com → Settings → API Keys → Create Key. Cargar al menos $5 de créditos.
2. **Pegar la key** en `C:\Web rutinas\.env` reemplazando `ANTHROPIC_API_KEY=placeholder` por `ANTHROPIC_API_KEY=sk-ant-...`.

---

### Task 1: Instalar SDK de Anthropic y ampliar el helper de env

**Files:**
- Modify: `package.json` (vía npm install)
- Modify: `src/lib/server/env.ts`

- [ ] **Step 1: Instalar el SDK**

```
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Modificar `src/lib/server/env.ts`** para exportar también la key de Anthropic:

```typescript
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import {
  SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY
} from '$env/static/private';

export const env = {
  supabaseUrl: PUBLIC_SUPABASE_URL,
  supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY
};
```

- [ ] **Step 3: Verificar typecheck**

```
npm run check
```

Esperado: 0 errors.

- [ ] **Step 4: Commit**

```
git add package.json package-lock.json src/lib/server/env.ts
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "chore: install anthropic sdk and expose env"
```

---

### Task 2: Wrapper del cliente Anthropic con prompt caching

**Files:**
- Create: `src/lib/server/anthropic.ts`

- [ ] **Step 1: Crear `src/lib/server/anthropic.ts`**:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/**
 * Cliente singleton de Anthropic. Reusa la conexión entre llamadas.
 * Usado solo en endpoints +server.ts (servidor); nunca expuesto al navegador.
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

// IDs de modelo centralizados para poder cambiarlos en un solo sitio
export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6'
} as const;
```

- [ ] **Step 2: Verificar typecheck**

```
npm run check
```

- [ ] **Step 3: Commit**

```
git add src/lib/server/anthropic.ts
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: anthropic client wrapper"
```

---

### Task 3: Endpoint de parseo de intent (POST /api/parse-intent)

**Files:**
- Create: `src/lib/server/parse-intent.ts` (función pura, testeable)
- Create: `src/routes/api/parse-intent/+server.ts` (endpoint que la usa)

Esta task **sí lleva test unitario** porque hay lógica de parseo que merece verificación. El test usa una respuesta fake de Claude para no gastar tokens.

- [ ] **Step 1: Instalar Vitest** (no estaba en el scaffold inicial)

```
npm install -D vitest
```

- [ ] **Step 2: Añadir script de tests al `package.json`** — edita la sección `"scripts"` y añade:

```json
"test": "vitest run",
"test:watch": "vitest"
```

(Mantén los scripts existentes; añade solo estas dos líneas dentro de `scripts`.)

- [ ] **Step 3: Crear `src/lib/server/parse-intent.ts`** con la firma y validación:

```typescript
import type Anthropic from '@anthropic-ai/sdk';
import { MODELS } from './anthropic';

export type ParsedEvent = {
  type: 'event';
  fields: {
    title: string;
    starts_at: string; // ISO 8601
    ends_at: string | null;
    location: string | null;
    category: 'medico' | 'familia' | 'trabajo' | 'personal' | 'otro';
    description: string | null;
  };
  confidence: number;
};

export type ParsedBill = {
  type: 'bill';
  fields: {
    title: string;
    amount: number | null;
    currency: string;
    due_date: string; // YYYY-MM-DD
    provider: string | null;
    recurrence: 'none' | 'monthly' | 'yearly';
    notes: string | null;
  };
  confidence: number;
};

export type ParsedUnknown = {
  type: 'unknown';
  confidence: number;
  reason: string;
};

export type ParseResult = ParsedEvent | ParsedBill | ParsedUnknown;

const SYSTEM_PROMPT = `Eres un asistente que extrae estructura de frases en español sobre citas y facturas.

Recibes:
- Una frase del usuario.
- La fecha y hora actuales en su zona horaria (ISO 8601).
- La zona horaria del usuario (IANA).

Decides si la frase describe:
- Un EVENTO (cita, recordatorio con fecha, cumpleaños): type "event"
- Una FACTURA o pago (algo con importe y fecha de vencimiento): type "bill"
- Si no es claramente ni una cosa ni la otra: type "unknown"

Devuelves SOLO un JSON válido (sin texto antes ni después) con esta forma:

Para event:
{"type":"event","fields":{"title":"...","starts_at":"ISO8601 con offset","ends_at":null,"location":null,"category":"medico|familia|trabajo|personal|otro","description":null},"confidence":0.0-1.0}

Para bill:
{"type":"bill","fields":{"title":"...","amount":number|null,"currency":"EUR","due_date":"YYYY-MM-DD","provider":null,"recurrence":"none|monthly|yearly","notes":null},"confidence":0.0-1.0}

Para unknown:
{"type":"unknown","confidence":0.0-1.0,"reason":"texto breve explicando qué falta"}

Reglas:
- Si dice "martes" sin más, asume el PRÓXIMO martes a partir de la fecha actual.
- Si no hay hora explícita en un evento, usa 09:00 local.
- Si no hay año en una factura, asume el año actual o el siguiente si la fecha ya pasó.
- Las fechas deben ir con offset de la zona horaria del usuario.
- "Médico", "doctor", "dentista", "clínica" → category "medico".
- "Mamá", "papá", "hermana", "abuelo" → category "familia".
- Si dudas, confidence < 0.6.`;

export async function parseIntent(
  client: Anthropic,
  text: string,
  nowIso: string,
  timezone: string
): Promise<ParseResult> {
  const response = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 500,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Fecha y hora actuales: ${nowIso}\nZona horaria: ${timezone}\n\nFrase del usuario: ${text}`
      }
    ]
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    return { type: 'unknown', confidence: 0, reason: 'Respuesta vacía del modelo.' };
  }

  return validateParseResult(block.text);
}

/**
 * Valida y parsea la salida JSON del modelo. Exportada para testing.
 */
export function validateParseResult(raw: string): ParseResult {
  let parsed: unknown;
  try {
    // El modelo a veces envuelve el JSON en bloques de código markdown
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { type: 'unknown', confidence: 0, reason: 'JSON inválido del modelo.' };
  }

  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    return { type: 'unknown', confidence: 0, reason: 'Estructura inválida.' };
  }

  const obj = parsed as Record<string, unknown>;
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0;

  if (obj.type === 'event' && obj.fields && typeof obj.fields === 'object') {
    const f = obj.fields as Record<string, unknown>;
    if (typeof f.title !== 'string' || typeof f.starts_at !== 'string') {
      return { type: 'unknown', confidence: 0, reason: 'Campos de evento incompletos.' };
    }
    return {
      type: 'event',
      fields: {
        title: f.title,
        starts_at: f.starts_at,
        ends_at: typeof f.ends_at === 'string' ? f.ends_at : null,
        location: typeof f.location === 'string' ? f.location : null,
        category: ['medico', 'familia', 'trabajo', 'personal', 'otro'].includes(f.category as string)
          ? (f.category as ParsedEvent['fields']['category'])
          : 'otro',
        description: typeof f.description === 'string' ? f.description : null
      },
      confidence
    };
  }

  if (obj.type === 'bill' && obj.fields && typeof obj.fields === 'object') {
    const f = obj.fields as Record<string, unknown>;
    if (typeof f.title !== 'string' || typeof f.due_date !== 'string') {
      return { type: 'unknown', confidence: 0, reason: 'Campos de factura incompletos.' };
    }
    return {
      type: 'bill',
      fields: {
        title: f.title,
        amount: typeof f.amount === 'number' ? f.amount : null,
        currency: typeof f.currency === 'string' ? f.currency : 'EUR',
        due_date: f.due_date,
        provider: typeof f.provider === 'string' ? f.provider : null,
        recurrence: ['none', 'monthly', 'yearly'].includes(f.recurrence as string)
          ? (f.recurrence as ParsedBill['fields']['recurrence'])
          : 'none',
        notes: typeof f.notes === 'string' ? f.notes : null
      },
      confidence
    };
  }

  return {
    type: 'unknown',
    confidence,
    reason: typeof obj.reason === 'string' ? obj.reason : 'Tipo no reconocido.'
  };
}
```

- [ ] **Step 4: Crear test `src/lib/server/parse-intent.test.ts`**:

```typescript
import { describe, it, expect } from 'vitest';
import { validateParseResult } from './parse-intent';

describe('validateParseResult', () => {
  it('parsea un evento válido', () => {
    const raw = JSON.stringify({
      type: 'event',
      fields: {
        title: 'Dentista',
        starts_at: '2026-06-10T10:00:00+02:00',
        ends_at: null,
        location: 'Clínica X',
        category: 'medico',
        description: null
      },
      confidence: 0.9
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('event');
    if (result.type === 'event') {
      expect(result.fields.title).toBe('Dentista');
      expect(result.fields.category).toBe('medico');
      expect(result.confidence).toBe(0.9);
    }
  });

  it('parsea una factura válida', () => {
    const raw = JSON.stringify({
      type: 'bill',
      fields: {
        title: 'Factura luz',
        amount: 80,
        currency: 'EUR',
        due_date: '2026-06-15',
        provider: 'Iberdrola',
        recurrence: 'monthly',
        notes: null
      },
      confidence: 0.85
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('bill');
    if (result.type === 'bill') {
      expect(result.fields.amount).toBe(80);
      expect(result.fields.recurrence).toBe('monthly');
    }
  });

  it('quita fences de markdown', () => {
    const raw = '```json\n{"type":"unknown","confidence":0.3,"reason":"vago"}\n```';
    const result = validateParseResult(raw);
    expect(result.type).toBe('unknown');
  });

  it('devuelve unknown ante JSON inválido', () => {
    const result = validateParseResult('no soy json');
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('devuelve unknown si faltan campos obligatorios del evento', () => {
    const raw = JSON.stringify({ type: 'event', fields: { title: 'X' }, confidence: 0.5 });
    const result = validateParseResult(raw);
    expect(result.type).toBe('unknown');
  });

  it('cae a categoria "otro" si la categoría es desconocida', () => {
    const raw = JSON.stringify({
      type: 'event',
      fields: {
        title: 'Evento',
        starts_at: '2026-06-10T10:00:00+02:00',
        ends_at: null,
        location: null,
        category: 'inventada',
        description: null
      },
      confidence: 0.8
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('event');
    if (result.type === 'event') {
      expect(result.fields.category).toBe('otro');
    }
  });
});
```

- [ ] **Step 5: Correr los tests — deben fallar primero (TDD)**

Espera — los tests están escritos contra `validateParseResult` que YA hicimos. En lugar de fallar, deben pasar al primer intento. Eso confirma que el código está bien estructurado.

```
npm test
```

Esperado: **6 passed**.

Si fallan: lee el error, ajusta `validateParseResult` para que pase. NO ajustes los tests para que pasen — el test refleja el contrato deseado.

- [ ] **Step 6: Crear el endpoint `src/routes/api/parse-intent/+server.ts`**:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAnthropicClient } from '$lib/server/anthropic';
import { parseIntent } from '$lib/server/parse-intent';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    throw error(400, 'Falta el campo "text"');
  }

  // Obtener la zona horaria del perfil del usuario
  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('timezone')
    .eq('id', locals.user.id)
    .single();

  const timezone = profile?.timezone ?? 'Europe/Madrid';
  const nowIso = new Date().toISOString();

  const result = await parseIntent(getAnthropicClient(), body.text, nowIso, timezone);

  return json(result);
};
```

- [ ] **Step 7: Verify**

```
npm run check
npm test
```

Ambos limpios.

- [ ] **Step 8: Commit**

```
git add src/lib/server/parse-intent.ts src/lib/server/parse-intent.test.ts src/routes/api/parse-intent/+server.ts package.json package-lock.json
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: parse-intent endpoint with claude haiku"
```

---

### Task 4: Endpoint de confirmación para insertar evento o factura

Cuando el usuario confirma el preview, llamamos a otro endpoint que hace el INSERT con RLS.

**Files:**
- Create: `src/routes/api/confirm-intent/+server.ts`

- [ ] **Step 1: Crear `src/routes/api/confirm-intent/+server.ts`**:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw error(400, 'Body inválido');

  if (body.type === 'event') {
    const f = body.fields;
    if (!f?.title || !f?.starts_at) throw error(400, 'Faltan campos del evento');

    const { error: dbError } = await locals.supabase.from('events').insert({
      user_id: locals.user.id,
      title: f.title,
      description: f.description ?? null,
      starts_at: f.starts_at,
      ends_at: f.ends_at ?? null,
      location: f.location ?? null,
      category: f.category ?? 'otro',
      source: 'ai_text'
    });
    if (dbError) throw error(500, dbError.message);
    return json({ ok: true, kind: 'event' });
  }

  if (body.type === 'bill') {
    const f = body.fields;
    if (!f?.title || !f?.due_date) throw error(400, 'Faltan campos de la factura');

    const { error: dbError } = await locals.supabase.from('bills').insert({
      user_id: locals.user.id,
      title: f.title,
      amount: f.amount ?? null,
      currency: f.currency ?? 'EUR',
      due_date: f.due_date,
      provider: f.provider ?? null,
      recurrence: f.recurrence ?? 'none',
      notes: f.notes ?? null,
      source: 'ai_text'
    });
    if (dbError) throw error(500, dbError.message);
    return json({ ok: true, kind: 'bill' });
  }

  throw error(400, 'Tipo no soportado');
};
```

- [ ] **Step 2: Commit**

```
git add src/routes/api/confirm-intent/+server.ts
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: confirm-intent endpoint to insert parsed results"
```

---

### Task 5: Página `/dashboard/agregar` con input de lenguaje natural

**Files:**
- Create: `src/routes/dashboard/agregar/+page.svelte`
- Create: `src/routes/dashboard/agregar/+page.server.ts`

Usamos la ruta dentro de `/dashboard/` para que herede el header con navegación, igual que hicimos con `/dashboard/ajustes`.

- [ ] **Step 1: Crear `src/routes/dashboard/agregar/+page.server.ts`** (placeholder con redirect guard):

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');
  return {};
};
```

- [ ] **Step 2: Crear `src/routes/dashboard/agregar/+page.svelte`** (runes, con NL input y preview):

```svelte
<script lang="ts">
  let text = $state('');
  let loading = $state(false);
  let parseResult: any = $state(null);
  let errorMsg = $state('');
  let successMsg = $state('');

  async function handleParse(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    loading = true;
    errorMsg = '';
    successMsg = '';
    parseResult = null;

    try {
      const res = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      });
      if (!res.ok) {
        errorMsg = `Error ${res.status}: ${await res.text()}`;
        return;
      }
      const data = await res.json();
      if (data.type === 'unknown' || data.confidence < 0.6) {
        errorMsg = `No lo tengo claro: ${data.reason ?? 'sé más específico (incluye fecha o importe)'}`;
        return;
      }
      parseResult = data;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!parseResult || loading) return;
    loading = true;
    try {
      const res = await fetch('/api/confirm-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult)
      });
      if (!res.ok) {
        errorMsg = `Error ${res.status}: ${await res.text()}`;
        return;
      }
      const data = await res.json();
      successMsg = data.kind === 'event' ? 'Cita guardada.' : 'Factura guardada.';
      text = '';
      parseResult = null;
    } finally {
      loading = false;
    }
  }

  function handleCancel() {
    parseResult = null;
  }

  // Formatea una fecha ISO en un texto legible
  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }
</script>

<svelte:head><title>Añadir — Rutinas</title></svelte:head>

<h1 class="text-2xl font-bold mb-2">Añadir algo</h1>
<p class="text-slate-600 mb-6">Escríbelo como te salga. Ejemplo: <em>"médico martes 10am clínica San José"</em>.</p>

{#if successMsg}
  <p class="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm mb-4">{successMsg}</p>
{/if}
{#if errorMsg}
  <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm mb-4">{errorMsg}</p>
{/if}

{#if !parseResult}
  <form onsubmit={handleParse} class="space-y-4">
    <textarea
      bind:value={text}
      placeholder="Cuéntame qué quieres recordar…"
      rows="3"
      class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-slate-900 focus:outline-none resize-none"
    ></textarea>
    <button
      type="submit"
      disabled={loading || !text.trim()}
      class="bg-slate-900 text-white px-6 py-2.5 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Pensando…' : 'Añadir'}
    </button>
  </form>
{:else}
  <div class="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
    <h2 class="text-lg font-semibold">¿Es esto correcto?</h2>

    {#if parseResult.type === 'event'}
      <dl class="space-y-2 text-sm">
        <div><dt class="font-medium text-slate-500 inline">Tipo:</dt> <dd class="inline">Cita / evento</dd></div>
        <div><dt class="font-medium text-slate-500 inline">Título:</dt> <dd class="inline">{parseResult.fields.title}</dd></div>
        <div><dt class="font-medium text-slate-500 inline">Cuándo:</dt> <dd class="inline">{formatDate(parseResult.fields.starts_at)}</dd></div>
        {#if parseResult.fields.location}
          <div><dt class="font-medium text-slate-500 inline">Dónde:</dt> <dd class="inline">{parseResult.fields.location}</dd></div>
        {/if}
        <div><dt class="font-medium text-slate-500 inline">Categoría:</dt> <dd class="inline">{parseResult.fields.category}</dd></div>
      </dl>
    {:else if parseResult.type === 'bill'}
      <dl class="space-y-2 text-sm">
        <div><dt class="font-medium text-slate-500 inline">Tipo:</dt> <dd class="inline">Factura / pago</dd></div>
        <div><dt class="font-medium text-slate-500 inline">Concepto:</dt> <dd class="inline">{parseResult.fields.title}</dd></div>
        {#if parseResult.fields.amount !== null}
          <div><dt class="font-medium text-slate-500 inline">Importe:</dt> <dd class="inline">{parseResult.fields.amount} {parseResult.fields.currency}</dd></div>
        {/if}
        <div><dt class="font-medium text-slate-500 inline">Vence:</dt> <dd class="inline">{parseResult.fields.due_date}</dd></div>
        {#if parseResult.fields.provider}
          <div><dt class="font-medium text-slate-500 inline">Proveedor:</dt> <dd class="inline">{parseResult.fields.provider}</dd></div>
        {/if}
        <div><dt class="font-medium text-slate-500 inline">Repetición:</dt> <dd class="inline">{parseResult.fields.recurrence}</dd></div>
      </dl>
    {/if}

    <div class="flex gap-3 pt-2">
      <button onclick={handleConfirm} disabled={loading} class="bg-slate-900 text-white px-5 py-2 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50">
        {loading ? 'Guardando…' : 'Sí, guardar'}
      </button>
      <button onclick={handleCancel} disabled={loading} class="border border-slate-300 px-5 py-2 rounded-md font-medium hover:bg-slate-100">
        No, cambiar
      </button>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Actualizar el link en `src/routes/dashboard/+page.svelte`** para que el card `'/agregar'` apunte a `/dashboard/agregar`. Cambia la línea:

```
{ href: '/agregar', icon: '➕', title: 'Añadir algo', state: 'Citas, facturas, recordatorios' }
```

por:

```
{ href: '/dashboard/agregar', icon: '➕', title: 'Añadir algo', state: 'Citas, facturas, recordatorios' }
```

- [ ] **Step 4: Smoke test manual**

Arranca dev en background. Loguéate y ve a `/dashboard/agregar`. Prueba: "médico el viernes a las 10". Esperado: spinner "Pensando…", luego preview con tipo "Cita", título "Médico", una fecha de viernes a las 10:00. Pulsa "Sí, guardar" → mensaje "Cita guardada." Comprueba en Supabase Table Editor → `events` que apareció una fila con `user_id` igual al tuyo y `source = 'ai_text'`.

Si el parseo devuelve "unknown" o baja confianza con un input claro, ESCALA antes de seguir — el prompt necesita ajuste.

- [ ] **Step 5: Commit**

```
git add src/routes/dashboard/agregar/ src/routes/dashboard/+page.svelte
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: /agregar page with NL input and preview"
```

---

### Task 6: Tabs de entrada manual en `/dashboard/agregar`

Fallback por si el parseo falla o el usuario prefiere formulario.

**Files:**
- Modify: `src/routes/dashboard/agregar/+page.svelte` (añadir tabs)
- Modify: `src/routes/dashboard/agregar/+page.server.ts` (form actions para event y bill manuales)

- [ ] **Step 1: Reemplazar completamente `src/routes/dashboard/agregar/+page.server.ts`**:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');
  return {};
};

export const actions: Actions = {
  createEvent: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const date = String(fd.get('date') ?? '');
    const time = String(fd.get('time') ?? '09:00');
    const location = String(fd.get('location') ?? '').trim() || null;
    const category = String(fd.get('category') ?? 'otro');

    if (!title || !date) return fail(400, { kind: 'event', error: 'Título y fecha son obligatorios.' });

    const validCategories = ['medico', 'familia', 'trabajo', 'personal', 'otro'];
    const finalCategory = validCategories.includes(category) ? category : 'otro';

    const starts_at = new Date(`${date}T${time}:00`).toISOString();

    const { error } = await locals.supabase.from('events').insert({
      user_id: locals.user.id,
      title,
      starts_at,
      location,
      category: finalCategory,
      source: 'manual'
    });
    if (error) return fail(500, { kind: 'event', error: error.message });
    return { kind: 'event', success: true };
  },

  createBill: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const amountStr = String(fd.get('amount') ?? '').trim();
    const due_date = String(fd.get('due_date') ?? '');
    const provider = String(fd.get('provider') ?? '').trim() || null;
    const recurrence = String(fd.get('recurrence') ?? 'none');

    if (!title || !due_date) return fail(400, { kind: 'bill', error: 'Título y fecha de vencimiento son obligatorios.' });

    const amount = amountStr ? Number(amountStr) : null;
    if (amount !== null && Number.isNaN(amount)) {
      return fail(400, { kind: 'bill', error: 'Importe inválido.' });
    }
    const validRecurrence = ['none', 'monthly', 'yearly'];
    const finalRecurrence = validRecurrence.includes(recurrence) ? recurrence : 'none';

    const { error } = await locals.supabase.from('bills').insert({
      user_id: locals.user.id,
      title,
      amount,
      due_date,
      provider,
      recurrence: finalRecurrence,
      source: 'manual'
    });
    if (error) return fail(500, { kind: 'bill', error: error.message });
    return { kind: 'bill', success: true };
  }
};
```

- [ ] **Step 2: Reemplazar completamente `src/routes/dashboard/agregar/+page.svelte`** — combinar el NL input de Task 5 con tabs para los formularios manuales:

```svelte
<script lang="ts">
  import type { ActionData } from './$types';
  let { form }: { form: ActionData } = $props();

  let mode: 'nl' | 'event' | 'bill' = $state('nl');
  let text = $state('');
  let loading = $state(false);
  let parseResult: any = $state(null);
  let errorMsg = $state('');
  let successMsg = $state('');

  async function handleParse(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    loading = true;
    errorMsg = '';
    successMsg = '';
    parseResult = null;

    try {
      const res = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      });
      if (!res.ok) {
        errorMsg = `Error ${res.status}: ${await res.text()}`;
        return;
      }
      const data = await res.json();
      if (data.type === 'unknown' || data.confidence < 0.6) {
        errorMsg = `No lo tengo claro: ${data.reason ?? 'sé más específico (incluye fecha o importe)'}. Prueba con uno de los formularios.`;
        return;
      }
      parseResult = data;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!parseResult || loading) return;
    loading = true;
    try {
      const res = await fetch('/api/confirm-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult)
      });
      if (!res.ok) {
        errorMsg = `Error ${res.status}: ${await res.text()}`;
        return;
      }
      const data = await res.json();
      successMsg = data.kind === 'event' ? 'Cita guardada.' : 'Factura guardada.';
      text = '';
      parseResult = null;
    } finally {
      loading = false;
    }
  }

  function handleCancel() {
    parseResult = null;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }
</script>

<svelte:head><title>Añadir — Rutinas</title></svelte:head>

<h1 class="text-2xl font-bold mb-2">Añadir algo</h1>
<p class="text-slate-600 mb-6">Escríbelo como te salga, o usa un formulario.</p>

<div class="flex gap-2 mb-6 border-b border-slate-200">
  <button onclick={() => { mode = 'nl'; parseResult = null; errorMsg = ''; successMsg = ''; }}
    class="px-4 py-2 -mb-px border-b-2 font-medium text-sm
           {mode === 'nl' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}">
    Escribir
  </button>
  <button onclick={() => { mode = 'event'; parseResult = null; errorMsg = ''; successMsg = ''; }}
    class="px-4 py-2 -mb-px border-b-2 font-medium text-sm
           {mode === 'event' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}">
    Cita / evento
  </button>
  <button onclick={() => { mode = 'bill'; parseResult = null; errorMsg = ''; successMsg = ''; }}
    class="px-4 py-2 -mb-px border-b-2 font-medium text-sm
           {mode === 'bill' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}">
    Factura
  </button>
</div>

{#if successMsg}
  <p class="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm mb-4">{successMsg}</p>
{/if}
{#if errorMsg}
  <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm mb-4">{errorMsg}</p>
{/if}
{#if form?.success}
  <p class="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm mb-4">
    {form.kind === 'event' ? 'Cita guardada.' : 'Factura guardada.'}
  </p>
{/if}
{#if form?.error}
  <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm mb-4">{form.error}</p>
{/if}

{#if mode === 'nl'}
  {#if !parseResult}
    <form onsubmit={handleParse} class="space-y-4">
      <textarea
        bind:value={text}
        placeholder='Ejemplo: "médico martes 10am clínica San José" o "factura luz 80€ vence el 15"'
        rows="3"
        class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-slate-900 focus:outline-none resize-none"
      ></textarea>
      <button
        type="submit"
        disabled={loading || !text.trim()}
        class="bg-slate-900 text-white px-6 py-2.5 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Pensando…' : 'Añadir'}
      </button>
    </form>
  {:else}
    <div class="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold">¿Es esto correcto?</h2>

      {#if parseResult.type === 'event'}
        <dl class="space-y-2 text-sm">
          <div><dt class="font-medium text-slate-500 inline">Tipo:</dt> <dd class="inline">Cita / evento</dd></div>
          <div><dt class="font-medium text-slate-500 inline">Título:</dt> <dd class="inline">{parseResult.fields.title}</dd></div>
          <div><dt class="font-medium text-slate-500 inline">Cuándo:</dt> <dd class="inline">{formatDate(parseResult.fields.starts_at)}</dd></div>
          {#if parseResult.fields.location}
            <div><dt class="font-medium text-slate-500 inline">Dónde:</dt> <dd class="inline">{parseResult.fields.location}</dd></div>
          {/if}
          <div><dt class="font-medium text-slate-500 inline">Categoría:</dt> <dd class="inline">{parseResult.fields.category}</dd></div>
        </dl>
      {:else if parseResult.type === 'bill'}
        <dl class="space-y-2 text-sm">
          <div><dt class="font-medium text-slate-500 inline">Tipo:</dt> <dd class="inline">Factura / pago</dd></div>
          <div><dt class="font-medium text-slate-500 inline">Concepto:</dt> <dd class="inline">{parseResult.fields.title}</dd></div>
          {#if parseResult.fields.amount !== null}
            <div><dt class="font-medium text-slate-500 inline">Importe:</dt> <dd class="inline">{parseResult.fields.amount} {parseResult.fields.currency}</dd></div>
          {/if}
          <div><dt class="font-medium text-slate-500 inline">Vence:</dt> <dd class="inline">{parseResult.fields.due_date}</dd></div>
          {#if parseResult.fields.provider}
            <div><dt class="font-medium text-slate-500 inline">Proveedor:</dt> <dd class="inline">{parseResult.fields.provider}</dd></div>
          {/if}
          <div><dt class="font-medium text-slate-500 inline">Repetición:</dt> <dd class="inline">{parseResult.fields.recurrence}</dd></div>
        </dl>
      {/if}

      <div class="flex gap-3 pt-2">
        <button onclick={handleConfirm} disabled={loading} class="bg-slate-900 text-white px-5 py-2 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Guardando…' : 'Sí, guardar'}
        </button>
        <button onclick={handleCancel} disabled={loading} class="border border-slate-300 px-5 py-2 rounded-md font-medium hover:bg-slate-100">
          No, cambiar
        </button>
      </div>
    </div>
  {/if}

{:else if mode === 'event'}
  <form method="POST" action="?/createEvent" class="space-y-4 max-w-md">
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Título</span>
      <input type="text" name="title" required class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Fecha</span>
        <input type="date" name="date" required class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Hora</span>
        <input type="time" name="time" value="09:00" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </div>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Lugar (opcional)</span>
      <input type="text" name="location" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Categoría</span>
      <select name="category" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">
        <option value="otro">Otro</option>
        <option value="medico">Médico</option>
        <option value="familia">Familia</option>
        <option value="trabajo">Trabajo</option>
        <option value="personal">Personal</option>
      </select>
    </label>
    <button type="submit" class="bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800">
      Guardar cita
    </button>
  </form>

{:else if mode === 'bill'}
  <form method="POST" action="?/createBill" class="space-y-4 max-w-md">
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Concepto</span>
      <input type="text" name="title" required class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Importe (opcional)</span>
        <input type="number" step="0.01" name="amount" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Vencimiento</span>
        <input type="date" name="due_date" required class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </div>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Proveedor (opcional)</span>
      <input type="text" name="provider" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Repetición</span>
      <select name="recurrence" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">
        <option value="none">Una vez</option>
        <option value="monthly">Mensual</option>
        <option value="yearly">Anual</option>
      </select>
    </label>
    <button type="submit" class="bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800">
      Guardar factura
    </button>
  </form>
{/if}
```

- [ ] **Step 3: Smoke test manual**

Recarga `/dashboard/agregar`. Verifica:
- Tab "Cita / evento" → rellena el formulario y guarda. Aparece "Cita guardada.". En Supabase verifica nueva fila en `events` con `source = 'manual'`.
- Tab "Factura" → mismo proceso. Verifica nueva fila en `bills`.
- Tab "Escribir" → sigue funcionando como en Task 5.

- [ ] **Step 4: Commit**

```
git add src/routes/dashboard/agregar/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: manual event and bill forms with tabs"
```

---

### Task 7: Página de lista `/dashboard/eventos`

**Files:**
- Create: `src/routes/dashboard/eventos/+page.server.ts`
- Create: `src/routes/dashboard/eventos/+page.svelte`

- [ ] **Step 1: Crear `src/routes/dashboard/eventos/+page.server.ts`**:

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const filter = url.searchParams.get('filter') ?? 'upcoming';
  const nowIso = new Date().toISOString();

  let query = locals.supabase
    .from('events')
    .select('id, title, starts_at, location, category')
    .eq('user_id', locals.user.id);

  if (filter === 'upcoming') query = query.gte('starts_at', nowIso).order('starts_at', { ascending: true });
  else if (filter === 'past') query = query.lt('starts_at', nowIso).order('starts_at', { ascending: false });
  else query = query.order('starts_at', { ascending: false });

  const { data: events } = await query;
  return { events: events ?? [], filter };
};

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return { success: false };
    await locals.supabase.from('events').delete().eq('id', id).eq('user_id', locals.user.id);
    return { success: true };
  }
};
```

- [ ] **Step 2: Crear `src/routes/dashboard/eventos/+page.svelte`**:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  const filters = [
    { value: 'upcoming', label: 'Próximas' },
    { value: 'past', label: 'Pasadas' },
    { value: 'all', label: 'Todas' }
  ];
</script>

<svelte:head><title>Citas — Rutinas</title></svelte:head>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Mis citas</h1>
  <a href="/dashboard/agregar" class="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800">
    ➕ Añadir cita
  </a>
</div>

<div class="flex gap-2 mb-6 text-sm">
  {#each filters as f}
    <a href="?filter={f.value}" class="px-3 py-1.5 rounded-md
      {data.filter === f.value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 hover:bg-slate-100'}">
      {f.label}
    </a>
  {/each}
</div>

{#if data.events.length === 0}
  <p class="text-slate-500 text-center py-12">No hay citas {data.filter === 'upcoming' ? 'próximas' : data.filter === 'past' ? 'pasadas' : ''}.</p>
{:else}
  <ul class="space-y-3">
    {#each data.events as event}
      <li class="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
        <div>
          <p class="font-medium">{event.title}</p>
          <p class="text-sm text-slate-600">{formatDate(event.starts_at)}{#if event.location} · {event.location}{/if}</p>
          <span class="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{event.category}</span>
        </div>
        <form method="POST" action="?/delete">
          <input type="hidden" name="id" value={event.id} />
          <button type="submit" class="text-red-600 hover:text-red-800 text-sm font-medium" aria-label="Eliminar">
            Eliminar
          </button>
        </form>
      </li>
    {/each}
  </ul>
{/if}
```

- [ ] **Step 3: Actualizar el card del dashboard** — en `src/routes/dashboard/+page.svelte`, el href del card de citas ya es `/eventos`. Cámbialo a `/dashboard/eventos`:

```
{ href: '/dashboard/eventos', icon: '📅', title: 'Mis citas', state: 'Sin citas guardadas' }
```

- [ ] **Step 4: Smoke test** — entra a `/dashboard/eventos`. Verifica que aparecen las citas que añadiste en Tasks 5-6. Prueba los filtros y eliminar una.

- [ ] **Step 5: Commit**

```
git add src/routes/dashboard/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: events list page with filters"
```

---

### Task 8: Página de lista `/dashboard/facturas`

**Files:**
- Create: `src/routes/dashboard/facturas/+page.server.ts`
- Create: `src/routes/dashboard/facturas/+page.svelte`

- [ ] **Step 1: Crear `src/routes/dashboard/facturas/+page.server.ts`**:

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const filter = url.searchParams.get('filter') ?? 'pending';

  let query = locals.supabase
    .from('bills')
    .select('id, title, amount, currency, due_date, paid, recurrence, provider')
    .eq('user_id', locals.user.id);

  if (filter === 'pending') query = query.eq('paid', false).order('due_date', { ascending: true });
  else if (filter === 'paid') query = query.eq('paid', true).order('due_date', { ascending: false });
  else query = query.order('due_date', { ascending: false });

  const { data: bills } = await query;
  return { bills: bills ?? [], filter };
};

export const actions: Actions = {
  togglePaid: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const paid = fd.get('paid') === 'true';
    if (!id) return { success: false };
    await locals.supabase
      .from('bills')
      .update({ paid: !paid })
      .eq('id', id)
      .eq('user_id', locals.user.id);
    return { success: true };
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return { success: false };
    await locals.supabase.from('bills').delete().eq('id', id).eq('user_id', locals.user.id);
    return { success: true };
  }
};
```

- [ ] **Step 2: Crear `src/routes/dashboard/facturas/+page.svelte`**:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  function formatDate(d: string): string {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch {
      return d;
    }
  }

  function daysUntil(d: string): number {
    const due = new Date(d + 'T00:00:00').getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.round((due - now) / (1000 * 60 * 60 * 24));
  }

  const filters = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'paid', label: 'Pagadas' },
    { value: 'all', label: 'Todas' }
  ];
</script>

<svelte:head><title>Facturas — Rutinas</title></svelte:head>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Mis facturas</h1>
  <a href="/dashboard/agregar" class="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800">
    ➕ Añadir factura
  </a>
</div>

<div class="flex gap-2 mb-6 text-sm">
  {#each filters as f}
    <a href="?filter={f.value}" class="px-3 py-1.5 rounded-md
      {data.filter === f.value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 hover:bg-slate-100'}">
      {f.label}
    </a>
  {/each}
</div>

{#if data.bills.length === 0}
  <p class="text-slate-500 text-center py-12">No hay facturas {data.filter === 'pending' ? 'pendientes' : data.filter === 'paid' ? 'pagadas' : ''}.</p>
{:else}
  <ul class="space-y-3">
    {#each data.bills as bill}
      {@const days = daysUntil(bill.due_date)}
      <li class="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
        <div class="flex-1">
          <p class="font-medium {bill.paid ? 'line-through text-slate-400' : ''}">{bill.title}</p>
          <p class="text-sm text-slate-600">
            {#if bill.amount !== null}{bill.amount} {bill.currency} · {/if}
            Vence {formatDate(bill.due_date)}
            {#if !bill.paid}
              {#if days < 0}<span class="text-red-600 font-medium">(vencida hace {-days} días)</span>
              {:else if days === 0}<span class="text-orange-600 font-medium">(hoy)</span>
              {:else if days <= 7}<span class="text-orange-600 font-medium">(en {days} día{days === 1 ? '' : 's'})</span>
              {/if}
            {/if}
          </p>
          {#if bill.provider}<span class="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{bill.provider}</span>{/if}
        </div>
        <div class="flex items-center gap-2">
          <form method="POST" action="?/togglePaid">
            <input type="hidden" name="id" value={bill.id} />
            <input type="hidden" name="paid" value={String(bill.paid)} />
            <button type="submit" class="text-sm font-medium px-3 py-1 rounded
              {bill.paid ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}">
              {bill.paid ? 'Reabrir' : 'Marcar pagada'}
            </button>
          </form>
          <form method="POST" action="?/delete">
            <input type="hidden" name="id" value={bill.id} />
            <button type="submit" class="text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
          </form>
        </div>
      </li>
    {/each}
  </ul>
{/if}
```

- [ ] **Step 3: Actualizar el card del dashboard** — cambia el href de facturas a `/dashboard/facturas` en `src/routes/dashboard/+page.svelte`:

```
{ href: '/dashboard/facturas', icon: '💰', title: 'Mis facturas', state: 'Sin facturas guardadas' }
```

- [ ] **Step 4: Smoke test** — entra a `/dashboard/facturas`. Verifica que aparecen las facturas. Marca una como pagada y verifica que el filtro la mueve. Elimina una.

- [ ] **Step 5: Commit**

```
git add src/routes/dashboard/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: bills list page with paid toggle"
```

---

### Task 9: Conectar el dashboard con conteos reales

Ahora que hay datos, las tarjetas del dashboard deben mostrar el estado real en vez de "Sin citas guardadas".

**Files:**
- Modify: `src/routes/dashboard/+page.server.ts`
- Modify: `src/routes/dashboard/+page.svelte`

- [ ] **Step 1: Reemplazar `src/routes/dashboard/+page.server.ts`**:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, eventsRes, billsRes, nextEventRes] = await Promise.all([
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
      .maybeSingle()
  ]);

  return {
    profile: profileRes.data ?? { full_name: '', timezone: 'Europe/Madrid' },
    upcomingEventsCount: eventsRes.count ?? 0,
    upcomingBillsCount: billsRes.count ?? 0,
    nextEvent: nextEventRes.data
  };
};
```

- [ ] **Step 2: Reemplazar `src/routes/dashboard/+page.svelte`**:

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

- [ ] **Step 3: Smoke test** — recarga `/dashboard`. Las tarjetas de citas y facturas deben mostrar conteos reales. Si hay próxima cita, aparece su título y fecha resumida en la tarjeta.

- [ ] **Step 4: Commit**

```
git add src/routes/dashboard/
git -c user.name=Francisco -c user.email=franciscohubner12@gmail.com commit -m "feat: dashboard cards show real counts and next event"
```

---

### Task 10: Smoke test end-to-end del Plan 2

Checklist manual. Arrancar dev server.

- [ ] Logueado, ir a `/dashboard` — las cuatro tarjetas se renderizan con estados.
- [ ] Pulsar **"Añadir algo"** → llega a `/dashboard/agregar` con tres tabs (Escribir / Cita / Factura).
- [ ] **Tab "Escribir":** escribir `"dentista próximo martes 11am"` → ver preview con tipo "Cita", título "Dentista", fecha del próximo martes a 11:00. Pulsar "Sí, guardar" → mensaje "Cita guardada.".
- [ ] **Tab "Escribir":** escribir `"factura del gas 45€ vence el 20"` → ver preview con tipo "Factura", importe 45, vencimiento día 20. Confirmar.
- [ ] **Tab "Cita":** rellenar formulario manual, guardar.
- [ ] **Tab "Factura":** rellenar formulario manual, guardar.
- [ ] **`/dashboard/eventos`:** ver las dos citas (la NL y la manual). Filtrar entre próximas/pasadas/todas. Eliminar una y confirmar que desaparece.
- [ ] **`/dashboard/facturas`:** ver las dos facturas. Marcar una como pagada (debe pasar al filtro "Pagadas" y desaparecer del default "Pendientes"). Reabrirla. Eliminar la otra.
- [ ] **Volver al `/dashboard`:** las tarjetas reflejan los conteos actualizados.
- [ ] **Login con segundo usuario** (crea otra cuenta si no existe): no debe ver datos del primer usuario. Verifica que sus listas están vacías y al añadir cosas no se mezclan.
- [ ] `npm run check` → 0 errores. `npm test` → todos pasan.

---

## Self-Review

- **Spec coverage:** este plan cubre las piezas del MVP relativas a entrada manual y parseo NL definidas en el spec: el endpoint Flujo A (Task 3), la pantalla `/agregar` con input grande + formularios estructurados (Tasks 5-6), y las listas `/eventos`/`/facturas` (Tasks 7-8). El dashboard se conecta con datos reales (Task 9). El triage de correo y el resumen diario quedan para los planes 3 y 4 como estaba previsto.
- **Placeholders:** revisado, no hay TBDs.
- **Type consistency:** los campos usados en `parseIntent` (event: title/starts_at/ends_at/location/category/description; bill: title/amount/currency/due_date/provider/recurrence/notes) coinciden con las columnas del migration de Plan 1 y con los INSERTs del endpoint `confirm-intent` (Task 4) y los form actions manuales (Task 6). El valor `source = 'ai_text'` o `'manual'` está dentro del CHECK constraint definido en BD.

---

## Próximo

- **Plan 3:** Triage de Gmail.
- **Plan 4:** Resumen diario + despliegue Cloudflare Pages.
