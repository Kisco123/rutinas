<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} — Rutinas</title></svelte:head>

<main class="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-amber-50">
  <div class="max-w-md w-full text-center space-y-6">
    <div class="text-7xl font-bold text-slate-300">{page.status}</div>
    <h1 class="text-2xl font-bold">
      {#if page.status === 404}
        Esto no existe
      {:else if page.status === 401 || page.status === 403}
        No puedes ver esto
      {:else}
        Algo salió mal
      {/if}
    </h1>
    <p class="text-slate-600">
      {#if page.status === 404}
        La página que buscas no está. Quizá la moviste, o el enlace está mal.
      {:else if page.error?.message}
        {page.error.message}
      {:else}
        Vuelve al dashboard o inténtalo de nuevo en un rato.
      {/if}
    </p>
    <a
      href="/dashboard"
      class="inline-block bg-slate-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-slate-800"
    >
      Ir al dashboard
    </a>
  </div>
</main>
