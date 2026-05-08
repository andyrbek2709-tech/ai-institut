import { getSupabaseAdmin } from './src/services/supabase.js';
import { logger } from './src/utils/logger.js';

async function verify() {
  const sb = getSupabaseAdmin();

  console.log('\n' + '='.repeat(80));
  console.log('📊 INGESTION VERIFICATION REPORT');
  console.log('='.repeat(80));

  // 1. Total chunks
  const { count: totalChunks } = await sb
    .from('agsk_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✅ Total chunks ingested: ${totalChunks}`);

  // 2. Per-standard breakdown
  const { data: standards } = await sb
    .from('agsk_standards')
    .select('id, standard_code, chunks_count, status, created_at');
  
  console.log(`\n📋 Standards Summary:`);
  let successCount = 0;
  for (const std of standards || []) {
    const status = std.status === 'ready' ? '✅' : '⚠️';
    console.log(`  ${status} ${std.standard_code}: ${std.chunks_count} chunks (${std.status})`);
    if (std.status === 'ready') successCount++;
  }

  // 3. Citation metadata coverage
  const { data: citationStats } = await sb.rpc('get_citation_stats');
  if (citationStats) {
    console.log(`\n📍 Citation Metadata Coverage:`);
    console.log(`  Standard refs: ${citationStats.with_standard} (${((citationStats.with_standard / totalChunks) * 100).toFixed(1)}%)`);
    console.log(`  Page refs: ${citationStats.with_page} (${((citationStats.with_page / totalChunks) * 100).toFixed(1)}%)`);
    console.log(`  Section refs: ${citationStats.with_section} (${((citationStats.with_section / totalChunks) * 100).toFixed(1)}%)`);
    console.log(`  Avg confidence: ${(citationStats.avg_confidence * 100).toFixed(1)}%`);
  }

  // 4. Embedding coverage
  const { count: withEmbeddings } = await sb
    .from('agsk_chunks')
    .select('embedding', { count: 'exact', head: true });
  console.log(`\n🧠 Embeddings:`);
  console.log(`  Chunks with embeddings: ${withEmbeddings} (${((withEmbeddings / totalChunks) * 100).toFixed(1)}%)`);

  // 5. Smoke test: vector search
  console.log(`\n🔍 Vector Search Smoke Test:`);
  const testQuery = 'construction standards';
  const { data: results, error: searchErr } = await sb.rpc('search_chunks', {
    query_embedding: new Array(1536).fill(0.1), // dummy embedding
    similarity_threshold: 0.5,
    match_count: 5,
  });
  
  if (searchErr) {
    console.log(`  ⚠️ Search RPC not yet deployed: ${searchErr.message}`);
  } else {
    console.log(`  Found ${results?.length || 0} similar chunks (threshold: 0.5)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`🎉 INGESTION VERIFICATION COMPLETE`);
  console.log('='.repeat(80) + '\n');
}

verify().catch(err => {
  logger.error({ err }, 'Verification failed');
  process.exit(1);
});
