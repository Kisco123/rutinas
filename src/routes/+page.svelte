<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Rutinas</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center p-6">
  <div class="max-w-xl w-full text-center space-y-8">
    <h1 class="text-5xl font-bold tracking-tight">Rutinas</h1>
    <p class="text-xl text-slate-600">
      Una sola pantalla con todo lo importante de tu día: tu correo ordenado,
      tus citas, tus facturas. Sin ruido.
    </p>
    <div class="flex gap-4 justify-center pt-4">
      {#if data.user}
        <a href="/dashboard" class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800">
          Ir a mi dashboard
        </a>
      {:else}
        <a href="/signup" class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800">
          Crear cuenta
        </a>
        <a href="/login" class="border border-slate-300 px-6 py-3 rounded-lg font-medium hover:bg-slate-100">
          Entrar
        </a>
      {/if}
    </div>
  </div>
</main>
