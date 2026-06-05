import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const { data: bill } = await locals.supabase
    .from('bills')
    .select('id, title, amount, currency, due_date, paid, recurrence, provider, notes')
    .eq('id', params.id)
    .eq('user_id', locals.user.id)
    .single();

  if (!bill) throw error(404, 'Factura no encontrada');

  return { bill };
};

export const actions: Actions = {
  update: async ({ request, locals, params }) => {
    if (!locals.user) throw redirect(303, '/login');

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const amountStr = String(fd.get('amount') ?? '').trim();
    const due_date = String(fd.get('due_date') ?? '');
    const provider = String(fd.get('provider') ?? '').trim() || null;
    const recurrence = String(fd.get('recurrence') ?? 'none');
    const paid = fd.get('paid') === 'on';

    if (!title || !due_date) return fail(400, { error: 'Título y vencimiento son obligatorios.' });

    const amount = amountStr ? Number(amountStr) : null;
    if (amount !== null && Number.isNaN(amount)) return fail(400, { error: 'Importe inválido.' });

    const validRecurrence = ['none', 'monthly', 'yearly'];
    const finalRecurrence = validRecurrence.includes(recurrence) ? recurrence : 'none';

    const { error: dbError } = await locals.supabase
      .from('bills')
      .update({ title, amount, due_date, provider, recurrence: finalRecurrence, paid })
      .eq('id', params.id)
      .eq('user_id', locals.user.id);

    if (dbError) return fail(500, { error: dbError.message });
    throw redirect(303, '/dashboard/facturas');
  },

  delete: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, '/login');
    await locals.supabase
      .from('bills')
      .delete()
      .eq('id', params.id)
      .eq('user_id', locals.user.id);
    throw redirect(303, '/dashboard/facturas');
  }
};
