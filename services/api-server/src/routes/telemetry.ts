/**
 * AGSK Pilot Program Telemetry Routes
 *
 * POST /api/telemetry/query        — log search query
 * POST /api/telemetry/click        — log result click
 * POST /api/telemetry/feedback     — log relevance feedback
 * POST /api/telemetry/failure      — log retrieval failure
 * GET  /api/telemetry/dashboard    — get dashboard metrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Middleware: Ensure user is authenticated ─────────────────────────────

router.use(authMiddleware);

// ── Helper: Get user's org_id ──────────────────────────────────────────

async function getOrgId(supabaseUid: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('pilot_users')
    .select('org_id')
    .eq('user_id', supabaseUid)
    .maybeSingle();
  return (data as any)?.org_id ?? null;
}

// ── POST /api/telemetry/query ──────────────────────────────────────────
// Log a search query

interface QueryLogRequest {
  query_text: string;
  query_tokens?: number;
  discipline?: string;
  result_count?: number;
  retrieval_latency_ms?: number;
  top_result_score?: number;
  top_result_standard_id?: string;
  session_id?: string;
}

router.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const orgId = await getOrgId(uid);
    if (!orgId) throw new ApiError(400, 'User org_id not found');

    const body = req.body as QueryLogRequest;
    if (!body.query_text) {
      throw new ApiError(400, 'Missing required field: query_text');
    }

    const sb = getSupabaseAdmin();

    // Check if user is pilot participant
    const { data: pilotUser } = await sb
      .from('pilot_users')
      .select('id')
      .eq('user_id', uid)
      .eq('active', true)
      .maybeSingle();

    const isPilot = !!pilotUser;

    const { data, error } = await sb
      .from('agsk_query_log')
      .insert({
        user_id: uid,
        org_id: orgId,
        query_text: body.query_text,
        query_tokens: body.query_tokens,
        discipline: body.discipline,
        result_count: body.result_count,
        retrieval_latency_ms: body.retrieval_latency_ms,
        top_result_score: body.top_result_score,
        top_result_standard_id: body.top_result_standard_id,
        session_id: body.session_id || uuidv4(),
        is_pilot: isPilot,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      query_log_id: data?.id,
      is_pilot: isPilot,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/telemetry/click ──────────────────────────────────────────
// Log a result click

interface ResultClickRequest {
  query_log_id: string;
  result_rank: number;
  chunk_id: string;
  standard_id?: string;
  section_title?: string;
  time_to_click_ms?: number;
}

router.post('/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const orgId = await getOrgId(uid);
    if (!orgId) throw new ApiError(400, 'User org_id not found');

    const body = req.body as ResultClickRequest;
    if (!body.query_log_id || !body.result_rank || !body.chunk_id) {
      throw new ApiError(400, 'Missing required fields: query_log_id, result_rank, chunk_id');
    }

    const sb = getSupabaseAdmin();

    // Verify query_log_id belongs to user
    const { data: queryLog } = await sb
      .from('agsk_query_log')
      .select('id')
      .eq('id', body.query_log_id)
      .eq('user_id', uid)
      .maybeSingle();

    if (!queryLog) {
      throw new ApiError(403, 'query_log_id not found or not owned by user');
    }

    const { data, error } = await sb
      .from('agsk_result_clicks')
      .insert({
        query_log_id: body.query_log_id,
        user_id: uid,
        org_id: orgId,
        result_rank: body.result_rank,
        chunk_id: body.chunk_id,
        standard_id: body.standard_id,
        section_title: body.section_title,
        time_to_click_ms: body.time_to_click_ms,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      click_id: data?.id,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/telemetry/feedback ───────────────────────────────────────
// Log relevance feedback

interface FeedbackRequest {
  query_log_id: string;
  result_id: string;
  feedback_type: 'relevant' | 'irrelevant' | 'partially_relevant';
  citation_correct?: boolean;
  citation_issue?: 'missing_section' | 'wrong_section' | 'outdated';
  false_positive?: boolean;
  correctness_confidence?: number;
  comments?: string;
}

router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const body = req.body as FeedbackRequest;
    if (!body.query_log_id || !body.result_id || !body.feedback_type) {
      throw new ApiError(400, 'Missing required fields: query_log_id, result_id, feedback_type');
    }

    if (!['relevant', 'irrelevant', 'partially_relevant'].includes(body.feedback_type)) {
      throw new ApiError(400, 'Invalid feedback_type');
    }

    if (body.correctness_confidence && (body.correctness_confidence < 1 || body.correctness_confidence > 5)) {
      throw new ApiError(400, 'correctness_confidence must be 1-5');
    }

    const sb = getSupabaseAdmin();

    // Verify query_log_id belongs to user
    const { data: queryLog } = await sb
      .from('agsk_query_log')
      .select('id')
      .eq('id', body.query_log_id)
      .eq('user_id', uid)
      .maybeSingle();

    if (!queryLog) {
      throw new ApiError(403, 'query_log_id not found or not owned by user');
    }

    const { data, error } = await sb
      .from('agsk_relevance_feedback')
      .insert({
        user_id: uid,
        query_log_id: body.query_log_id,
        result_id: body.result_id,
        feedback_type: body.feedback_type,
        citation_correct: body.citation_correct,
        citation_issue: body.citation_issue,
        false_positive: body.false_positive ?? false,
        correctness_confidence: body.correctness_confidence,
        comments: body.comments,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      feedback_id: data?.id,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/telemetry/failure ────────────────────────────────────────
// Log retrieval failure (auto-called by search API)

interface FailureRequest {
  query_log_id: string;
  failure_type: 'no_results' | 'low_confidence' | 'timeout' | 'error';
  query_text: string;
  discipline?: string;
  top_score?: number;
  error_details?: string;
  likely_cause?: 'corpus_gap' | 'query_malformed' | 'service_error' | 'unknown';
}

router.post('/failure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const body = req.body as FailureRequest;
    if (!body.query_log_id || !body.failure_type || !body.query_text) {
      throw new ApiError(400, 'Missing required fields: query_log_id, failure_type, query_text');
    }

    const sb = getSupabaseAdmin();

    // Verify query_log_id belongs to user
    const { data: queryLog } = await sb
      .from('agsk_query_log')
      .select('id')
      .eq('id', body.query_log_id)
      .eq('user_id', uid)
      .maybeSingle();

    if (!queryLog) {
      throw new ApiError(403, 'query_log_id not found or not owned by user');
    }

    const { data, error } = await sb
      .from('agsk_retrieval_failures')
      .insert({
        user_id: uid,
        query_log_id: body.query_log_id,
        failure_type: body.failure_type,
        query_text: body.query_text,
        discipline: body.discipline,
        top_score: body.top_score,
        error_details: body.error_details,
        likely_cause: body.likely_cause ?? 'unknown',
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      failure_id: data?.id,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/telemetry/dashboard ───────────────────────────────────────
// Get dashboard metrics (admin only)

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const sb = getSupabaseAdmin();

    // Check if admin
    const { data: adminUser } = await sb
      .from('app_users')
      .select('role')
      .eq('supabase_uid', uid)
      .maybeSingle();

    if ((adminUser as any)?.role !== 'admin') {
      throw new ApiError(403, 'Only admins can access dashboard');
    }

    // Fetch all dashboard views
    const queries = [
      sb.from('agsk_dashboard_query_summary').select('*').single(),
      sb.from('agsk_dashboard_top_standards').select('*'),
      sb.from('agsk_dashboard_discipline_dist').select('*'),
      sb.from('agsk_dashboard_feedback_summary').select('*'),
      sb.from('agsk_dashboard_corpus_gaps_priority').select('*'),
      sb.from('agsk_dashboard_ctr').select('*').single(),
    ];

    const [summary, standards, disciplines, feedback, gaps, ctr] = await Promise.all(queries);

    res.json({
      summary: summary.data,
      top_standards: standards.data,
      discipline_distribution: disciplines.data,
      feedback: feedback.data,
      corpus_gaps: gaps.data,
      click_through_rate: ctr.data,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/telemetry/status ──────────────────────────────────────────
// Get pilot program status (admin only)

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.id;
    if (!uid) throw new ApiError(401, 'Unauthorized');

    const sb = getSupabaseAdmin();

    // Check if admin
    const { data: adminUser } = await sb
      .from('app_users')
      .select('role')
      .eq('supabase_uid', uid)
      .maybeSingle();

    if ((adminUser as any)?.role !== 'admin') {
      throw new ApiError(403, 'Only admins can access status');
    }

    // Fetch pilot program metrics
    const { data: pilots } = await sb
      .from('pilot_users')
      .select('*')
      .eq('active', true);

    const { data: queryLogs } = await sb
      .from('agsk_query_log')
      .select('id', { count: 'exact' })
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: failures } = await sb
      .from('agsk_retrieval_failures')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: feedbacks } = await sb
      .from('agsk_relevance_feedback')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    res.json({
      status: 'running',
      active_pilots: pilots?.length ?? 0,
      last_24h: {
        queries: queryLogs?.length ?? 0,
        failures: failures?.length ?? 0,
        feedbacks: feedbacks?.length ?? 0,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
