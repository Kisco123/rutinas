<script lang="ts">
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Editar factura — Rutinas</title></svelte:head>

<div class="flex items-center gap-3 mb-6">
  <a href="/dashboard/facturas" class="text-slate-500 hover:text-slate-900" aria-label="Volver">←</a>
  <h1 class="text-2xl font-bold">Editar factura</h1>
</div>

{#if form?.error}
  <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm mb-4 max-w-md">{form.error}</p>
{/if}

<form method="POST" action="?/update" class="space-y-4 max-w-md">
  <label class="block">
    <span class="text-sm font-medium text-slate-700">Concepto</span>
    <input type="text" name="title" required value={data.bill.title} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
  </label>

  <div class="grid grid-cols-2 gap-3">
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Importe (opcional)</span>
      <input type="number" step="0.01" name="amount" value={data.bill.amount ?? ''} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Vencimiento</span>
      <input type="date" name="due_date" required value={data.bill.due_date} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
  </div>

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Proveedor (opcional)</span>
    <input type="text" name="provider" value={data.bill.provider ?? ''} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
  </label>

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Repetición</span>
    <select name="recurrence" value={data.bill.recurrence} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">
      <option value="none">Una vez</option>
      <option value="monthly">Mensual</option>
      <option value="yearly">Anual</option>
    </select>
  </label>

  <label class="flex items-center gap-2 pt-2">
    <input type="checkbox" name="paid" checked={data.bill.paid} class="rounded border-slate-300" />
    <span class="text-sm text-slate-700">Marcar como pagada</span>
  </label>

  <div class="flex items-center justify-between pt-2">
    <button type="submit" class="bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800">
      Guardar cambios
    </button>
    <button
      type="submit"
      formaction="?/delete"
      onclick={(e) => { if (!confirm('¿Seguro que quieres borrar esta factura? No se puede deshacer.')) e.preventDefault(); }}
      class="text-red-600 hover:text-red-800 text-sm font-medium"
    >
      Eliminar factura
    </button>
  </div>
</form>
