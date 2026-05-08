import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './services/agsk-ingestion/.env.local' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

console.log('URL:', url);
console.log('Key prefix:', key?.substring(0, 50) + '...');

const sb = createClient(url!, key!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Try to fetch data from agsk_standards table
(async () => {
  try {
    const { data, error, count } = await sb
      .from('agsk_standards')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Connected! Row count:', count);
      console.log('Data:', data);
    }
  } catch (e) {
    console.error('Exception:', e);
  }
})();
