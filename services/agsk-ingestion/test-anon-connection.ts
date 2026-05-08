import { createClient } from '@supabase/supabase-js';

const url = 'https://inachjylaqelysiwtsux.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluYWNoanlsYXFlbHlzaXd0c3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTYxNDgsImV4cCI6MjA5MzU5MjE0OH0.dXSytLyghdVOFJomfGQ8R9MXWfqPAPIRFcxe2NCyo5g';

console.log('Testing with ANON key...');
const sb = createClient(url, anonKey);

(async () => {
  try {
    const { data, error, count } = await sb
      .from('agsk_standards')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log('✅ Anon key works! Row count:', count);
    }
  } catch (e: any) {
    console.error('Exception:', e.message);
  }
})();
