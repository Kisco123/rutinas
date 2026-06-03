<script lang="ts">
  import type { ActionData } from './$types';
  let { form }: { form: ActionData } = $props();
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
