import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const { data: event } = await locals.supabase
    .from('events')
    .select('id, title, starts_at, location, category, description')
    .eq('id', params.id)
    .eq('user_id', locals.user.id)
    .single();

  if (!event) throw error(404, 'Cita no encontrada');

  return { event };
};

export const actions: Actions = {
  update: async ({ request, locals, params }) => {
    if (!locals.user) throw redirect(303, '/login');

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const date = String(fd.get('date') ?? '');
    const time = String(fd.get('time') ?? '09:00');
    const location = String(fd.get('location') ?? '').trim() || null;
    const category = String(fd.get('category') ?? 'otro');

    if (!title || !date) return fail(400, { error: 'Título y fecha son obligatorios.' });

    const validCategories = ['medico', 'familia', 'trabajo', 'personal', 'otro'];
    const finalCategory = validCategories.includes(category) ? category : 'otro';

    const starts_at = new Date(`${date}T${time}:00`).toISOString();

    const { error: dbError } = await locals.supabase
      .from('events')
      .update({ title, starts_at, location, category: finalCategory })
      .eq('id', params.id)
      .eq('user_id', locals.user.id);

    if (dbError) return fail(500, { error: dbError.message });
    throw redirect(303, '/dashboard/eventos');
  },

  delete: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, '/login');
    await locals.supabase
      .from('events')
      .delete()
      .eq('id', params.id)
      .eq('user_id', locals.user.id);
    throw redirect(303, '/dashboard/eventos');
  }
};
