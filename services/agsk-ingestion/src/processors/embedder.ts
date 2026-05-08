/**
 * Embedder — OpenAI text-embedding-3-small (1536 dims, LOCKED per architecture)
 *
 * Features:
 * - Batch processing (up to 100 texts per API call)
 * - SHA-256 content hash cache via agsk_embedding_cache table
 * - Exponential backoff on rate limit (429) errors
 * - Per-job progress tracking
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { getSupabaseAdmin } from '../services/supabase.js';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS  = 1536;
export const BATCH_SIZE      = 100;
const MAX_RETRIES            = 5;
const INITIAL_BACKOFF_MS     = 1000;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Cache lookup ──────────────────────────────────────────────────────────

async function lookupCache(hashes: string[]): Promise<Map<string, number[]>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('agsk_embedding_cache')
    .select('content_hash, embedding')
    .in('content_hash', hashes);

  const result = new Map<string, number[]>();
  for (const row of data ?? []) {
    // Supabase returns vector as a string "[0.1,0.2,...]"
    const vec = typeof row.embedding === 'string'
      ? JSON.parse(row.embedding)
      : row.embedding;
    result.set(row.content_hash, vec);
  }
  return result;
}

async function saveToCache(hash: string, embedding: number[]): Promise<void> {
  const sb = getSupabaseAdmin();
  // Use the RPC upsert function to handle concurrency
  await sb.rpc('agsk_upsert_embedding_cache', {
    p_content_hash: hash,
    p_embedding:    embedding,
    p_model:        EMBEDDING_MODEL,
  });
}

// ── OpenAI API call with retry ────────────────────────────────────────────

async function embedBatchViaAPI(texts: string[]): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    try {
      const response = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });
      return response.data.map(d => d.embedding);
    } catch (err: any) {
      attempt++;
      const is429 = err?.status === 429 || err?.code === 'rate_limit_exceeded';
      if (!is429 || attempt >= MAX_RETRIES) throw err;

      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      logger.warn({ attempt, backoff }, 'OpenAI rate limit hit, backing off');
      await sleep(backoff);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface EmbedResult {
  embedding:    number[];
  cache_hit:    boolean;
}

/**
 * Embed a batch of texts with cache lookup.
 * Returns an array aligned 1:1 with input texts.
 */
export async function embedTexts(texts: string[]): Promise<EmbedResult[]> {
  if (texts.length === 0) return [];

  const hashes = texts.map(contentHash);
  const cached  = await lookupCache(hashes);

  const results: EmbedResult[] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts:   string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const hit = cached.get(hashes[i]);
    if (hit) {
      results[i] = { embedding: hit, cache_hit: true };
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedTexts.length === 0) return results;

  // Process uncached in batches
  const apiResults: number[][] = [];
  for (let start = 0; start < uncachedTexts.length; start += BATCH_SIZE) {
    const batch = uncachedTexts.slice(start, start + BATCH_SIZE);
    logger.debug({ batch_size: batch.length, start }, 'Calling OpenAI embeddings API');
    const embeddings = await embedBatchViaAPI(batch);
    apiResults.push(...embeddings);
  }

  // Store newly computed embeddings in cache + fill results
  for (let j = 0; j < uncachedIndices.length; j++) {
    const i         = uncachedIndices[j];
    const embedding = apiResults[j];
    results[i]      = { embedding, cache_hit: false };
    // Fire-and-forget cache save (don't block ingestion pipeline)
    saveToCache(hashes[i], embedding).catch(err =>
      logger.warn({ err }, 'Failed to save embedding to cache')
    );
  }

  return results;
}

/**
 * Embed a single text (convenience wrapper).
 */
export async function embedSingle(text: string): Promise<EmbedResult> {
  const [result] = await embedTexts([text]);
  return result;
}
