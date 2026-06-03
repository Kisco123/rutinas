<script lang="ts">
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();

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
