import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGeminiClient } from '$lib/server/gemini';
import { parseIntent } from '$lib/server/parse-intent';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    throw error(400, 'Falta el campo "text"');
  }

  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('timezone')
    .eq('id', locals.user.id)
    .single();

  const timezone = profile?.timezone ?? 'Europe/Madrid';
  const nowIso = new Date().toISOString();

  const result = await parseIntent(getGeminiClient(), body.text, nowIso, timezone);

  return json(result);
};
