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
