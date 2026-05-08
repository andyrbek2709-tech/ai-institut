#!/usr/bin/env node

/**
 * AGSK Initial Corpus Ingestion — Standalone CLI
 *
 * Usage:
 *   npx tsx src/bin/ingest-corpus.ts [--dry-run] [--no-embed]
 *
 * Ingests all PDF files from data/corpus/agsk/ into Supabase.
 * Full pipeline: parse → metadata → chunk → embed → store
 *
 * Flags:
 *   --dry-run      Skip Supabase operations, only parse/chunk (for validation)
 *   --no-embed     Skip embedding generation (faster, but chunks won't be indexed)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseAdmin } from '../services/supabase.js';
import { parsePDF } from '../parsers/pdf-parser.js';
import { extractMetadata } from '../processors/metadata-extractor.js';
import { chunkDocument } from '../processors/chunker.js';
import { embedTexts, EMBEDDING_DIMS } from '../processors/embedder.js';
import { buildParserDiagnostics, logDiagnosticsSummary } from '../utils/parser-diagnostics.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPUS_DIR = path.resolve(__dirname, '../../../../data/corpus/agsk');

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');
const NO_EMBED = process.argv.includes('--no-embed');

interface CorpusStats {
  files_processed: number;
  files_failed: number;
  total_chunks: number;
  total_embeddings: number;
  cache_hits: number;
  elapsed_ms: number;
  dry_run: boolean;
  results: Array<{
    filename: string;
    standard_id: string;
    status: 'success' | 'failed';
    chunks?: number;
    pages?: number;
    metadata?: Record<string, any>;
    embedding_dims?: number;
    error?: string;
  }>;
}

async function ingestPDF(filePath: string): Promise<{
  standard_id: string;
  chunks: number;
  pages: number;
  metadata: Record<string, any>;
  cache_hits: number;
  embedding_dims: number;
}> {
  const sb = getSupabaseAdmin();
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  logger.info({ filename, size_bytes: fileBuffer.length, dry_run: DRY_RUN }, '📄 Starting PDF ingestion');

  // ── 1. Create standards record ─────────────────────────────────────────
  let standardId = `std-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!DRY_RUN) {
    const { data: standard, error: stdErr } = await sb
      .from('agsk_standards')
      .insert({
        file_path: filePath,
        file_size_bytes: fileBuffer.length,
        standard_code: filename.replace('.pdf', ''), // placeholder, will be updated
        title: filename, // placeholder, will be updated
        language: 'en',
        status: 'processing',
        metadata: { placeholder: true },
      })
      .select('id')
      .single();

    if (stdErr || !standard) {
      throw new Error(`Failed to create standard record: ${stdErr?.message}`);
    }
    standardId = (standard as any).id;
    logger.debug({ standard_id: standardId }, 'Created standard record');
  } else {
    logger.debug({ standard_id: standardId }, '(DRY-RUN) Would create standard record');
  }

  try {
    // ── 2. Parse PDF ───────────────────────────────────────────────────
    const parsed = await parsePDF(fileBuffer);
    logger.info({ pages: parsed.page_count, words: parsed.word_count }, '✅ PDF parsed');

    // ── 3. Extract metadata ────────────────────────────────────────────
    const meta = extractMetadata(parsed.text_full, filename, parsed.metadata);
    logger.debug({ meta }, 'Metadata extracted');

    if (!DRY_RUN) {
      // Update standards record with extracted metadata
      const { error: updateErr } = await sb.from('agsk_standards').update({
        standard_code: meta.standard_code,
        title: meta.title,
        version: meta.version ?? null,
        year: meta.year ?? null,
        discipline: meta.discipline ?? null,
        organization: meta.organization ?? null,
        keywords: meta.keywords,
        page_count: parsed.page_count,
        metadata: {
          standard_code: meta.standard_code,
          title: meta.title,
          version: meta.version,
          year: meta.year,
          discipline: meta.discipline,
          organization: meta.organization,
          keywords: meta.keywords,
        },
      }).eq('id', standardId);

      if (updateErr) throw new Error(`Metadata update failed: ${updateErr.message}`);
    } else {
      logger.debug(
        { standard_code: meta.standard_code, title: meta.title, discipline: meta.discipline },
        '(DRY-RUN) Would update standard with metadata',
      );
    }

    // ── 4. Chunk ───────────────────────────────────────────────────────
    const chunks = chunkDocument(parsed, meta.standard_code, meta.version ?? '');
    logger.info({ chunk_count: chunks.length }, '✂️ Document chunked');

    // ── 4b. Parser diagnostics ──────────────────────────────────────────
    const diag = buildParserDiagnostics(parsed, chunks, filename, 'pdf-parse');
    logDiagnosticsSummary(diag, (msg) => logger.info(msg));

    // ── 5. Embed + Store (batched) ─────────────────────────────────────
    let cacheHits = 0;
    let embeddingDims = EMBEDDING_DIMS;

    if (!NO_EMBED) {
      const EMBEDDING_BATCH = 25; // Batch for OpenAI embeddings
      const DB_BATCH = 1; // Single-row inserts to avoid statement timeout on large docs
      const MAX_RETRIES = 5;
      const RETRY_BASE_MS = 2000;
      let chunksDone = 0;

      // First pass: embed all chunks in batches
      const embeddedChunks: Array<{
        chunk: any;
        embedding: number[];
        cache_hit: boolean;
      }> = [];

      for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH) {
        const batch = chunks.slice(start, start + EMBEDDING_BATCH);
        const texts = batch.map(c => c.content);
        const embeds = await embedTexts(texts);

        batch.forEach((chunk, i) => {
          embeddedChunks.push({
            chunk,
            embedding: embeds[i].embedding,
            cache_hit: embeds[i].cache_hit,
          });
        });

        cacheHits += embeds.filter(e => e.cache_hit).length;
        embeddingDims = embeds[0]?.embedding?.length ?? EMBEDDING_DIMS;

        const pct = Math.round((start / chunks.length) * 100);
        logger.debug({ embedded: embeddedChunks.length, total: chunks.length, pct }, '⏳ Embedded batch');
      }

      // Second pass: insert one row at a time (avoids Supabase statement timeout)
      if (!DRY_RUN) {
        for (let i = 0; i < embeddedChunks.length; i++) {
          const { chunk, embedding } = embeddedChunks[i];
          const row = {
            standard_id: standardId,
            org_id: null,
            content: chunk.content,
            content_tokens: chunk.content_tokens,
            embedding: embedding,
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
            chunk_index: i,
            total_chunks: chunks.length,
            chunk_version: 1,
          };

          let lastErr: any;
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const { error: insertErr } = await sb
                .from('agsk_chunks')
                .insert([row]);

              if (!insertErr) {
                lastErr = null;
                break;
              }
              lastErr = insertErr;
              if (attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
                logger.warn({ chunk_index: i, attempt, error: insertErr.message, retry_delay_ms: delay }, 'Insert failed, retrying...');
                await new Promise(r => setTimeout(r, delay));
              }
            } catch (err: any) {
              lastErr = err;
              if (attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
                logger.warn({ chunk_index: i, attempt, error: err.message, retry_delay_ms: delay }, 'Insert exception, retrying...');
                await new Promise(r => setTimeout(r, delay));
              }
            }
          }

          if (lastErr) throw new Error(`Chunk ${i} insert failed after ${MAX_RETRIES} retries: ${lastErr.message}`);

          chunksDone++;
          if (chunksDone % 50 === 0) {
            const pct = Math.round((chunksDone / chunks.length) * 100);
            logger.debug({ chunks_done: chunksDone, total: chunks.length, pct }, '⏳ Inserted chunks');
          }
        }
      } else {
        logger.debug({ chunk_count: embeddedChunks.length }, '(DRY-RUN) Would insert all chunks');
        chunksDone = embeddedChunks.length;
      }
    } else {
      logger.info('(--no-embed flag) Skipping embedding generation');
    }

    // ── 6. Finalize ────────────────────────────────────────────────────
    if (!DRY_RUN) {
      const { error: finalErr } = await sb.from('agsk_standards').update({
        status: 'ready',
        chunks_count: chunks.length,
      }).eq('id', standardId);

      if (finalErr) logger.warn({ err: finalErr }, '⚠️ Final update failed, but ingestion succeeded');
    } else {
      logger.debug({ chunks_count: chunks.length }, '(DRY-RUN) Would finalize standard');
    }

    logger.info(
      { standard_id: standardId, chunks: chunks.length, cache_hits: cacheHits },
      '✅ Ingestion complete',
    );

    return {
      standard_id: standardId,
      chunks: chunks.length,
      pages: parsed.page_count,
      metadata: meta,
      cache_hits: cacheHits,
      embedding_dims: embeddingDims,
    };
  } catch (err: any) {
    // Mark as failed
    if (!DRY_RUN) {
      try {
        await sb.from('agsk_standards')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', standardId);
      } catch (updateErr) {
        logger.warn('Could not mark standard as failed');
      }
    }

    throw err;
  }
}

async function main() {
  const startTime = Date.now();
  const stats: CorpusStats = {
    files_processed: 0,
    files_failed: 0,
    total_chunks: 0,
    total_embeddings: 0,
    cache_hits: 0,
    elapsed_ms: 0,
    dry_run: DRY_RUN,
    results: [],
  };

  const mode = DRY_RUN ? '🔍 DRY-RUN' : '🚀';
  logger.info({ corpus_dir: CORPUS_DIR, dry_run: DRY_RUN, no_embed: NO_EMBED }, `${mode} AGSK CORPUS INGESTION STARTED`);

  // Find all PDF files
  if (!fs.existsSync(CORPUS_DIR)) {
    logger.error({ corpus_dir: CORPUS_DIR }, '❌ Corpus directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .sort()
    .map(f => path.join(CORPUS_DIR, f));

  if (files.length === 0) {
    logger.error('❌ No PDF files found in corpus directory');
    process.exit(1);
  }

  logger.info({ file_count: files.length }, `📂 Found ${files.length} PDF file(s)`);

  // Process each file
  for (const file of files) {
    const filename = path.basename(file);
    try {
      const result = await ingestPDF(file);
      stats.files_processed++;
      stats.total_chunks += result.chunks;
      stats.total_embeddings += result.chunks; // 1:1 mapping
      stats.cache_hits += result.cache_hits;
      stats.results.push({
        filename,
        standard_id: result.standard_id,
        status: 'success',
        chunks: result.chunks,
        pages: result.pages,
        metadata: result.metadata,
        embedding_dims: result.embedding_dims,
      });
      logger.info({ filename }, `✅ File processed: ${filename}`);
    } catch (err: any) {
      stats.files_failed++;
      stats.results.push({
        filename,
        standard_id: '',
        status: 'failed',
        error: err.message,
      });
      logger.error({ filename, error: err.message }, `❌ File failed: ${filename}`);
    }
  }

  // Final report
  stats.elapsed_ms = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('📊 CORPUS INGESTION REPORT');
  if (DRY_RUN) console.log('(DRY-RUN MODE — No data persisted)');
  console.log('='.repeat(80));
  console.log(`✅ Files processed:     ${stats.files_processed}`);
  console.log(`❌ Files failed:        ${stats.files_failed}`);
  console.log(`📝 Total chunks:        ${stats.total_chunks}`);
  console.log(`🧮 Total embeddings:    ${stats.total_embeddings}${NO_EMBED ? ' (SKIPPED)' : ''}`);
  console.log(`⚡ Cache hits:          ${stats.cache_hits}`);
  console.log(`⏱️  Elapsed time:        ${(stats.elapsed_ms / 1000).toFixed(1)}s`);
  console.log('='.repeat(80));

  console.log('\n📋 INGESTION DETAILS:');
  for (const result of stats.results) {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`\n${status} ${result.filename}`);
    if (result.status === 'success') {
      console.log(`   Standard ID:  ${result.standard_id}`);
      console.log(`   Chunks:       ${result.chunks}`);
      console.log(`   Pages:        ${result.pages}`);
      console.log(`   Embeddings:   ${result.embedding_dims} dims${NO_EMBED ? ' (N/A)' : ''}`);
      console.log(`   Code:         ${result.metadata?.standard_code || 'N/A'}`);
      console.log(`   Title:        ${result.metadata?.title || 'N/A'}`);
      console.log(`   Discipline:   ${result.metadata?.discipline || 'N/A'}`);
      console.log(`   Organization: ${result.metadata?.organization || 'N/A'}`);
      console.log(`   Year:         ${result.metadata?.year || 'N/A'}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(80));

  if (stats.files_failed === 0) {
    console.log(`🎉 CORPUS INGESTION ${DRY_RUN ? 'VALIDATION' : 'SUCCESSFUL'}`);
    process.exit(0);
  } else {
    console.log('⚠️  CORPUS INGESTION COMPLETED WITH ERRORS');
    process.exit(1);
  }
}

main().catch(err => {
  logger.error({ err }, 'Fatal error in corpus ingestion');
  process.exit(1);
});
