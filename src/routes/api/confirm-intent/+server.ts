import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw error(400, 'Body inválido');

  if (body.type === 'event') {
    const f = body.fields;
    if (!f?.title || !f?.starts_at) throw error(400, 'Faltan campos del evento');

    const { error: dbError } = await locals.supabase.from('events').insert({
      user_id: locals.user.id,
      title: f.title,
      description: f.description ?? null,
      starts_at: f.starts_at,
      ends_at: f.ends_at ?? null,
      location: f.location ?? null,
      category: f.category ?? 'otro',
      source: 'ai_text'
    });
    if (dbError) throw error(500, dbError.message);
    return json({ ok: true, kind: 'event' });
  }

  if (body.type === 'bill') {
    const f = body.fields;
    if (!f?.title || !f?.due_date) throw error(400, 'Faltan campos de la factura');

    const { error: dbError } = await locals.supabase.from('bills').insert({
      user_id: locals.user.id,
      title: f.title,
      amount: f.amount ?? null,
      currency: f.currency ?? 'EUR',
      due_date: f.due_date,
      provider: f.provider ?? null,
      recurrence: f.recurrence ?? 'none',
      notes: f.notes ?? null,
      source: 'ai_text'
    });
    if (dbError) throw error(500, dbError.message);
    return json({ ok: true, kind: 'bill' });
  }

  throw error(400, 'Tipo no soportado');
};
