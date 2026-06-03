import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Cliente con service_role. Bypasea RLS. Usar solo en endpoints +server.ts
 * para operaciones donde necesitamos saltarnos RLS (ej. oauth_tokens).
 * NUNCA exponer al navegador.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
