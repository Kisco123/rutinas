<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  const name = $derived(data.profile.full_name?.trim() || 'qué bueno verte');

  function formatNext(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  const cards = $derived([
    {
      href: '/correo',
      icon: '📧',
      title: 'Ordenar mi correo',
      state: 'Conecta Gmail en una próxima versión',
      accent: true
    },
    {
      href: '/dashboard/eventos',
      icon: '📅',
      title: 'Mis citas',
      state: data.upcomingEventsCount === 0
        ? 'Sin citas próximas'
        : data.nextEvent
          ? `${data.upcomingEventsCount} próximas · siguiente: ${formatNext(data.nextEvent.starts_at)}`
          : `${data.upcomingEventsCount} próximas`
    },
    {
      href: '/dashboard/facturas',
      icon: '💰',
      title: 'Mis facturas',
      state: data.upcomingBillsCount === 0
        ? 'Sin facturas próximas'
        : `${data.upcomingBillsCount} vence${data.upcomingBillsCount === 1 ? '' : 'n'} esta semana`
    },
    {
      href: '/dashboard/agregar',
      icon: '➕',
      title: 'Añadir algo',
      state: 'Citas, facturas, recordatorios'
    }
  ]);
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
