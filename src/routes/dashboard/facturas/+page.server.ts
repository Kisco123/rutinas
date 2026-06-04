import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const filter = url.searchParams.get('filter') ?? 'pending';

  let query = locals.supabase
    .from('bills')
    .select('id, title, amount, currency, due_date, paid, recurrence, provider')
    .eq('user_id', locals.user.id);

  if (filter === 'pending') query = query.eq('paid', false).order('due_date', { ascending: true });
  else if (filter === 'paid') query = query.eq('paid', true).order('due_date', { ascending: false });
  else query = query.order('due_date', { ascending: false });

  const { data: bills } = await query;
  return { bills: bills ?? [], filter };
};

export const actions: Actions = {
  togglePaid: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const paid = fd.get('paid') === 'true';
    if (!id) return { success: false };
    await locals.supabase
      .from('bills')
      .update({ paid: !paid })
      .eq('id', id)
      .eq('user_id', locals.user.id);
    return { success: true };
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    if (!id) return { success: false };
    await locals.supabase.from('bills').delete().eq('id', id).eq('user_id', locals.user.id);
    return { success: true };
  }
};
