# Rutinas — Diseño

**Fecha:** 2026-06-01
**Estado:** Borrador aprobado por el usuario, pendiente de plan de implementación

## Resumen en una frase

Una web personal que centraliza la información digital dispersa de una persona (correo, citas, facturas, documentos, contactos) y la presenta de forma simple y accionable, con la **clasificación inteligente del correo** como feature estrella y un **hub de intención** ("¿qué quieres hacer hoy?") como punto de entrada.

## Problema y usuario

**Usuario objetivo:** personas con sobrecarga digital. Incluye mayores de 60 años con poca tolerancia a interfaces complejas, personas con TDAH, profesionales muy ocupados, y cualquiera que sienta que "tiene demasiadas apps y no se entera de nada".

**Problema:** la información importante (un email del banco, una cita médica, una factura que vence) está dispersa entre Gmail, Calendar, fotos del móvil, papeles físicos y la memoria del usuario. El ruido (promociones, notificaciones) ahoga lo importante.

**Promesa:** un solo lugar al que entras y te dice qué importa hoy y qué quieres hacer al respecto.

## Alcance del MVP

**Incluido en v1:**
1. Autenticación email + contraseña (Supabase Auth)
2. Hub de intención en `/dashboard` con tarjetas accionables
3. Triage de correo Gmail (OAuth read-only + clasificación con Claude)
4. Añadir eventos/facturas a mano + parseo de lenguaje natural
5. Resumen diario generado por IA
6. Aislamiento por usuario (RLS estricto en Supabase)

**Fase 2 (no en v1):**
- Subida y extracción de documentos (PDF/foto)
- Contactos con frecuencia objetivo
- Notas / journal
- Envío del resumen por email
- Acciones de escritura sobre Gmail (archivar, responder)

## Stack técnico

- **Frontend + endpoints:** SvelteKit en Cloudflare Pages. Las rutas `+server.ts` corren como Cloudflare Workers; allí van todas las llamadas a Claude y a Gmail para que las API keys no lleguen al navegador.
- **Estilos:** TailwindCSS. Tipografía grande, alto contraste, pocos elementos por pantalla.
- **Auth + DB + Storage:** Supabase (Postgres con RLS, Supabase Auth, Storage para fase 2).
- **IA:** Anthropic Claude API.
  - `claude-haiku-4-5-20251001` para clasificación de correo y parseo de lenguaje natural (volumen alto, latencia baja, coste bajo).
  - `claude-sonnet-4-6` para el resumen diario (calidad de redacción).
  - Prompt caching activado en ambas para reducir coste.
- **Gmail:** OAuth 2.0 de Google, scope `https://www.googleapis.com/auth/gmail.readonly`. Refresh tokens cifrados en Supabase.
- **Despliegue:** Cloudflare Pages con dominio `*.pages.dev` (suficiente para compartir la URL).

## Arquitectura

```
Navegador
   │
   ▼
SvelteKit (Cloudflare Pages)
   │   ├─ páginas (.svelte)
   │   └─ endpoints (+server.ts) ── corren como Cloudflare Workers
   │           │
   │           ├──► Anthropic API (Claude Haiku / Sonnet)
   │           ├──► Gmail API (lectura)
   │           └──► Supabase (auth, postgres, storage)
   │
   ▼
Supabase
   ├─ auth.users
   ├─ public.profiles / events / bills / email_classifications / oauth_tokens / daily_summaries
   └─ storage (fase 2)
```

Toda escritura a la base de datos pasa por endpoints del servidor (no desde el cliente directamente con la clave anónima cuando hay datos sensibles). Las claves de servicio nunca salen del Worker.

## Modelo de datos

Tablas en el esquema `public`. Todas tienen `user_id uuid references auth.users(id) on delete cascade` y RLS que solo permite a `auth.uid() = user_id`.

### `profiles`
- `id uuid pk` (= `auth.users.id`)
- `full_name text`
- `timezone text default 'Europe/Madrid'`
- `locale text default 'es'`
- `created_at timestamptz default now()`

### `events`
Citas, recordatorios, cumpleaños.
- `id uuid pk default gen_random_uuid()`
- `user_id uuid`
- `title text not null`
- `description text`
- `starts_at timestamptz not null`
- `ends_at timestamptz`
- `location text`
- `category text` (enum lógico: `medico`, `familia`, `trabajo`, `personal`, `otro`)
- `source text` (`manual`, `ai_text`, `ai_email`)
- `created_at timestamptz default now()`

### `bills`
Facturas y pagos.
- `id uuid pk`
- `user_id uuid`
- `title text not null`
- `amount numeric(12,2)`
- `currency text default 'EUR'`
- `due_date date not null`
- `paid boolean default false`
- `recurrence text` (`none`, `monthly`, `yearly`)
- `provider text`
- `notes text`
- `source text` (`manual`, `ai_text`, `ai_email`)
- `created_at timestamptz default now()`

### `oauth_tokens`
Tokens cifrados de Google. Una fila por usuario y proveedor.
- `id uuid pk`
- `user_id uuid`
- `provider text not null` (`google`)
- `access_token_encrypted text not null`
- `refresh_token_encrypted text not null`
- `expires_at timestamptz`
- `scope text`
- `updated_at timestamptz default now()`
- `unique (user_id, provider)`

Cifrado simétrico con clave en variables de entorno del Worker (AES-GCM). RLS bloquea lectura desde el cliente; solo accesibles vía endpoints del servidor.

### `email_classifications`
Caché de la última clasificación de correos. Se reusa si el usuario vuelve en menos de N minutos.
- `id uuid pk`
- `user_id uuid`
- `gmail_message_id text not null`
- `gmail_thread_id text`
- `from_name text`
- `from_email text`
- `subject text`
- `snippet text`
- `received_at timestamptz`
- `category text` (`urgente`, `importante`, `informativo`, `ruido`)
- `one_line_summary text` (en español sencillo, generado por Claude)
- `suggested_action text` (`crear_evento`, `crear_factura`, `ninguna`)
- `classified_at timestamptz default now()`
- `unique (user_id, gmail_message_id)`

### `daily_summaries`
Caché del párrafo del resumen diario.
- `id uuid pk`
- `user_id uuid`
- `date date not null`
- `content text not null` (markdown corto)
- `generated_at timestamptz default now()`
- `unique (user_id, date)`

## Pantallas

### `/` — Landing
Una frase grande explicando qué hace, dos botones: "Crear cuenta" y "Entrar". Sin scroll, sin más.

### `/login` y `/signup`
Formularios mínimos. Email + contraseña. Mensajes de error en lenguaje claro.

### `/dashboard` — Hub de intención
La pantalla principal. Estructura:

1. **Saludo personal** arriba: "Buenos días, {nombre}". Una frase del resumen diario.
2. **Pregunta grande:** "¿Qué quieres hacer hoy?"
3. **Tarjetas grandes** (grid 2 columnas en desktop, 1 en móvil), cada una con icono, título y micro-estado:
   - 📧 **Ordenar mi correo** — "47 sin leer · 3 urgentes" (o "Conectar Gmail" si no está vinculado)
   - ☀️ **Ver mi día** — "2 citas, 1 factura próxima"
   - ➕ **Añadir algo** — "Citas, facturas, recordatorios"
   - 📅 **Mis citas** — "Próxima: dentista martes 10:00"
   - 💰 **Mis facturas** — "2 vencen esta semana"
4. **Pie:** botón pequeño "Ajustes" y "Cerrar sesión".

### `/correo` — Triage de Gmail (feature estrella)
- Si no hay Gmail conectado: tarjeta grande "Conecta tu Gmail" con explicación clara (solo lectura, puedes desconectar cuando quieras) y botón OAuth.
- Si está conectado: botón **"Ordenar mi correo ahora"**. Al pulsar:
  - Estado de carga ("Leyendo tus últimos 50 correos…", "Pensando qué es importante…").
  - Resultado: cuatro secciones colapsables, en este orden:
    - 🔴 **Urgente / acción requerida**
    - 🟡 **Importante / personal**
    - 🟢 **Informativo**
    - ⚫ **Ruido**
  - Cada email muestra: remitente, **resumen de una línea en español sencillo** (no el asunto técnico), fecha relativa.
  - Si Claude detectó una factura o cita en el email, aparece botón "➕ Crear factura" o "➕ Crear evento" que prellena el formulario.
  - Link "Abrir en Gmail" para cada uno.

### `/agregar`
Un input grande de texto: "Cuéntame qué quieres recordar". Ejemplos como placeholder rotativo ("médico martes 10am", "factura luz 80€ vence el 15"). Botón "Añadir".
Debajo, tabs para entrada manual estructurada: "Cita" / "Factura". Por si el parseo falla o el usuario prefiere formulario.

### `/eventos` y `/facturas`
Listas filtrables (próximos / pasados / todos). Cada elemento se puede editar o borrar.

### `/ajustes`
- Nombre, zona horaria, idioma.
- Estado de la conexión con Google (conectar / desconectar).
- Cerrar sesión.

## Flujos de IA

### Flujo A: Parseo de lenguaje natural
Disparador: usuario escribe en `/agregar` y pulsa "Añadir".
1. Endpoint `POST /api/parse-intent` recibe `{text, now_iso, timezone}`.
2. Llama a Claude Haiku con un prompt en español que pide JSON estricto: `{"type": "event"|"bill"|"unknown", "fields": {…}, "confidence": 0-1}`.
3. Si `confidence < 0.6` o `type = unknown`: devolver al usuario para que aclare.
4. Si OK: devolver al cliente un **preview**. El usuario confirma o corrige y solo entonces se hace `INSERT`.

### Flujo B: Triage de Gmail
Disparador: usuario pulsa "Ordenar mi correo ahora".
1. Endpoint `POST /api/email/triage` consulta `oauth_tokens`, refresca si hace falta.
2. Llama a Gmail API `users.messages.list` filtrando `is:unread` (límite configurable, por defecto 50).
3. Para cada mensaje, `users.messages.get` con `format=metadata` + snippet.
4. **Una sola llamada batch a Claude Haiku** con todos los emails en el mismo prompt (entrada estructurada: lista numerada con from/subject/snippet). Prompt pide JSON: array de objetos `{id, category, one_line_summary, suggested_action}`.
5. Persistir resultados en `email_classifications` (upsert por `gmail_message_id`).
6. Devolver al cliente la lista clasificada.

Optimizaciones: usar prompt caching en la parte de instrucciones del prompt (que es estable). Si el mismo email ya está clasificado y tiene menos de 24h, no reclasificar.

### Flujo C: Resumen diario
Disparador: carga de `/dashboard`.
1. Endpoint `GET /api/daily-summary` busca en `daily_summaries` para `(user_id, today)`.
2. Si existe y se generó hace menos de 4 horas: devolver caché.
3. Si no: recopilar contexto del usuario (eventos próximos 7 días, facturas próximas 14 días, conteo de emails urgentes/importantes **solo si Gmail está conectado y hay clasificaciones de menos de 24h en caché** — el resumen diario nunca dispara un triage por sí solo, para evitar latencia y coste sorpresa). Pasar a Claude Sonnet con un prompt que pide un párrafo cálido y claro en español. Guardar y devolver.

## Autenticación y seguridad

- Supabase Auth con email + contraseña. Confirmación por email activada.
- Todas las tablas con RLS. Política base: `auth.uid() = user_id` para `select`, `insert`, `update`, `delete`.
- `oauth_tokens` con política RLS restrictiva: **ningún** rol cliente (`anon` ni `authenticated`) puede leer ni escribir esa tabla. Solo el `service_role` (usado únicamente en endpoints `+server.ts` del Worker) tiene acceso. Así, aunque el JWT del usuario sea robado, los tokens de Google no quedan expuestos.
- Variables de entorno en Cloudflare Pages: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY` (32 bytes base64).
- CSP estricta. Sin almacenamiento de contenido de emails en la DB más allá de `snippet` (lo que ya devuelve Gmail) y el resumen de una línea generado.

## Compartir el proyecto

URL pública en `*.pages.dev`. Cualquiera puede crear cuenta. RLS aísla a cada usuario. Sin sistema de invitaciones.

## Decisiones cerradas (para evitar replantearse después)

- **Idioma:** la UI y los textos generados por IA son en español. Tipear/copy en castellano neutro.
- **Sin notificaciones push, sin email, sin SMS en v1.** El usuario abre la web.
- **Sin app móvil.** Web responsive — diseñada móvil-primero pero usable en escritorio.
- **Sin tests pesados en v1.** Tests mínimos de los endpoints críticos (`parse-intent`, `email/triage`). Sin e2e hasta fase 2.
- **Sin sistema de plantillas de rutinas.** Lo que en Claude se llama "rutinas" aquí es "el resumen y triage automáticos que ves al abrir". No hay scheduler en v1.

## Riesgos y mitigaciones

- **OAuth de Google requiere verificación si pides scopes sensibles.** `gmail.readonly` es restringido. En modo "Testing" se permiten 100 usuarios sin verificar — suficiente para uso personal y compartir con conocidos. La verificación completa puede llevar semanas y queda fuera del v1.
- **Coste de la API de Claude.** Mitigado con Haiku para volumen, caché de clasificaciones, y prompt caching. Estimación: < $1/usuario/mes para uso normal.
- **Latencia del triage con 50 emails.** Una sola llamada batch a Haiku con todo el lote: ~3-6 segundos. Aceptable con buen spinner. Si crece, paralelizar en sublotes.
- **Privacidad.** El contenido de los emails se envía a Anthropic. Hay que decirlo claro en la UI antes de conectar Gmail.

## Próximo paso

Plan de implementación detallado (skill `writing-plans`).
