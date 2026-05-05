import { createClient } from '@supabase/supabase-js';
import { env } from './environment.js';

let adminClient: ReturnType<typeof createClient> | null = null;
let anonClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return adminClient;
}

export function getSupabaseAnon() {
  if (!anonClient) {
    anonClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );
  }
  return anonClient;
}
