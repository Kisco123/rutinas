import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGroqClient } from '$lib/server/groq';
import { generateDailySummary, fallbackSummary, type SummaryContext } from '$lib/server/daily-summary';

const CACHE_FRESH_MINUTES = 240;

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'No autenticado');

  const userId = locals.user.id;
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: cached } = await locals.supabase
    .from('daily_summaries')
    .select('content, generated_at')
    .eq('user_id', userId)
    .eq('date', todayIso)
    .maybeSingle();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.generated_at).getTime();
    if (ageMs < CACHE_FRESH_MINUTES * 60 * 1000) {
      return json({ content: cached.content, cached: true });
    }
  }

  const nowIso = new Date().toISOString();
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, eventsRes, billsRes] = await Promise.all([
    locals.supabase.from('profiles').select('full_name').eq('id', userId).single(),
    locals.supabase
      .from('events')
      .select('title, starts_at, location, category')
      .eq('user_id', userId)
      .gte('starts_at', nowIso)
      .lte('starts_at', in7Days)
      .order('starts_at', { ascending: true })
      .limit(20),
    locals.supabase
      .from('bills')
      .select('title, amount, currency, due_date, paid')
      .eq('user_id', userId)
      .gte('due_date', todayIso)
      .lte('due_date', in14Days)
      .order('due_date', { ascending: true })
      .limit(20)
  ]);

  const ctx: SummaryContext = {
    fullName: profileRes.data?.full_name ?? null,
    events: eventsRes.data ?? [],
    bills: billsRes.data ?? []
  };

  let content: string;
  try {
    content = await generateDailySummary(getGroqClient(), ctx, todayIso);
    if (!content || content.length < 5) content = fallbackSummary(ctx);
  } catch (err) {
    console.error('daily-summary generation failed:', err);
    content = fallbackSummary(ctx);
  }

  await locals.supabase
    .from('daily_summaries')
    .upsert(
      { user_id: userId, date: todayIso, content, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  return json({ content, cached: false });
};
