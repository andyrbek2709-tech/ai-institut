import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function clean() {
  console.log('Cleaning up old ingestion records...');
  
  // Delete chunks
  const { count: chunksDeleted } = await supabase
    .from('agsk_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log(`✅ Deleted ${chunksDeleted} chunks`);
  
  // Delete standards
  const { count: stdsDeleted } = await supabase
    .from('agsk_standards')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log(`✅ Deleted ${stdsDeleted} standards`);
  
  // Clear cache
  const { count: cacheDeleted } = await supabase
    .from('agsk_embedding_cache')
    .delete()
    .neq('content_hash', 'impossible');
  
  console.log(`✅ Deleted ${cacheDeleted} cache entries`);
  
  console.log('\n✅ Database cleaned. Ready for fresh ingestion.');
}

clean().catch(console.error);
