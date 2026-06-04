<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  // Tres bullets que insinúan qué hace la app, sin sobrecargar.
  const bullets = [
    { icon: '📧', text: 'Tu correo ordenado por importancia' },
    { icon: '📅', text: 'Citas, facturas y recordatorios en un solo sitio' },
    { icon: '☀️', text: 'Un resumen claro de tu día al abrir' }
  ];
</script>

<svelte:head>
  <title>Rutinas</title>
</svelte:head>

<main
  class="relative min-h-screen flex items-center justify-center p-6 overflow-hidden
         bg-gradient-to-br from-slate-50 via-white to-amber-50"
>
  <!-- Manchas suaves de color en el fondo para dar profundidad sin ruido -->
  <div class="pointer-events-none absolute inset-0 -z-10">
    <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl"></div>
    <div class="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-sky-200/40 blur-3xl"></div>
  </div>

  <div class="max-w-xl w-full text-center space-y-10">
    <div class="space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur
                  border border-slate-200 text-xs font-medium text-slate-600">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Tu día, sin el caos digital
      </div>
      <h1 class="text-6xl font-bold tracking-tight">
        Rutinas
      </h1>
      <p class="text-xl text-slate-600 max-w-md mx-auto">
        Una sola pantalla con todo lo importante de tu día. Sin ruido.
      </p>
    </div>

    <ul class="space-y-3 max-w-sm mx-auto text-left">
      {#each bullets as b}
        <li class="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/70 backdrop-blur border border-slate-200/70">
          <span class="text-xl">{b.icon}</span>
          <span class="text-slate-700">{b.text}</span>
        </li>
      {/each}
    </ul>

    <div class="flex gap-3 justify-center pt-2">
      {#if data.user}
        <a
          href="/dashboard"
          class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-sm"
        >
          Ir a mi dashboard
        </a>
      {:else}
        <a
          href="/signup"
          class="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-sm"
        >
          Crear cuenta
        </a>
        <a
          href="/login"
          class="bg-white/80 backdrop-blur border border-slate-300 px-6 py-3 rounded-lg font-medium hover:bg-white transition"
        >
          Entrar
        </a>
      {/if}
    </div>
  </div>
</main>
