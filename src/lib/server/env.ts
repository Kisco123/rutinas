import { env as privateEnv } from '$env/dynamic/private';

/**
 * Helper centralizado de variables de entorno.
 *
 * Todo desde `$env/dynamic/private` porque:
 * - En Cloudflare Workers los secretos solo existen en runtime, no build time
 *   (con `$env/static/*` el build falla).
 * - `$env/dynamic/public` no resuelve fiablemente en Workers porque requiere
 *   que los valores estén disponibles también en build time.
 *
 * Usamos las vars sin prefijo `PUBLIC_` porque solo las leemos server-side.
 * Si en el futuro hiciera falta exponerlas al cliente, habría que renombrar
 * a `PUBLIC_*` y configurarlas también como build variables en Cloudflare.
 *
 * Los `!` afirman no-null: si falta una en runtime, la app falla rápido y claro.
 */
export const env = {
  supabaseUrl: privateEnv.SUPABASE_URL!,
  supabaseAnonKey: privateEnv.SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: privateEnv.SUPABASE_SERVICE_ROLE_KEY!,
  anthropicApiKey: privateEnv.ANTHROPIC_API_KEY!,
  geminiApiKey: privateEnv.GEMINI_API_KEY!,
  groqApiKey: privateEnv.GROQ_API_KEY!
};
