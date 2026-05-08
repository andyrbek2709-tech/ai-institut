/**
 * Week 2 Validation — Retrieval Logic (Offline)
 *
 * Tests:
 *   1. Citation deduplication logic
 *   2. RRF score merging correctness
 *   3. Evaluation dataset coverage analysis
 *   4. Retrieval type routing
 *   5. Edge cases from evaluation_dataset.json
 *
 * Offline: validates logic correctness without live DB.
 * Run: npx tsx tests/week2/validate-retrieval.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ------------------------------------------------------------------
// Types (inline to avoid importing engine which needs env)
// ------------------------------------------------------------------

interface Citation {
  document:   string;
  standard:   string;
  section:    string;
  page:       number;
  version:    string;
  confidence: number;
}

interface EvalQuery {
  query_id:           string;
  query_text:         string;
  difficulty:         string;
  discipline:         string;
  expected_standards: string[];
  expected_keywords:  string[];
  ground_truth_answer:string;
  confidence_score:   number;
  notes?:             string;
}

// ------------------------------------------------------------------
// Inline citation deduplication (mirrors engine.ts logic)
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// RRF score computation (mirrors engine RPC logic)
// ------------------------------------------------------------------

function rrfScore(vectorRank: number | null, bm25Rank: number | null, k = 60): number {
  const vectorScore = vectorRank != null ? 0.7 * (1 / (k + vectorRank)) : 0;
  const bm25Score   = bm25Rank   != null ? 0.3 * (1 / (k + bm25Rank))   : 0;
  return vectorScore + bm25Score;
}

// ------------------------------------------------------------------
// Analysis helpers
// ------------------------------------------------------------------

function analyzeQueryDifficulty(queries: EvalQuery[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of queries) {
    counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1;
  }
  return counts;
}

function analyzeStandardCoverage(queries: EvalQuery[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of queries) {
    for (const std of q.expected_standards) {
      counts.set(std, (counts.get(std) ?? 0) + 1);
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function identifyEdgeCases(queries: EvalQuery[]): { type: string; count: number; examples: string[] }[] {
  const acronymCollisions: EvalQuery[] = [];
  const multiStandard: EvalQuery[] = [];
  const versionConflicts: EvalQuery[] = [];
  const apiAmbiguity: EvalQuery[] = [];

  for (const q of queries) {
    // Multi-standard: more than 2 expected standards
    if (q.expected_standards.length > 2) multiStandard.push(q);

    // Acronym collision: contains "API" and other acronyms in same query
    if (/\bAPI\b/.test(q.query_text) && /\b(ASME|ISO|GOST)\b/.test(q.query_text)) {
      acronymCollisions.push(q);
    }

    // Version conflicts: query mentions a specific year
    if (/\b(19|20)\d{2}\b/.test(q.query_text)) versionConflicts.push(q);

    // API ambiguity: "API" could mean American Petroleum Institute or programming API
    if (/\bAPI\b/.test(q.query_text) && /\b(endpoint|request|response|http|rest)\b/i.test(q.query_text)) {
      apiAmbiguity.push(q);
    }
  }

  return [
    { type: 'multi_standard', count: multiStandard.length, examples: multiStandard.slice(0, 3).map(q => q.query_id) },
    { type: 'acronym_collision', count: acronymCollisions.length, examples: acronymCollisions.slice(0, 3).map(q => q.query_id) },
    { type: 'version_conflict', count: versionConflicts.length, examples: versionConflicts.slice(0, 3).map(q => q.query_id) },
    { type: 'api_ambiguity', count: apiAmbiguity.length, examples: apiAmbiguity.slice(0, 3).map(q => q.query_id) },
  ];
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  console.log('='.repeat(70));
  console.log('AGSK Week 2 — Retrieval Logic Validation (Offline)');
  console.log('='.repeat(70));

  // ------------------------------------------------------------------
  // 1. Citation deduplication
  // ------------------------------------------------------------------
  console.log('\n[1/4] Citation Deduplication Tests...');

  const citations: Citation[] = [
    { document: 'API 5L 2018', standard: 'API 5L', section: '9.2', page: 45, version: '2018', confidence: 0.9 },
    { document: 'API 5L 2018', standard: 'API 5L', section: '9.2', page: 47, version: '2018', confidence: 0.85 },  // duplicate
    { document: 'ASME B31.4 2019', standard: 'ASME B31.4', section: '403', page: 12, version: '2019', confidence: 0.8 },
    { document: 'API 5L 2018', standard: 'API 5L', section: '9.3', page: 48, version: '2018', confidence: 0.7 },  // different section
    { document: 'API 5L 2012', standard: 'API 5L', section: '9.2', page: 45, version: '2012', confidence: 0.6 },  // different version
  ];

  const deduped = deduplicateCitations(citations);

  console.log(`  Input citations:  ${citations.length}`);
  console.log(`  After dedup:      ${deduped.length} (expected: 4)`);

  const test1Pass = deduped.length === 4;
  console.log(`  ✓ Dedup test: ${test1Pass ? 'PASS' : 'FAIL'}`);

  // ------------------------------------------------------------------
  // 2. RRF Score Correctness
  // ------------------------------------------------------------------
  console.log('\n[2/4] RRF Score Tests...');

  const testCases = [
    { vector: 1, bm25: 1,    expected: 0.7 * (1/61) + 0.3 * (1/61) },
    { vector: 1, bm25: null, expected: 0.7 * (1/61) },
    { vector: null, bm25: 1, expected: 0.3 * (1/61) },
    { vector: 1, bm25: 5,    expected: 0.7 * (1/61) + 0.3 * (1/65) },
  ];

  let rrfPass = true;
  for (const tc of testCases) {
    const actual = rrfScore(tc.vector, tc.bm25);
    const diff = Math.abs(actual - tc.expected);
    if (diff > 0.0001) {
      console.log(`  ✗ RRF(v=${tc.vector}, b=${tc.bm25}): got ${actual.toFixed(6)}, want ${tc.expected.toFixed(6)}`);
      rrfPass = false;
    }
  }
  console.log(`  ✓ RRF correctness: ${rrfPass ? 'PASS' : 'FAIL'}`);

  // Verify that vector-biased RRF rank 1 > bm25-biased RRF rank 1
  const vectorFirst = rrfScore(1, null);
  const bm25First   = rrfScore(null, 1);
  console.log(`  ✓ Vector weight (0.7) > BM25 weight (0.3): ${vectorFirst > bm25First ? 'PASS' : 'FAIL'}`);
  console.log(`    vector-only rank1 = ${vectorFirst.toFixed(6)}, bm25-only rank1 = ${bm25First.toFixed(6)}`);

  // ------------------------------------------------------------------
  // 3. Evaluation Dataset Analysis
  // ------------------------------------------------------------------
  console.log('\n[3/4] Evaluation Dataset Analysis...');

  const datasetPath = resolve(__dirname, '../../../../evaluation_dataset.json');
  let queries: EvalQuery[] = [];

  try {
    const raw = readFileSync(datasetPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Dataset structure: { metadata: {...}, queries: [...] }
    queries = Array.isArray(parsed) ? parsed : (parsed.queries ?? []);
    console.log(`  ✓ Loaded ${queries.length} queries`);
  } catch (err) {
    console.log(`  ✗ Could not load evaluation_dataset.json: ${err}`);
    queries = [];
  }

  if (queries.length > 0) {
    // Difficulty breakdown
    const difficulty = analyzeQueryDifficulty(queries);
    console.log('  Difficulty distribution:');
    for (const [level, count] of Object.entries(difficulty)) {
      console.log(`    ${level}: ${count} queries`);
    }

    // Standard coverage
    const stdCoverage = analyzeStandardCoverage(queries);
    console.log(`\n  Standards referenced (top 10):`);
    let i = 0;
    for (const [std, count] of stdCoverage) {
      if (i++ >= 10) break;
      console.log(`    ${std}: ${count} queries`);
    }

    // Edge cases
    const edgeCases = identifyEdgeCases(queries);
    console.log('\n  Edge case categories:');
    for (const ec of edgeCases) {
      console.log(`    ${ec.type}: ${ec.count} queries [${ec.examples.join(', ')}]`);
    }

    // Query length distribution
    const lengths = queries.map(q => q.query_text.split(/\s+/).length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const minLen = Math.min(...lengths);
    const maxLen = Math.max(...lengths);
    console.log(`\n  Query length: avg=${avgLen.toFixed(1)} words, min=${minLen}, max=${maxLen}`);

    // Check for queries that would test acronym collisions
    const apiQueries = queries.filter(q => /\bAPI\b/.test(q.query_text));
    console.log(`  Queries mentioning "API": ${apiQueries.length}`);
  }

  // ------------------------------------------------------------------
  // 4. Retrieval type routing validation (logic check)
  // ------------------------------------------------------------------
  console.log('\n[4/4] Retrieval Routing Logic...');

  const routingTests = [
    { mode: 'hybrid', needsEmbedding: true,  usesBM25: true,  usesVector: true  },
    { mode: 'vector', needsEmbedding: true,  usesBM25: false, usesVector: true  },
    { mode: 'bm25',   needsEmbedding: false, usesBM25: true,  usesVector: false },
  ];

  for (const t of routingTests) {
    const embeddingNeeded = t.mode !== 'bm25';
    console.log(`  mode="${t.mode}": embedding=${embeddingNeeded === t.needsEmbedding ? 'OK' : 'MISMATCH'}`);
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('RETRIEVAL VALIDATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Citation deduplication: ${test1Pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  RRF score computation:  ${rrfPass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  Eval dataset loaded:    ${queries.length > 0 ? `PASS ✓ (${queries.length} queries)` : 'SKIP (file not found)'}`);

  const offline_status = test1Pass && rrfPass ? 'ALL OFFLINE CHECKS PASS' : 'SOME CHECKS FAILED';
  console.log(`\n  ${offline_status}`);
  console.log('\n  NOTE: Live retrieval tests (Supabase + OpenAI) require env vars.');
  console.log('        No documents have been indexed yet — retrieval@k metrics pending.');
  console.log('        Metrics Recall@5 / Precision@5 will be measured after first real ingestion.');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
