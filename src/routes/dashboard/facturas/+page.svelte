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
      <li class="bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition flex items-stretch">
        <a href="/dashboard/facturas/{bill.id}" class="flex-1 p-4 cursor-pointer">
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
        </a>
        <div class="flex items-center gap-2 pr-4">
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
            <button
              type="submit"
              onclick={(e) => { if (!confirm('¿Seguro que quieres borrar esta factura?')) e.preventDefault(); }}
              class="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
            >
              Eliminar
            </button>
          </form>
        </div>
      </li>
    {/each}
  </ul>
{/if}
