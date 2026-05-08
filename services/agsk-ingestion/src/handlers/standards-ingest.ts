/**
 * Main ingestion handler — orchestrates the full pipeline:
 * PDF download → parse → extract metadata → chunk → embed → store
 */

import { getSupabaseAdmin } from '../services/supabase.js';
import { parsePDF } from '../parsers/pdf-parser.js';
import { extractMetadata } from '../processors/metadata-extractor.js';
import { chunkDocument } from '../processors/chunker.js';
import { embedTexts, EMBEDDING_DIMS } from '../processors/embedder.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';
import type { IngestionJobMessage } from '../services/queue.js';

interface JobProgress {
  status:       string;
  progress_pct: number;
  chunks_total: number;
  chunks_done:  number;
  embeddings_cached: number;
  error_message?: string;
}

async function updateJob(jobId: string, update: Partial<JobProgress>): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('agsk_ingestion_jobs').update(update).eq('id', jobId);
}

async function updateStandard(standardId: string, update: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('agsk_standards').update(update).eq('id', standardId);
}

export async function handleStandardsIngest(
  msg: IngestionJobMessage,
  jobId: string,
): Promise<void> {
  const { standard_id, org_id, file_path, filename } = msg;
  const sb = getSupabaseAdmin();
  const startTime = Date.now();

  logger.info({ standard_id, job_id: jobId }, 'Ingestion job started');

  try {
    // ── 1. Download PDF from Supabase Storage ──────────────────────────
    await updateJob(jobId, { status: 'parsing', progress_pct: 5 });
    await updateStandard(standard_id, { status: 'processing' });

    const { data: fileData, error: dlErr } = await sb.storage
      .from(env.STORAGE_BUCKET)
      .download(file_path);

    if (dlErr || !fileData) {
      throw new Error(`Storage download failed: ${dlErr?.message ?? 'no data'}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    logger.debug({ size_bytes: buffer.length }, 'PDF downloaded');

    // ── 2. Parse PDF ───────────────────────────────────────────────────
    const parsed = await parsePDF(buffer);
    logger.info({ pages: parsed.page_count, words: parsed.word_count }, 'PDF parsed');

    // ── 3. Extract metadata ────────────────────────────────────────────
    await updateJob(jobId, { progress_pct: 20 });

    const meta = extractMetadata(parsed.text_full, filename, parsed.metadata);
    logger.debug({ meta }, 'Metadata extracted');

    // Update standards record with extracted metadata
    await updateStandard(standard_id, {
      standard_code: meta.standard_code,
      title:         meta.title,
      version:       meta.version ?? null,
      year:          meta.year ?? null,
      discipline:    meta.discipline ?? null,
      organization:  meta.organization ?? null,
      keywords:      meta.keywords,
      page_count:    parsed.page_count,
    });

    // ── 4. Chunk ───────────────────────────────────────────────────────
    await updateJob(jobId, { status: 'chunking', progress_pct: 30 });

    const chunks = chunkDocument(parsed, meta.standard_code, meta.version ?? '');
    logger.info({ chunk_count: chunks.length }, 'Document chunked');

    await updateJob(jobId, {
      chunks_total: chunks.length,
      progress_pct: 40,
    });

    // ── 5. Embed + Store (batched) ─────────────────────────────────────
    await updateJob(jobId, { status: 'embedding', progress_pct: 45 });

    const INGEST_BATCH = 50;
    let chunksDone     = 0;
    let cacheHits      = 0;

    for (let start = 0; start < chunks.length; start += INGEST_BATCH) {
      const batch  = chunks.slice(start, start + INGEST_BATCH);
      const texts  = batch.map(c => c.content);
      const embeds = await embedTexts(texts);

      const rows = batch.map((chunk, i) => ({
        standard_id:         standard_id,
        org_id:              org_id,
        content:             chunk.content,
        content_tokens:      chunk.content_tokens,
        embedding:           embeds[i].embedding,
        section_path:        chunk.section_path,
        section_title:       chunk.section_title,
        subsection_title:    chunk.subsection_title,
        page_start:          chunk.page_start,
        page_end:            chunk.page_end,
        citation_document:   chunk.citation_document,
        citation_standard:   chunk.citation_standard,
        citation_section:    chunk.citation_section,
        citation_page:       chunk.citation_page,
        citation_version:    chunk.citation_version,
        citation_confidence: chunk.citation_confidence,
        chunk_index:         start + i,
        total_chunks:        chunks.length,
        chunk_version:       1,
      }));

      const { error: insertErr } = await sb
        .from('agsk_chunks')
        .insert(rows);

      if (insertErr) throw new Error(`Chunk insert failed: ${insertErr.message}`);

      chunksDone += batch.length;
      cacheHits  += embeds.filter(e => e.cache_hit).length;

      const pct = 45 + Math.round((chunksDone / chunks.length) * 50);
      await updateJob(jobId, {
        chunks_done:       chunksDone,
        embeddings_cached: cacheHits,
        progress_pct:      pct,
      });

      logger.debug({ chunksDone, total: chunks.length }, 'Batch embedded and stored');
    }

    // ── 6. Finalize ────────────────────────────────────────────────────
    await updateJob(jobId, {
      status:       'done',
      progress_pct: 100,
      finished_at:  new Date().toISOString(),
    });

    await updateStandard(standard_id, {
      status:       'ready',
      chunks_count: chunks.length,
    });

    const elapsed = Date.now() - startTime;
    logger.info(
      { standard_id, chunks: chunks.length, cache_hits: cacheHits, elapsed_ms: elapsed },
      'Ingestion job completed',
    );

  } catch (err: any) {
    logger.error({ err, standard_id, job_id: jobId }, 'Ingestion job failed');

    await updateJob(jobId, {
      status:        'failed',
      error_message: err.message ?? String(err),
    }).catch(() => {});

    await updateStandard(standard_id, {
      status:        'failed',
      error_message: err.message ?? String(err),
    }).catch(() => {});

    throw err;
  }
}
