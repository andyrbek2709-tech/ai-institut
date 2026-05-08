import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Direct SQL count
  const { data: result, error } = await supabase.rpc('agsk_get_stats');
  console.log('RPC result:', result);
  console.log('Error:', error);
  
  // Try direct select
  const { data: chunks, error: selectErr, count } = await supabase
    .from('agsk_chunks')
    .select('id', { count: 'exact' });
  
  console.log('\nDirect select:');
  console.log('Count:', count);
  console.log('Error:', selectErr);
  
  // Check if table exists and has schema
  const { data: schema } = await supabase
    .from('agsk_chunks')
    .select('*')
    .limit(1);
  
  if (schema && schema.length > 0) {
    console.log('\nTable exists with columns:');
    console.log(Object.keys(schema[0]));
  } else {
    console.log('\nTable is empty or no SELECT permission');
  }
}

check().catch(console.error);
