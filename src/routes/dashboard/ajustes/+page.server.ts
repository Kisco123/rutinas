import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session || !locals.user) throw redirect(303, '/login');

  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('full_name, timezone, locale')
    .eq('id', locals.user.id)
    .single();

  return {
    profile: profile ?? { full_name: '', timezone: 'Europe/Madrid', locale: 'es' }
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');

    const formData = await request.formData();
    const fullName = String(formData.get('full_name') ?? '').trim();
    const timezone = String(formData.get('timezone') ?? '').trim() || 'Europe/Madrid';

    const { error } = await locals.supabase
      .from('profiles')
      .update({ full_name: fullName, timezone })
      .eq('id', locals.user.id);

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true };
  }
};
