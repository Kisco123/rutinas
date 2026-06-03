import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('full_name, timezone')
    .eq('id', locals.user!.id)
    .single();

  return {
    profile: profile ?? { full_name: '', timezone: 'Europe/Madrid' }
  };
};
