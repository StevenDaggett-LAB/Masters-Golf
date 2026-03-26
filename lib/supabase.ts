import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function createSupabaseBrowserClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}

export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
