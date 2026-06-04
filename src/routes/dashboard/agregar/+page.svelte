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
