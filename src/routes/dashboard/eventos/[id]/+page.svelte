<script lang="ts">
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Derive date and time inputs from the stored ISO starts_at
  const startsDate = new Date(data.event.starts_at);
  const isoDate = startsDate.toISOString().slice(0, 10);
  const isoTime = startsDate.toTimeString().slice(0, 5);
</script>

<svelte:head><title>Editar cita — Rutinas</title></svelte:head>

<div class="flex items-center gap-3 mb-6">
  <a href="/dashboard/eventos" class="text-slate-500 hover:text-slate-900" aria-label="Volver">←</a>
  <h1 class="text-2xl font-bold">Editar cita</h1>
</div>

{#if form?.error}
  <p class="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm mb-4 max-w-md">{form.error}</p>
{/if}

<form method="POST" action="?/update" class="space-y-4 max-w-md">
  <label class="block">
    <span class="text-sm font-medium text-slate-700">Título</span>
    <input type="text" name="title" required value={data.event.title} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
  </label>

  <div class="grid grid-cols-2 gap-3">
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Fecha</span>
      <input type="date" name="date" required value={isoDate} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <label class="block">
      <span class="text-sm font-medium text-slate-700">Hora</span>
      <input type="time" name="time" value={isoTime} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
  </div>

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Lugar (opcional)</span>
    <input type="text" name="location" value={data.event.location ?? ''} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
  </label>

  <label class="block">
    <span class="text-sm font-medium text-slate-700">Categoría</span>
    <select name="category" value={data.event.category} class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">
      <option value="otro">Otro</option>
      <option value="medico">Médico</option>
      <option value="familia">Familia</option>
      <option value="trabajo">Trabajo</option>
      <option value="personal">Personal</option>
    </select>
  </label>

  <div class="flex items-center justify-between pt-2">
    <button type="submit" class="bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800">
      Guardar cambios
    </button>
    <button
      type="submit"
      formaction="?/delete"
      onclick={(e) => { if (!confirm('¿Seguro que quieres borrar esta cita? No se puede deshacer.')) e.preventDefault(); }}
      class="text-red-600 hover:text-red-800 text-sm font-medium"
    >
      Eliminar cita
    </button>
  </div>
</form>
