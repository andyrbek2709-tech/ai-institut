/**
 * Cross-encoder reranker for AGSK retrieval pipeline.
 *
 * Strategy (in priority order):
 *   1. Jina Reranker v2 API  — multilingual cross-encoder, REST API
 *   2. Cosine similarity fallback — reorders by embedding cosine score
 *      when Jina API is unavailable or JINA_API_KEY is not set
 *
 * Usage: call rerank(query, candidates, topK) after initial retrieval.
 * Input:  top-20 RRF candidates
 * Output: top-K reranked by cross-encoder relevance score
 *
 * Target: Precision@5 > 60% (up from 47.8% BM25+vector baseline).
 */

import { logger } from '../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface RerankCandidate {
  id:              string;
  content:         string;
  [key: string]:   unknown;  // pass-through for all other chunk fields
}

export interface RerankResult<T extends RerankCandidate> {
  item:             T;
  relevance_score:  number;  // 0.0–1.0
  reranker_rank:    number;  // 1-based
  reranker_type:    'jina' | 'cosine_fallback';
}

export interface RerankerMetrics {
  reranker_type:   'jina' | 'cosine_fallback';
  model:           string;
  latency_ms:      number;
  pre_count:       number;
  post_count:      number;
  api_available:   boolean;
}

// ── Jina Reranker API ────────────────────────────────────────────────────

const JINA_API_URL    = 'https://api.jina.ai/v1/rerank';
const JINA_MODEL      = 'jina-reranker-v2-base-multilingual';
const JINA_TIMEOUT_MS = 3000;  // hard timeout — fall back to cosine if exceeded

interface JinaRerankResponse {
  model:   string;
  results: Array<{
    index:           number;
    relevance_score: number;
  }>;
}

async function rerankViaJina<T extends RerankCandidate>(
  query:      string,
  candidates: T[],
  topK:       number,
  apiKey:     string,
): Promise<{ results: RerankResult<T>[]; metrics: RerankerMetrics } | null> {
  const t0 = Date.now();

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

    const response = await fetch(JINA_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        model:     JINA_MODEL,
        query,
        documents: candidates.map(c => c.content),
        top_n:     topK,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn({ status: response.status, body: text }, 'Jina reranker API error');
      return null;
    }

    const data: JinaRerankResponse = await response.json();

    const results: RerankResult<T>[] = data.results.map((r, rank) => ({
      item:            candidates[r.index],
      relevance_score: r.relevance_score,
      reranker_rank:   rank + 1,
      reranker_type:   'jina' as const,
    }));

    const latency_ms = Date.now() - t0;
    logger.debug({ latency_ms, count: results.length }, 'Jina reranker completed');

    return {
      results,
      metrics: {
        reranker_type: 'jina',
        model:         JINA_MODEL,
        latency_ms,
        pre_count:     candidates.length,
        post_count:    results.length,
        api_available: true,
      },
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    logger.warn({ err: isTimeout ? 'timeout' : err?.message }, 'Jina reranker unavailable');
    return null;
  }
}

// ── Cosine Similarity Fallback ────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Fallback reranker using cosine similarity between query embedding and
 * chunk embedding. Requires chunks to have an `embedding` field.
 * Less accurate than cross-encoder but always available.
 */
function rerankViaCosine<T extends RerankCandidate & { embedding?: number[] | null }>(
  queryEmbedding: number[],
  candidates:     T[],
  topK:           number,
): { results: RerankResult<T>[]; metrics: RerankerMetrics } {
  const t0 = Date.now();

  const scored = candidates
    .map(item => ({
      item,
      score: item.embedding ? cosineSimilarity(queryEmbedding, item.embedding) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const results: RerankResult<T>[] = scored.map((s, rank) => ({
    item:            s.item,
    relevance_score: Math.max(0, Math.min(1, (s.score + 1) / 2)),  // normalize [-1,1] → [0,1]
    reranker_rank:   rank + 1,
    reranker_type:   'cosine_fallback' as const,
  }));

  const latency_ms = Date.now() - t0;
  logger.debug({ latency_ms, count: results.length }, 'Cosine fallback reranker completed');

  return {
    results,
    metrics: {
      reranker_type: 'cosine_fallback',
      model:         'cosine_similarity',
      latency_ms,
      pre_count:     candidates.length,
      post_count:    results.length,
      api_available: false,
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Rerank top-N retrieval candidates to top-K using cross-encoder.
 *
 * @param query           - The search query text
 * @param candidates      - Retrieved candidates (typically top-20 from RRF)
 * @param topK            - Final result count (default: 5)
 * @param queryEmbedding  - Query vector for cosine fallback (optional)
 * @param jinaApiKey      - Jina API key (optional; uses env var JINA_API_KEY if omitted)
 */
export async function rerank<T extends RerankCandidate>(
  query:          string,
  candidates:     T[],
  topK:           number = 5,
  queryEmbedding: number[] | null = null,
  jinaApiKey?:    string,
): Promise<{ results: RerankResult<T>[]; metrics: RerankerMetrics }> {
  if (candidates.length === 0) {
    return {
      results: [],
      metrics: {
        reranker_type: 'jina',
        model:         JINA_MODEL,
        latency_ms:    0,
        pre_count:     0,
        post_count:    0,
        api_available: false,
      },
    };
  }

  if (candidates.length <= topK) {
    // No reranking needed — already within limit
    const results: RerankResult<T>[] = candidates.map((item, i) => ({
      item,
      relevance_score: 1.0 - i * 0.05,
      reranker_rank:   i + 1,
      reranker_type:   'cosine_fallback' as const,
    }));
    return {
      results,
      metrics: {
        reranker_type: 'cosine_fallback',
        model:         'passthrough',
        latency_ms:    0,
        pre_count:     candidates.length,
        post_count:    results.length,
        api_available: false,
      },
    };
  }

  // Try Jina first
  const key = jinaApiKey ?? process.env.JINA_API_KEY;
  if (key) {
    const jinaResult = await rerankViaJina(query, candidates, topK, key);
    if (jinaResult) return jinaResult;
  }

  // Fallback: cosine similarity
  const withEmbedding = candidates as (T & { embedding?: number[] | null })[];
  const hasEmbedding  = queryEmbedding && withEmbedding.some(c => c.embedding);

  if (hasEmbedding && queryEmbedding) {
    return rerankViaCosine(queryEmbedding, withEmbedding, topK);
  }

  // Last resort: return as-is truncated to topK (RRF order preserved)
  const results: RerankResult<T>[] = candidates.slice(0, topK).map((item, i) => ({
    item,
    relevance_score: 1.0 - i * (1.0 / topK),
    reranker_rank:   i + 1,
    reranker_type:   'cosine_fallback' as const,
  }));

  return {
    results,
    metrics: {
      reranker_type: 'cosine_fallback',
      model:         'rrf_passthrough',
      latency_ms:    0,
      pre_count:     candidates.length,
      post_count:    results.length,
      api_available: false,
    },
  };
}

/**
 * Quick precision estimate based on reranker scores.
 * Returns fraction of top-K results with score ≥ threshold.
 */
export function estimatePrecision(
  results:   RerankResult<RerankCandidate>[],
  threshold: number = 0.6,
): number {
  if (results.length === 0) return 0;
  const relevant = results.filter(r => r.relevance_score >= threshold).length;
  return relevant / results.length;
}
