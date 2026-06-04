import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const filter = url.searchParams.get('filter') ?? 'upcoming';
  const nowIso = new Date().toISOString();

  let query = locals.supabase
    .from('events')
    .select('id, title, starts_at, location, category')
    .eq('user_id', locals.user.id);

  if (filter === 'upcoming') query = query.gte('starts_at', nowIso).order('starts_at', { ascending: true });
  else if (filter === 'past') query = query.lt('starts_at', nowIso).order('starts_at', { ascending: false });
  else query = query.order('starts_at', { ascending: false });

  const { data: events } = await query;
  return { events: events ?? [], filter };
};

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return { success: false };
    await locals.supabase.from('events').delete().eq('id', id).eq('user_id', locals.user.id);
    return { success: true };
  }
};
