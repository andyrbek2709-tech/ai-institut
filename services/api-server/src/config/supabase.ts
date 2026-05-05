import { createClient } from '@supabase/supabase-js';
import { env } from './environment.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anonClient: any = null;

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
    ) as any;
  }
  return adminClient;
}

export function getSupabaseAnon() {
  if (!anonClient) {
    anonClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    ) as any;
  }
  return anonClient;
}
