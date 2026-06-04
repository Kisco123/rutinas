import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
  const userId = locals.user!.id;
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, eventsRes, billsRes, nextEventRes, summaryRes] = await Promise.all([
    locals.supabase.from('profiles').select('full_name, timezone').eq('id', userId).single(),
    locals.supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('starts_at', nowIso),
    locals.supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('paid', false)
      .gte('due_date', todayDate)
      .lte('due_date', in7Days),
    locals.supabase
      .from('events')
      .select('title, starts_at')
      .eq('user_id', userId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    fetch('/api/daily-summary')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  ]);

  return {
    profile: profileRes.data ?? { full_name: '', timezone: 'Europe/Madrid' },
    upcomingEventsCount: eventsRes.count ?? 0,
    upcomingBillsCount: billsRes.count ?? 0,
    nextEvent: nextEventRes.data,
    summary: summaryRes?.content ?? null
  };
};
