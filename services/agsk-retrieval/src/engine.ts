/**
 * AGSK Hybrid Retrieval Engine
 *
 * Strategy (LOCKED per architecture):
 *   Step 1: BM25 keyword search (PostgreSQL FTS, top 20)
 *   Step 2: Vector similarity search (pgvector HNSW, top 20)
 *   Step 3: RRF fusion → deduplicate → return top N
 *
 * Weights: vector=0.7, bm25=0.3 (empirically best for engineering standards)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type {
  SearchRequest,
  SearchResponse,
  RetrievedChunk,
  Citation,
} from './types.js';

export const EMBEDDING_MODEL = 'text-embedding-3-small';

// ── Configuration ─────────────────────────────────────────────────────────

export interface RetrievalEngineConfig {
  supabaseUrl:        string;
  supabaseServiceKey: string;
  openaiApiKey:       string;
}

// ── Engine ────────────────────────────────────────────────────────────────

export class RetrievalEngine {
  private sb:     SupabaseClient;
  private openai: OpenAI;

  constructor(config: RetrievalEngineConfig) {
    this.sb     = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  // ── Embed query ──────────────────────────────────────────────────────

  private async embedQuery(query: string): Promise<{ embedding: number[]; cache_hit: boolean }> {
    const crypto = await import('crypto');
    const hash   = crypto.createHash('sha256').update(query, 'utf8').digest('hex');

    // Check embedding cache
    const { data: cached } = await this.sb
      .from('agsk_embedding_cache')
      .select('embedding')
      .eq('content_hash', hash)
      .maybeSingle();

    if (cached?.embedding) {
      // Update hit count async
      this.sb.rpc('agsk_upsert_embedding_cache', {
        p_content_hash: hash,
        p_embedding:    cached.embedding,
      }).catch(() => {});

      const vec = typeof cached.embedding === 'string'
        ? JSON.parse(cached.embedding)
        : cached.embedding;
      return { embedding: vec, cache_hit: true };
    }

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const embedding = response.data[0].embedding;

    // Store in cache async
    this.sb.rpc('agsk_upsert_embedding_cache', {
      p_content_hash: hash,
      p_embedding:    embedding,
    }).catch(() => {});

    return { embedding, cache_hit: false };
  }

  // ── Hybrid search (primary path) ────────────────────────────────────

  private async hybridSearch(
    embedding:   number[],
    req:         SearchRequest,
    matchCount:  number,
  ): Promise<RetrievedChunk[]> {
    const { data, error } = await this.sb.rpc('agsk_hybrid_search', {
      p_query_embedding:  embedding,
      p_query_text:       req.query,
      p_org_id:           req.org_id,
      p_match_count:      matchCount,
      p_vector_weight:    0.7,
      p_bm25_weight:      0.3,
      p_discipline:       req.discipline ?? null,
      p_standard_code:    req.standard_code ?? null,
    });

    if (error) throw new Error(`Hybrid search RPC failed: ${error.message}`);

    return (data ?? []).map((row: any) => mapRow(row, 'hybrid'));
  }

  // ── Vector-only search ───────────────────────────────────────────────

  private async vectorSearch(
    embedding:   number[],
    req:         SearchRequest,
    matchCount:  number,
  ): Promise<RetrievedChunk[]> {
    const { data, error } = await this.sb.rpc('agsk_vector_search', {
      p_query_embedding:  embedding,
      p_org_id:           req.org_id,
      p_match_count:      matchCount,
      p_discipline:       req.discipline ?? null,
      p_standard_code:    req.standard_code ?? null,
      p_min_similarity:   req.min_similarity ?? 0.5,
    });

    if (error) throw new Error(`Vector search RPC failed: ${error.message}`);

    return (data ?? []).map((row: any) => mapRow(row, 'vector'));
  }

  // ── BM25-only search ─────────────────────────────────────────────────

  private async bm25Search(
    req:         SearchRequest,
    matchCount:  number,
  ): Promise<RetrievedChunk[]> {
    const { data, error } = await this.sb.rpc('agsk_bm25_search', {
      p_query_text:    req.query,
      p_org_id:        req.org_id,
      p_match_count:   matchCount,
      p_discipline:    req.discipline ?? null,
      p_standard_code: req.standard_code ?? null,
    });

    if (error) throw new Error(`BM25 search RPC failed: ${error.message}`);

    return (data ?? []).map((row: any) => mapRow(row, 'bm25'));
  }

  // ── Log retrieval ────────────────────────────────────────────────────

  private logRetrieval(
    req:           SearchRequest,
    chunks:        RetrievedChunk[],
    latency_ms:    number,
    cache_hit:     boolean,
    retrieval_type: string,
  ): void {
    this.sb.from('agsk_retrieval_logs').insert({
      user_id:               req.user_id ?? null,
      org_id:                req.org_id,
      query_text:            req.query,
      retrieval_type,
      result_count:          chunks.length,
      latency_ms,
      embedding_cache_hit:   cache_hit,
      discipline_filter:     req.discipline ?? null,
      standard_code_filter:  req.standard_code ?? null,
      retrieved_chunk_ids:   chunks.map(c => c.id),
    }).then().catch(() => {});
  }

  // ── Public search ────────────────────────────────────────────────────

  async search(req: SearchRequest): Promise<SearchResponse> {
    const start = Date.now();
    const limit = Math.min(req.limit ?? 5, 20);
    const mode  = req.retrieval_type ?? 'hybrid';

    let embedding: number[] | null = null;
    let cacheHit = false;

    // Only embed query if vector search is needed
    if (mode !== 'bm25') {
      const result  = await this.embedQuery(req.query);
      embedding     = result.embedding;
      cacheHit      = result.cache_hit;
    }

    let chunks: RetrievedChunk[];

    switch (mode) {
      case 'vector':
        chunks = await this.vectorSearch(embedding!, req, limit);
        break;
      case 'bm25':
        chunks = await this.bm25Search(req, limit);
        break;
      default:
        chunks = await this.hybridSearch(embedding!, req, limit);
    }

    const latency_ms = Date.now() - start;

    // Deduplicate citations (multiple chunks can reference the same standard+section)
    const citations = deduplicateCitations(chunks.map(c => c.citation));

    this.logRetrieval(req, chunks, latency_ms, cacheHit, mode);

    return {
      chunks,
      citations,
      query:          req.query,
      retrieval_type: mode,
      latency_ms,
      result_count:   chunks.length,
      embedding_cache_hit: cacheHit,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRow(row: any, mode: string): RetrievedChunk {
  const citation: Citation = {
    document:   row.citation_document ?? '',
    standard:   row.citation_standard ?? '',
    section:    row.citation_section  ?? '',
    page:       row.citation_page     ?? 0,
    version:    row.citation_version  ?? '',
    confidence: row.citation_confidence ?? 1.0,
  };

  return {
    id:            row.id,
    standard_id:   row.standard_id,
    content:       row.content,
    section_path:  row.section_path ?? [],
    section_title: row.section_title ?? '',
    page_start:    row.page_start ?? 0,
    citation,
    scores: {
      rrf:    row.rrf_score,
      vector: row.similarity,
      bm25:   row.bm25_rank,
    },
    vector_rank: row.vector_rank,
    bm25_rank:   row.bm25_rank,
  };
}

function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen  = new Set<string>();
  const result: Citation[] = [];
  for (const c of citations) {
    const key = `${c.standard}::${c.section}::${c.version}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }
  return result;
}
