import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

async function checkSchema() {
  // Get table info
  const { data: tables, error } = await supabase
    .from('agsk_chunks')
    .select('*')
    .limit(1);
  
  console.log('agsk_chunks columns (from sample row):');
  if (tables && tables.length > 0) {
    console.log(Object.keys(tables[0]));
  }
  
  // Check agsk_standards
  const { data: standards } = await supabase
    .from('agsk_standards')
    .select('*')
    .limit(1);
  
  if (standards && standards.length > 0) {
    console.log('\nagsk_standards sample:');
    console.log(standards[0]);
  }
}

checkSchema().catch(console.error);
