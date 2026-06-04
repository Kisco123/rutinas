import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import {
  SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY
} from '$env/static/private';

export const env = {
  supabaseUrl: PUBLIC_SUPABASE_URL,
  supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY
};
