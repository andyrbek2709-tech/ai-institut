/**
 * AGSK API routes
 *
 * POST /api/agsk/upload        — upload PDF + enqueue ingestion job
 * POST /api/agsk/search        — hybrid retrieval (BM25 + vector + RRF)
 * GET  /api/agsk/standards     — list standards for the caller's org
 * GET  /api/agsk/status/:id    — ingestion job status
 * POST /api/agsk/feedback      — submit chunk relevance feedback
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import OpenAI from 'openai';
import { rerank } from '../../../services/agsk-ingestion/src/processors/reranker.js';

const router = Router();

// ── Lazy OpenAI client ────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openai;
}

// ── Embed query with cache ────────────────────────────────────────────────

async function embedQuery(query: string): Promise<{ embedding: number[]; cache_hit: boolean }> {
  const sb   = getSupabaseAdmin();
  const hash = createHash('sha256').update(query, 'utf8').digest('hex');

  const { data: cached } = await sb
    .from('agsk_embedding_cache')
    .select('embedding')
    .eq('content_hash', hash)
    .maybeSingle();

  if (cached?.embedding) {
    const vec = typeof cached.embedding === 'string'
      ? JSON.parse(cached.embedding as string)
      : cached.embedding;
    return { embedding: vec, cache_hit: true };
  }

  const resp = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const embedding = resp.data[0].embedding;

  sb.rpc('agsk_upsert_embedding_cache', {
    p_content_hash: hash,
    p_embedding:    embedding,
  }).catch(() => {});

  return { embedding, cache_hit: false };
}

// ── Helper: resolve caller's org_id ──────────────────────────────────────

async function getOrgId(supabaseUid: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('app_users')
    .select('org_id')
    .eq('supabase_uid', supabaseUid)
    .maybeSingle();
  return (data as any)?.org_id ?? null;
}

// ── Citation type (LOCKED SCHEMA) ────────────────────────────────────────

interface Citation {
  document:   string;
  standard:   string;
  section:    string;
  page:       number;
  version:    string;
  confidence: number;
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/agsk/upload
// Body: { file_path, filename, standard_code?, title?, file_size_bytes? }
// Caller uploads the PDF to Supabase Storage first, then calls this endpoint.
// ══════════════════════════════════════════════════════════════════════════

router.post(
  '/agsk/upload',
  authMiddleware,
  requireRole(['admin', 'gip']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { file_path, filename, standard_code, title, file_size_bytes } = req.body;

      if (!file_path || !filename) {
        return next(new ApiError(400, 'file_path and filename are required'));
      }

      const sb     = getSupabaseAdmin();
      const userId = req.user!.id;
      const orgId  = await getOrgId(userId);

      if (!orgId) return next(new ApiError(403, 'User has no associated organisation'));

      const { data: std, error: stdErr } = await sb
        .from('agsk_standards')
        .insert({
          org_id:          orgId,
          uploaded_by:     userId,
          standard_code:   standard_code ?? filename.replace(/\.[^.]+$/, '').toUpperCase(),
          title:           title ?? filename,
          file_path,
          file_size_bytes: file_size_bytes ?? null,
          status:          'pending',
        })
        .select('id')
        .single();

      if (stdErr) throw new Error(stdErr.message);

      const standardId = (std as any).id as string;
      const jobId      = randomUUID();

      await sb.from('agsk_ingestion_jobs').insert({
        id:          jobId,
        standard_id: standardId,
        org_id:      orgId,
        status:      'queued',
      });

      const redis = getRedisClient();
      await redis.xadd(
        'agsk-ingestion-jobs', '*',
        'job_id',      jobId,
        'standard_id', standardId,
        'org_id',      orgId,
        'file_path',   file_path,
        'filename',    filename,
        'user_id',     userId,
        'timestamp',   Date.now().toString(),
      );

      logger.info({ standard_id: standardId, job_id: jobId }, 'AGSK ingestion job enqueued');

      res.status(202).json({
        standard_id: standardId,
        job_id:      jobId,
        status:      'queued',
        message:     'Ingestion job queued. Poll /api/agsk/status/:id for progress.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════
// POST /api/agsk/search
// Body: {
//   query,
//   limit? (default 5, max 20),
//   discipline?,
//   standard_code?,
//   retrieval_type? ('hybrid' | 'vector' | 'bm25'),
//   version_year?,
//   version_latest_only? (default true),
//   enable_reranking? (default true)
// }
// ══════════════════════════════════════════════════════════════════════════

router.post(
  '/agsk/search',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        query,
        limit               = 5,
        discipline,
        standard_code,
        retrieval_type      = 'hybrid',
        min_similarity,
        version_year,
        version_latest_only = true,
        enable_reranking    = true,
      } = req.body;

      if (!query || String(query).trim().length < 3) {
        return next(new ApiError(400, 'query must be at least 3 characters'));
      }

      const validTypes = ['hybrid', 'vector', 'bm25'];
      if (!validTypes.includes(retrieval_type)) {
        return next(new ApiError(400, `retrieval_type must be one of: ${validTypes.join(', ')}`));
      }

      const orgId = await getOrgId(req.user!.id);
      if (!orgId) return next(new ApiError(403, 'User has no associated organisation'));

      const finalLimit = Math.min(Math.max(1, Number(limit) || 5), 20);
      const q          = String(query).trim();
      const sb         = getSupabaseAdmin();
      const start      = Date.now();

      let embedding: number[] | null = null;
      let cacheHit = false;

      if (retrieval_type !== 'bm25') {
        const emb = await embedQuery(q);
        embedding = emb.embedding;
        cacheHit  = emb.cache_hit;
      }

      // Retrieve top-20 candidates (pre-reranking)
      const preRerankLimit = Math.min(finalLimit * 4, 20); // up to top-20 for reranking

      let chunks: any[] = [];
      let rerankMetrics: any = null;

      if (retrieval_type === 'hybrid') {
        const { data, error } = await sb.rpc('agsk_hybrid_search_v2', {
          p_query: q,
          p_query_embedding: embedding,
          p_org_id:          orgId,
          p_limit:           preRerankLimit,
          p_vector_weight:   0.7,
          p_bm25_weight:     0.3,
          p_discipline:      discipline ?? null,
          p_standard_code:   standard_code ?? null,
          p_version_year:    version_year ?? null,
          p_version_latest_only: version_latest_only,
        });
        if (error) throw new Error(error.message);
        chunks = data ?? [];

      } else if (retrieval_type === 'vector') {
        const { data, error } = await sb.rpc('agsk_vector_search_v2', {
          p_query_embedding: embedding,
          p_org_id:          orgId,
          p_limit:           preRerankLimit,
          p_discipline:      discipline ?? null,
          p_standard_code:   standard_code ?? null,
          p_version_year:    version_year ?? null,
          p_version_latest_only: version_latest_only,
          p_min_similarity:  min_similarity ?? 0.5,
        });
        if (error) throw new Error(error.message);
        chunks = data ?? [];

      } else {
        const { data, error } = await sb.rpc('agsk_bm25_search_v2', {
          p_query:    q,
          p_org_id:   orgId,
          p_limit:    preRerankLimit,
          p_discipline:      discipline ?? null,
          p_standard_code:   standard_code ?? null,
          p_version_year:    version_year ?? null,
          p_version_latest_only: version_latest_only,
        });
        if (error) throw new Error(error.message);
        chunks = data ?? [];
      }

      // Apply reranking if enabled and we have candidates
      if (enable_reranking && chunks.length > 0) {
        try {
          const rerankResult = await rerank(q, chunks, finalLimit, embedding, env.JINA_API_KEY);
          rerankMetrics = rerankResult.metrics;
          chunks = rerankResult.results.map((r: any) => r.item);
        } catch (rerankErr) {
          logger.warn({ err: rerankErr }, 'Reranking failed, using retrieval order');
          chunks = chunks.slice(0, finalLimit);
        }
      } else {
        chunks = chunks.slice(0, finalLimit);
      }

      const latency_ms = Date.now() - start;

      // Build citation objects (LOCKED SCHEMA)
      const allCitations: Citation[] = chunks.map(c => ({
        document:   c.citation_document ?? '',
        standard:   c.citation_standard ?? '',
        section:    c.citation_section  ?? '',
        page:       c.citation_page     ?? 0,
        version:    c.citation_version  ?? '',
        confidence: c.citation_confidence ?? 1.0,
      }));

      // Deduplicate citations
      const seen = new Set<string>();
      const citations = allCitations.filter(c => {
        const key = `${c.standard}::${c.section}::${c.version}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Log retrieval async
      sb.from('agsk_retrieval_logs').insert({
        user_id:              req.user!.id,
        org_id:               orgId,
        query_text:           q,
        retrieval_type,
        result_count:         chunks.length,
        latency_ms,
        embedding_cache_hit:  cacheHit,
        discipline_filter:    discipline ?? null,
        standard_code_filter: standard_code ?? null,
        version_filter:       version_year ?? null,
        version_latest_only:  version_latest_only,
        reranker_type:        rerankMetrics?.reranker_type ?? null,
        reranker_latency_ms:  rerankMetrics?.latency_ms ?? null,
        retrieved_chunk_ids:  chunks.map((c: any) => c.id),
      }).then().catch(() => {});

      res.json({
        chunks,
        citations,
        query:                q,
        retrieval_type,
        latency_ms,
        result_count:         chunks.length,
        embedding_cache_hit:  cacheHit,
        version_filter:       { year: version_year, latest_only: version_latest_only },
        reranker:             rerankMetrics || null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════
// GET /api/agsk/standards
// Query: ?discipline=&status=ready&page=1&limit=20
// ══════════════════════════════════════════════════════════════════════════

router.get(
  '/agsk/standards',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = await getOrgId(req.user!.id);
      if (!orgId) return next(new ApiError(403, 'User has no associated organisation'));

      const sb         = getSupabaseAdmin();
      const discipline = req.query.discipline as string | undefined;
      const status     = (req.query.status as string) ?? 'ready';
      const page       = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit      = Math.min(100, parseInt(req.query.limit as string || '20', 10));
      const offset     = (page - 1) * limit;

      let q = sb
        .from('agsk_standards')
        .select(
          'id, standard_code, title, version, year, discipline, organization, status, chunks_count, created_at',
          { count: 'exact' },
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== 'all') q = q.eq('status', status);
      if (discipline)        q = q.eq('discipline', discipline);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);

      res.json({ standards: data ?? [], total: count ?? 0, page, limit });
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════
// GET /api/agsk/status/:id    — ingestion job progress
// ══════════════════════════════════════════════════════════════════════════

router.get(
  '/agsk/status/:id',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const sb = getSupabaseAdmin();

      const { data, error } = await sb
        .from('agsk_ingestion_jobs')
        .select(
          'id, standard_id, status, progress_pct, chunks_total, chunks_done, embeddings_cached, error_message, started_at, finished_at, created_at',
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data)  return next(new ApiError(404, 'Job not found'));

      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════
// POST /api/agsk/feedback
// Body: { chunk_id, query_text, relevance_score?, was_cited?, retrieval_rank?, notes? }
// ══════════════════════════════════════════════════════════════════════════

router.post(
  '/agsk/feedback',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        chunk_id,
        query_text,
        relevance_score,
        was_cited,
        retrieval_rank,
        retrieval_type,
        notes,
      } = req.body;

      if (!chunk_id || !query_text) {
        return next(new ApiError(400, 'chunk_id and query_text are required'));
      }

      if (relevance_score !== undefined) {
        const s = Number(relevance_score);
        if (!Number.isInteger(s) || s < 1 || s > 5) {
          return next(new ApiError(400, 'relevance_score must be integer 1–5'));
        }
      }

      const orgId = await getOrgId(req.user!.id);
      const sb    = getSupabaseAdmin();

      const { data, error } = await sb
        .from('agsk_feedback')
        .insert({
          chunk_id,
          user_id:         req.user!.id,
          org_id:          orgId,
          query_text,
          relevance_score: relevance_score != null ? Number(relevance_score) : null,
          was_cited:       was_cited ?? false,
          retrieval_rank:  retrieval_rank ?? null,
          retrieval_type:  retrieval_type ?? null,
          notes:           notes ?? null,
        })
        .select('id, created_at')
        .single();

      if (error) throw new Error(error.message);

      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
