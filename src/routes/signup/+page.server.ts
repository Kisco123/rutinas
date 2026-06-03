import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.session) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const formData = await request.formData();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const fullName = String(formData.get('full_name') ?? '').trim();

    if (!email || !password) {
      return fail(400, { email, fullName, error: 'Email y contraseña son obligatorios.' });
    }
    if (password.length < 8) {
      return fail(400, { email, fullName, error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const { error } = await locals.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${url.origin}/login`
      }
    });

    if (error) {
      return fail(400, { email, fullName, error: error.message });
    }

    return { success: true, email };
  }
};
