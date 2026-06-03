<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  const name = data.profile.full_name?.trim() || 'qué bueno verte';

  const cards = [
    { href: '/correo', icon: '📧', title: 'Ordenar mi correo', state: 'Conecta Gmail en una próxima versión', accent: true },
    { href: '/eventos', icon: '📅', title: 'Mis citas', state: 'Sin citas guardadas' },
    { href: '/facturas', icon: '💰', title: 'Mis facturas', state: 'Sin facturas guardadas' },
    { href: '/agregar', icon: '➕', title: 'Añadir algo', state: 'Citas, facturas, recordatorios' }
  ];
</script>

<svelte:head><title>Dashboard — Rutinas</title></svelte:head>

<section class="space-y-2 mb-8">
  <p class="text-slate-600">Hola, {name}.</p>
  <h1 class="text-3xl font-bold">¿Qué quieres hacer hoy?</h1>
</section>

<div class="grid gap-4 sm:grid-cols-2">
  {#each cards as card}
    <a
      href={card.href}
      class="block p-6 rounded-xl border bg-white hover:bg-slate-50 transition
             {card.accent ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}"
    >
      <div class="text-3xl mb-2">{card.icon}</div>
      <h2 class="text-lg font-semibold">{card.title}</h2>
      <p class="text-sm text-slate-600 mt-1">{card.state}</p>
    </a>
  {/each}
</div>
