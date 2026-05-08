import * as fs from 'fs';
import { getSupabaseAdmin } from './src/services/supabase.js';
import { parsePDF } from './src/parsers/pdf-parser.js';
import { extractMetadata } from './src/processors/metadata-extractor.js';
import { chunkDocument } from './src/processors/chunker.js';
import { embedTexts } from './src/processors/embedder.js';

const filePath = 'd:/ai-institut/data/corpus/agsk/AGSK-1.pdf';
const sb = getSupabaseAdmin();

async function test() {
  console.log('Testing AGSK-1 ingestion...');
  
  const buffer = fs.readFileSync(filePath);
  const parsed = await parsePDF(buffer);
  console.log(`✅ Parsed: ${parsed.page_count} pages, ${parsed.word_count} words`);
  
  const meta = extractMetadata(parsed.text_full, 'AGSK-1.pdf', parsed.metadata);
  console.log(`✅ Metadata: ${meta.standard_code}, ${meta.year}`);
  
  const chunks = chunkDocument(parsed, meta.standard_code, '');
  console.log(`✅ Created ${chunks.length} chunks`);
  
  // Create standard
  const { data: std, error: stdErr } = await sb.from('agsk_standards').insert({
    file_path: filePath,
    file_size_bytes: buffer.length,
    standard_code: meta.standard_code,
    title: meta.title,
    year: meta.year,
    language: 'en',
    status: 'processing',
    metadata: meta,
  }).select('id').single();
  
  if (stdErr) throw new Error(`Standard insert: ${stdErr.message}`);
  
  const standardId = (std as any).id;
  console.log(`✅ Created standard: ${standardId}`);
  
  // Test insert with just 1 chunk
  const chunk = chunks[0];
  const textEmbed = await embedTexts([chunk.content]);
  
  const row = {
    standard_id: standardId,
    org_id: null,
    content: chunk.content,
    content_tokens: chunk.content_tokens,
    embedding: textEmbed[0].embedding,
    section_path: chunk.section_path,
    section_title: chunk.section_title,
    subsection_title: chunk.subsection_title,
    page_start: chunk.page_start,
    page_end: chunk.page_end,
    citation_document: chunk.citation_document,
    citation_standard: chunk.citation_standard,
    citation_section: chunk.citation_section,
    citation_page: chunk.citation_page,
    citation_version: chunk.citation_version,
    citation_confidence: chunk.citation_confidence,
    chunk_index: 0,
    total_chunks: chunks.length,
    chunk_version: 1,
  };
  
  console.log(`\nInserting test chunk...`);
  console.log(`  Standard ID: ${row.standard_id}`);
  console.log(`  Content length: ${row.content.length}`);
  console.log(`  Embedding dims: ${row.embedding.length}`);
  
  const { data: inserted, error: insertErr } = await sb
    .from('agsk_chunks')
    .insert(row)
    .select('id');
  
  if (insertErr) {
    console.error('❌ Insert failed:', insertErr);
    process.exit(1);
  }
  
  console.log(`✅ Insert succeeded!`);
  console.log(`   Inserted chunk ID: ${inserted?.[0]?.id}`);
  
  // Verify in DB
  const { data: verify, count } = await sb.from('agsk_chunks')
    .select('id', { count: 'exact' })
    .eq('standard_id', standardId);
  
  console.log(`\n✅ VERIFICATION: ${count} chunks in DB for standard ${meta.standard_code}`);
}

test().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
