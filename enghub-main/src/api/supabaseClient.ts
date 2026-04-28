import { createClient } from '@supabase/supabase-js';

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';

let anonClient: any = null;
let adminClient: any = null;

// B11 fix: оба клиента создаются с разными storageKey + persistSession=false
// для admin (service_role не должен иметь session-state). Это убирает warning
// "Multiple GoTrueClient instances detected" в консоли.
export const getSupabaseAnonClient = () => {
  if (!anonClient) {
    anonClient = createClient(SURL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'enghub-anon-auth',
      },
    });
  }
  return anonClient;
};

export const getSupabaseAdminClient = () => {
  if (!adminClient) {
    adminClient = createClient(SURL, SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'enghub-admin-noauth',
      },
    });
  }
  return adminClient;
};

export const getSupabaseClient = getSupabaseAnonClient; // default export
