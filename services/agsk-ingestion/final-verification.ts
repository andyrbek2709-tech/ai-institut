import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function verify() {
  console.log('\n📊 FINAL INGESTION VERIFICATION REPORT');
  console.log('═'.repeat(80));
  
  // Standards
  const { data: standards } = await supabase
    .from('agsk_standards')
    .select('id, standard_code, year, chunks_count, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (standards && standards[0]) {
    const std = standards[0];
    console.log('\n✅ LAST INGESTION:');
    console.log(`   Standard: ${std.standard_code}`);
    console.log(`   Year: ${std.year}`);
    console.log(`   Chunks: ${std.chunks_count}`);
    console.log(`   Status: ${std.status}`);
    console.log(`   Timestamp: ${std.created_at}`);
  }
  
  // Chunks count
  const { count: totalChunks } = await supabase
    .from('agsk_chunks')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📝 TOTAL CHUNKS INGESTED: ${totalChunks ?? 0}`);
  
  // Standards summary
  const { data: allStds } = await supabase
    .from('agsk_standards')
    .select('standard_code, chunks_count, status')
    .order('standard_code');
  
  if (allStds && allStds.length > 0) {
    console.log('\n📄 STANDARDS SUMMARY:');
    const unique = new Map();
    for (const s of allStds) {
      if (!unique.has(s.standard_code)) {
        unique.set(s.standard_code, s);
      }
    }
    
    let totalChunksSum = 0;
    for (const [code, std] of unique) {
      console.log(`   ${code}: ${std.chunks_count} chunks (${std.status})`);
      totalChunksSum += std.chunks_count || 0;
    }
    console.log(`   TOTAL: ${totalChunksSum} chunks`);
  }
  
  // Sample chunks
  const { data: sampleChunks } = await supabase
    .from('agsk_chunks')
    .select('id, standard_id, content, citation_standard, citation_page')
    .limit(3);
  
  if (sampleChunks && sampleChunks.length > 0) {
    console.log('\n🔍 SAMPLE CHUNKS (first 3):');
    for (let i = 0; i < sampleChunks.length; i++) {
      const c = sampleChunks[i];
      console.log(`\n   Chunk ${i+1}:`);
      console.log(`   Content: "${c.content?.slice(0, 60)}..."`);
      console.log(`   Citation: ${c.citation_standard || 'N/A'}, Page ${c.citation_page || 'N/A'}`);
    }
  }
  
  // Citation metrics
  console.log('\n📋 CITATION QUALITY METRICS:');
  const { data: chunks } = await supabase
    .from('agsk_chunks')
    .select('citation_standard, citation_page, citation_document, citation_confidence')
    .limit(1000);
  
  if (chunks) {
    let withStandard = 0, withPage = 0, withDoc = 0;
    let confidenceSum = 0, confCount = 0;
    
    for (const c of chunks) {
      if (c.citation_standard) withStandard++;
      if (c.citation_page) withPage++;
      if (c.citation_document) withDoc++;
      if (c.citation_confidence) {
        confidenceSum += c.citation_confidence;
        confCount++;
      }
    }
    
    console.log(`   Chunks with standard ref: ${withStandard}/${chunks.length} (${(withStandard/chunks.length*100).toFixed(1)}%)`);
    console.log(`   Chunks with page ref: ${withPage}/${chunks.length} (${(withPage/chunks.length*100).toFixed(1)}%)`);
    console.log(`   Chunks with document ref: ${withDoc}/${chunks.length} (${(withDoc/chunks.length*100).toFixed(1)}%)`);
    console.log(`   Avg confidence: ${(confidenceSum/confCount).toFixed(3)}`);
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ INGESTION STATUS: ' + (totalChunks && totalChunks > 0 ? 'READY FOR RETRIEVAL' : 'PENDING'));
}

verify().catch(console.error);
