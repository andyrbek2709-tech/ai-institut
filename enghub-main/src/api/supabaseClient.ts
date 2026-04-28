import { createClient } from '@supabase/supabase-js';

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';

let anonClient: any = null;
let adminClient: any = null;

export const getSupabaseAnonClient = () => {
  if (!anonClient) {
    anonClient = createClient(SURL, ANON_KEY);
  }
  return anonClient;
};

export const getSupabaseAdminClient = () => {
  if (!adminClient) {
    adminClient = createClient(SURL, SERVICE_KEY);
  }
  return adminClient;
};

export const getSupabaseClient = getSupabaseAnonClient; // default export
