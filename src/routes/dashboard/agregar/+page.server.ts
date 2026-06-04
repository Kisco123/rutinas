import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');
  return {};
};

export const actions: Actions = {
  createEvent: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const date = String(fd.get('date') ?? '');
    const time = String(fd.get('time') ?? '09:00');
    const location = String(fd.get('location') ?? '').trim() || null;
    const category = String(fd.get('category') ?? 'otro');

    if (!title || !date) return fail(400, { kind: 'event', error: 'Título y fecha son obligatorios.' });

    const validCategories = ['medico', 'familia', 'trabajo', 'personal', 'otro'];
    const finalCategory = validCategories.includes(category) ? category : 'otro';

    const starts_at = new Date(`${date}T${time}:00`).toISOString();

    const { error } = await locals.supabase.from('events').insert({
      user_id: locals.user.id,
      title,
      starts_at,
      location,
      category: finalCategory,
      source: 'manual'
    });
    if (error) return fail(500, { kind: 'event', error: error.message });
    return { kind: 'event', success: true };
  },

  createBill: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const amountStr = String(fd.get('amount') ?? '').trim();
    const due_date = String(fd.get('due_date') ?? '');
    const provider = String(fd.get('provider') ?? '').trim() || null;
    const recurrence = String(fd.get('recurrence') ?? 'none');

    if (!title || !due_date) return fail(400, { kind: 'bill', error: 'Título y fecha de vencimiento son obligatorios.' });

    const amount = amountStr ? Number(amountStr) : null;
    if (amount !== null && Number.isNaN(amount)) {
      return fail(400, { kind: 'bill', error: 'Importe inválido.' });
    }
    const validRecurrence = ['none', 'monthly', 'yearly'];
    const finalRecurrence = validRecurrence.includes(recurrence) ? recurrence : 'none';

    const { error } = await locals.supabase.from('bills').insert({
      user_id: locals.user.id,
      title,
      amount,
      due_date,
      provider,
      recurrence: finalRecurrence,
      source: 'manual'
    });
    if (error) return fail(500, { kind: 'bill', error: error.message });
    return { kind: 'bill', success: true };
  }
};
