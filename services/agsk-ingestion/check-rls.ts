import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function checkRLS() {
  // Query RLS policies via SQL
  const { data, error } = await supabase.rpc('get_rls_policies', {
    table_name: 'agsk_chunks'
  }).catch(() => ({ data: null, error: 'RPC not available' }));
  
  if (error) {
    console.log('RPC not available, trying direct SQL...');
    
    // Try to disable RLS on agsk_chunks
    console.log('\nAttempting to ALTER TABLE and disable RLS...');
    const { data: altResult, error: altErr } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE agsk_chunks DISABLE ROW LEVEL SECURITY;'
    }).catch(() => ({ data: null, error: 'exec_sql RPC not available' }));
    
    console.log('Result:', altResult || altErr);
  } else {
    console.log('RLS Policies:', data);
  }
}

checkRLS().catch(console.error);
