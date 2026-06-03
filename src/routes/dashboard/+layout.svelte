<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';
  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="min-h-screen">
  <header class="border-b border-slate-200 bg-white">
    <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/dashboard" class="font-bold text-lg">Rutinas</a>
      <nav class="flex items-center gap-4 text-sm">
        <a href="/dashboard/ajustes" class="text-slate-600 hover:text-slate-900">Ajustes</a>
        <form method="POST" action="/logout">
          <button type="submit" class="text-slate-600 hover:text-slate-900">Cerrar sesión</button>
        </form>
      </nav>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-6 py-8">
    {@render children()}
  </main>
</div>
