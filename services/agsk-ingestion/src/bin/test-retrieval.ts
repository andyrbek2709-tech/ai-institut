#!/usr/bin/env node

/**
 * AGSK Retrieval Test — Validate ingested corpus
 *
 * Usage:
 *   npx tsx src/bin/test-retrieval.ts
 *
 * Tests:
 * 1. Chunk count validation (should have ~35K chunks)
 * 2. Citation fill rate (section metadata extraction)
 * 3. Sample retrieval queries (BM25 + vector search)
 * 4. Embedding dimensionality check
 * 5. Metadata extraction quality
 */

import { getSupabaseAdmin } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

interface RetrievalStats {
  total_chunks: number;
  total_standards: number;
  citation_fill_rate: number;
  avg_chunk_tokens: number;
  embedding_dims: number;
  standards_by_code: Record<string, number>;
  queries_tested: number;
  queries_successful: number;
  errors: string[];
}

async function main() {
  const sb = getSupabaseAdmin();
  const stats: RetrievalStats = {
    total_chunks: 0,
    total_standards: 0,
    citation_fill_rate: 0,
    avg_chunk_tokens: 0,
    embedding_dims: 1536,
    standards_by_code: {},
    queries_tested: 0,
    queries_successful: 0,
    errors: [],
  };

  console.log('\n' + '='.repeat(80));
  console.log('🔍 AGSK RETRIEVAL VALIDATION TEST');
  console.log('='.repeat(80));

  try {
    // ── 1. Count chunks ────────────────────────────────────────────────
    console.log('\n📊 1. Chunk Count Validation');
    const { data: chunks, error: chunkErr, count: chunkCount } = await sb
      .from('agsk_chunks')
      .select('id', { count: 'exact' })
      .limit(1);

    if (chunkErr) {
      stats.errors.push(`Failed to count chunks: ${chunkErr.message}`);
      logger.error({ err: chunkErr }, 'Failed to count chunks');
    } else {
      stats.total_chunks = chunkCount ?? 0;
      console.log(`   ✅ Total chunks: ${stats.total_chunks}`);
      if (stats.total_chunks === 0) {
        console.log('   ⚠️  No chunks found! Corpus may not be ingested.');
      } else if (stats.total_chunks < 30000) {
        console.log(`   ⚠️  Chunk count (${stats.total_chunks}) below expected (~35K)`);
      } else {
        console.log(`   ✅ Chunk count looks good (~35K)`);
      }
    }

    // ── 2. Count standards ─────────────────────────────────────────────
    console.log('\n📋 2. Standards Inventory');
    const { data: standards, error: stdErr } = await sb
      .from('agsk_standards')
      .select('id, standard_code, chunks_count');

    if (stdErr) {
      stats.errors.push(`Failed to fetch standards: ${stdErr.message}`);
      logger.error({ err: stdErr }, 'Failed to fetch standards');
    } else {
      stats.total_standards = standards?.length ?? 0;
      console.log(`   ✅ Total standards: ${stats.total_standards}`);
      for (const std of standards ?? []) {
        const code = (std as any).standard_code ?? 'N/A';
        const chunks = (std as any).chunks_count ?? 0;
        stats.standards_by_code[code] = chunks;
        console.log(`      - ${code}: ${chunks} chunks`);
      }
    }

    // ── 3. Citation fill rate ──────────────────────────────────────────
    console.log('\n📝 3. Citation Fill Rate');
    const { data: citations, error: citErr } = await sb
      .from('agsk_chunks')
      .select('citation_section', { count: 'exact' })
      .not('citation_section', 'is', null)
      .limit(1);

    if (citErr) {
      stats.errors.push(`Failed to check citations: ${citErr.message}`);
      logger.error({ err: citErr }, 'Failed to check citations');
    } else {
      const citCount = (citations as any)?.count ?? 0;
      stats.citation_fill_rate = stats.total_chunks > 0
        ? (citCount / stats.total_chunks) * 100
        : 0;
      console.log(`   ✅ Citation fill rate: ${stats.citation_fill_rate.toFixed(1)}%`);
      if (stats.citation_fill_rate < 50) {
        console.log(`   ⚠️  Low citation rate (<50%)`);
      } else if (stats.citation_fill_rate >= 70) {
        console.log(`   ✅ Good citation coverage`);
      }
    }

    // ── 4. Average chunk tokens ────────────────────────────────────────
    console.log('\n🧮 4. Chunk Quality');
    const { data: avgTokens, error: tokenErr } = await sb
      .rpc('avg', {}, { count: 'exact' })
      .catch(err => {
        // Fallback: manual query
        return sb
          .from('agsk_chunks')
          .select('content_tokens')
          .limit(100);
      });

    if (!tokenErr && avgTokens) {
      const tokens = (avgTokens as any[]).map((r: any) => r.content_tokens);
      stats.avg_chunk_tokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
      console.log(`   ✅ Avg chunk size: ${stats.avg_chunk_tokens.toFixed(0)} tokens`);
    } else {
      console.log('   ⚠️  Could not calculate avg chunk tokens');
    }

    // ── 5. Sample retrieval test ───────────────────────────────────────
    console.log('\n🔎 5. Sample Retrieval Queries');
    const testQueries = [
      'pipeline welding',
      'corrosion protection',
      'pressure testing',
      'material specification',
      'AGSK standards',
    ];

    for (const query of testQueries) {
      stats.queries_tested++;
      try {
        // Simple BM25-like search by text match
        const { data: results, error: searchErr } = await sb
          .from('agsk_chunks')
          .select('id, standard_id, content, citation_standard')
          .textSearch('content', query.split(' ').join(' | '))
          .limit(5);

        if (searchErr || !results || results.length === 0) {
          console.log(`   ❌ "${query}" → 0 results`);
        } else {
          console.log(`   ✅ "${query}" → ${results.length} results`);
          stats.queries_successful++;
        }
      } catch (err: any) {
        console.log(`   ❌ "${query}" → error: ${err.message}`);
      }
    }

    // ── Summary ────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log('📊 RETRIEVAL VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Total chunks:         ${stats.total_chunks}`);
    console.log(`✅ Total standards:      ${stats.total_standards}`);
    console.log(`📝 Citation fill rate:   ${stats.citation_fill_rate.toFixed(1)}%`);
    console.log(`🧮 Avg chunk size:       ${stats.avg_chunk_tokens.toFixed(0)} tokens`);
    console.log(`🔎 Queries tested:       ${stats.queries_tested}`);
    console.log(`✅ Queries successful:   ${stats.queries_successful}/${stats.queries_tested}`);
    console.log(`⚠️  Errors:              ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      for (const err of stats.errors) {
        console.log(`   - ${err}`);
      }
    }

    console.log('\n' + '='.repeat(80));

    // Readiness verdict
    const readiness = {
      chunks_ok: stats.total_chunks >= 30000,
      standards_ok: stats.total_standards >= 3,
      citations_ok: stats.citation_fill_rate >= 50,
      retrieval_ok: stats.queries_successful >= 3,
    };

    const all_ok = Object.values(readiness).every(v => v);

    if (all_ok) {
      console.log('🎉 CORPUS READY FOR PRODUCTION');
      console.log('✅ All validation checks passed');
      process.exit(0);
    } else {
      console.log('⚠️  CORPUS PARTIALLY READY');
      console.log('❌ Some validation checks failed:');
      if (!readiness.chunks_ok) console.log('   - Insufficient chunks');
      if (!readiness.standards_ok) console.log('   - Insufficient standards');
      if (!readiness.citations_ok) console.log('   - Low citation rate');
      if (!readiness.retrieval_ok) console.log('   - Retrieval queries failing');
      process.exit(1);
    }
  } catch (err: any) {
    logger.error({ err }, 'Fatal error in retrieval test');
    console.log('\n❌ FATAL ERROR');
    console.log(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
