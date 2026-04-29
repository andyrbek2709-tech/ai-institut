import { createClient } from '@supabase/supabase-js';

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

let anonClient: any = null;

// SECURITY: admin-клиент УДАЛЁН из браузера. Все admin-операции через /api/*.
// Если коду нужен service_role — это запрос на серверную функцию, не на клиент.
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

// Backward-compat: getSupabaseAdminClient/getSupabaseClient теперь возвращают anon-клиента.
// Любая старая страница, ходившая через admin, перестанет байпасить RLS — это и нужно.
export const getSupabaseAdminClient = getSupabaseAnonClient;
export const getSupabaseClient = getSupabaseAnonClient;
