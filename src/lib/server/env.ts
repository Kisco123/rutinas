import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

/**
 * Helper centralizado de variables de entorno.
 *
 * Usamos `$env/dynamic/*` (no `static/*`) porque en Cloudflare Workers los secretos
 * solo existen en runtime, no en build time. Con `static/*` el build falla con
 * "Missing export" porque las variables aún no están definidas durante `npm run build`.
 *
 * Los `!` afirman no-null: si una de estas variables falta en runtime, la app
 * fallará en la primera llamada — preferible a fallar silenciosamente.
 */
export const env = {
  supabaseUrl: publicEnv.PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: publicEnv.PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: privateEnv.SUPABASE_SERVICE_ROLE_KEY!,
  anthropicApiKey: privateEnv.ANTHROPIC_API_KEY!,
  geminiApiKey: privateEnv.GEMINI_API_KEY!,
  groqApiKey: privateEnv.GROQ_API_KEY!
};
