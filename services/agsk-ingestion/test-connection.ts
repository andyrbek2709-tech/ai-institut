import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', SUPABASE_URL);
console.log('Key length:', SUPABASE_SERVICE_KEY?.length || 0);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test connection
async function testConnection() {
  try {
    console.log('Attempting to fetch agsk_standards table...');
    const { data, error, status } = await supabase
      .from('agsk_standards')
      .select('*')
      .limit(1);
    
    console.log('Status:', status);
    console.log('Error:', error);
    console.log('Data:', data);
    
    if (error) {
      console.error('Connection failed:', error);
      process.exit(1);
    }
    console.log('✅ Connection successful!');
  } catch (e) {
    console.error('Exception:', e);
    process.exit(1);
  }
}

testConnection();
