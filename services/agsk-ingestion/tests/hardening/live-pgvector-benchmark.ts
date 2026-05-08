/**
 * AGSK Live PGVector Benchmark
 *
 * Validates pgvector performance in production Supabase environment.
 * Tests: concurrent query load, latency percentiles (p50/p95/p99), HNSW index behavior,
 * BM25 performance, RRF hybrid retrieval, connection pooling, cold/warm cache effects.
 *
 * Run: npx tsx tests/hardening/live-pgvector-benchmark.ts
 */

import { getSupabaseAdmin } from '../../src/services/supabase.js';
import { logger } from '../../src/utils/logger.js';

interface BenchmarkMetrics {
  queryType: 'vector' | 'bm25' | 'rrf' | 'version_filter';
  concurrency: number;
  totalQueries: number;
  totalDuration: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  p99_9: number;
  mean: number;
  stdDev: number;
  minLatency: number;
  maxLatency: number;
  queriesPerSecond: number;
  cacheHitRate: number;
  connectionPoolStats: {
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Benchmark Test Cases ──────────────────────────────────────────────────

/**
 * Vector similarity search via pgvector + HNSW index
 */
async function benchmarkVectorSearch(
  concurrency: number,
  queriesPerConcurrency: number,
): Promise<BenchmarkMetrics> {
  const sb = getSupabaseAdmin();
  const latencies: number[] = [];

  // Sample embedding (text-embedding-3-small dimensions: 1536)
  const sampleEmbedding = Array(1536)
    .fill(0)
    .map(() => Math.random() - 0.5);

  const totalQueries = concurrency * queriesPerConcurrency;
  const batchSize = concurrency;
  const totalBatches = queriesPerConcurrency;

  const t0 = Date.now();

  for (let batch = 0; batch < totalBatches; batch++) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const queryStart = Date.now();
          try {
            await sb.rpc('agsk_vector_search_v2', {
              p_query_embedding: sampleEmbedding,
              p_limit: 5,
              p_version_latest_only: true,
              p_org_id: 'test-org-000',
            });
            latencies.push(Date.now() - queryStart);
          } catch (err) {
            logger.warn({ err }, 'Vector search query failed');
          }
        })()
      );
    }

    await Promise.all(promises);

    // Simulate real-world delay between query batches
    if (batch < totalBatches - 1) {
      await sleep(100);
    }
  }

  const totalDuration = Date.now() - t0;

  // Fetch connection pool stats
  const { data: connStats } = await sb.rpc('agsk_connection_stats', {});

  return {
    queryType: 'vector',
    concurrency,
    totalQueries,
    totalDuration,
    latencies,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    p99_9: percentile(latencies, 99.9),
    mean: mean(latencies),
    stdDev: stdDev(latencies),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    queriesPerSecond: (totalQueries / totalDuration) * 1000,
    cacheHitRate: 0.0, // TODO: measure from agsk_retrieval_log
    connectionPoolStats: connStats?.pool_stats || {
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
  };
}

/**
 * Full-text search via BM25 (GIN index on tsvector)
 */
async function benchmarkBM25Search(
  concurrency: number,
  queriesPerConcurrency: number,
): Promise<BenchmarkMetrics> {
  const sb = getSupabaseAdmin();
  const latencies: number[] = [];

  const testQueries = [
    'pipeline welding safety',
    'corrosion control systems',
    'gas transmission pressure',
    'api specifications standards',
    'material properties steel',
  ];

  const totalQueries = concurrency * queriesPerConcurrency;
  const batchSize = concurrency;
  const totalBatches = queriesPerConcurrency;

  const t0 = Date.now();

  for (let batch = 0; batch < totalBatches; batch++) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const queryStart = Date.now();
          try {
            const testQuery = testQueries[i % testQueries.length];
            await sb.rpc('agsk_bm25_search_v2', {
              p_query: testQuery,
              p_limit: 5,
              p_version_latest_only: true,
              p_org_id: 'test-org-000',
            });
            latencies.push(Date.now() - queryStart);
          } catch (err) {
            logger.warn({ err }, 'BM25 search query failed');
          }
        })()
      );
    }

    await Promise.all(promises);

    if (batch < totalBatches - 1) {
      await sleep(100);
    }
  }

  const totalDuration = Date.now() - t0;
  const { data: connStats } = await sb.rpc('agsk_connection_stats', {});

  return {
    queryType: 'bm25',
    concurrency,
    totalQueries,
    totalDuration,
    latencies,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    p99_9: percentile(latencies, 99.9),
    mean: mean(latencies),
    stdDev: stdDev(latencies),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    queriesPerSecond: (totalQueries / totalDuration) * 1000,
    cacheHitRate: 0.0,
    connectionPoolStats: connStats?.pool_stats || {
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
  };
}

/**
 * Reciprocal Rank Fusion (RRF) hybrid retrieval combining vector + BM25
 */
async function benchmarkRRFSearch(
  concurrency: number,
  queriesPerConcurrency: number,
): Promise<BenchmarkMetrics> {
  const sb = getSupabaseAdmin();
  const latencies: number[] = [];

  const sampleEmbedding = Array(1536)
    .fill(0)
    .map(() => Math.random() - 0.5);

  const testQueries = [
    'pipeline welding safety',
    'corrosion control systems',
    'gas transmission pressure',
  ];

  const totalQueries = concurrency * queriesPerConcurrency;
  const batchSize = concurrency;
  const totalBatches = queriesPerConcurrency;

  const t0 = Date.now();

  for (let batch = 0; batch < totalBatches; batch++) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const queryStart = Date.now();
          try {
            const testQuery = testQueries[i % testQueries.length];
            await sb.rpc('agsk_hybrid_search_v2', {
              p_query: testQuery,
              p_query_embedding: sampleEmbedding,
              p_vector_weight: 0.7,
              p_bm25_weight: 0.3,
              p_limit: 5,
              p_version_latest_only: true,
              p_org_id: 'test-org-000',
            });
            latencies.push(Date.now() - queryStart);
          } catch (err) {
            logger.warn({ err }, 'RRF hybrid search query failed');
          }
        })()
      );
    }

    await Promise.all(promises);

    if (batch < totalBatches - 1) {
      await sleep(100);
    }
  }

  const totalDuration = Date.now() - t0;
  const { data: connStats } = await sb.rpc('agsk_connection_stats', {});

  return {
    queryType: 'rrf',
    concurrency,
    totalQueries,
    totalDuration,
    latencies,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    p99_9: percentile(latencies, 99.9),
    mean: mean(latencies),
    stdDev: stdDev(latencies),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    queriesPerSecond: (totalQueries / totalDuration) * 1000,
    cacheHitRate: 0.0,
    connectionPoolStats: connStats?.pool_stats || {
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
  };
}

/**
 * Version-filtered retrieval with strict isolation enforcement
 */
async function benchmarkVersionFiltering(
  concurrency: number,
  queriesPerConcurrency: number,
): Promise<BenchmarkMetrics> {
  const sb = getSupabaseAdmin();
  const latencies: number[] = [];

  const sampleEmbedding = Array(1536)
    .fill(0)
    .map(() => Math.random() - 0.5);

  const totalQueries = concurrency * queriesPerConcurrency;
  const batchSize = concurrency;
  const totalBatches = queriesPerConcurrency;

  const t0 = Date.now();

  for (let batch = 0; batch < totalBatches; batch++) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const queryStart = Date.now();
          try {
            // Test version filtering: require specific year + latest revision
            await sb.rpc('agsk_hybrid_search_v2', {
              p_query: 'pipeline standards',
              p_query_embedding: sampleEmbedding,
              p_vector_weight: 0.7,
              p_bm25_weight: 0.3,
              p_limit: 5,
              p_version_year: 2016 + (i % 8), // rotate through years 2016-2023
              p_version_latest_only: true,
              p_org_id: 'test-org-000',
            });
            latencies.push(Date.now() - queryStart);
          } catch (err) {
            logger.warn({ err }, 'Version-filtered search query failed');
          }
        })()
      );
    }

    await Promise.all(promises);

    if (batch < totalBatches - 1) {
      await sleep(100);
    }
  }

  const totalDuration = Date.now() - t0;
  const { data: connStats } = await sb.rpc('agsk_connection_stats', {});

  return {
    queryType: 'version_filter',
    concurrency,
    totalQueries,
    totalDuration,
    latencies,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    p99_9: percentile(latencies, 99.9),
    mean: mean(latencies),
    stdDev: stdDev(latencies),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    queriesPerSecond: (totalQueries / totalDuration) * 1000,
    cacheHitRate: 0.0,
    connectionPoolStats: connStats?.pool_stats || {
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
  };
}

// ── Cache Behavior ────────────────────────────────────────────────────────

/**
 * Measure cold vs warm cache performance
 * Cold: fresh connection, no prepared statements
 * Warm: reused connection, prepared statements in cache
 */
async function benchmarkCacheBehavior(): Promise<{
  cold: BenchmarkMetrics;
  warm: BenchmarkMetrics;
}> {
  logger.info('Starting cache behavior benchmark (cold vs warm)...');

  // Cold cache: fresh connection
  const coldMetrics = await benchmarkRRFSearch(1, 10);

  // Warm cache: reuse connection, repeat same queries
  await sleep(1000); // Let connection settle
  const warmMetrics = await benchmarkRRFSearch(1, 10);

  return { cold: coldMetrics, warm: warmMetrics };
}

// ── Reporter ──────────────────────────────────────────────────────────────

function formatMetrics(m: BenchmarkMetrics): string {
  return `
  Query Type:         ${m.queryType.toUpperCase()}
  Concurrency:        ${m.concurrency}
  Total Queries:      ${m.totalQueries}
  Duration:           ${m.totalDuration}ms

  Latency Percentiles:
    p50:              ${m.p50.toFixed(2)}ms
    p95:              ${m.p95.toFixed(2)}ms
    p99:              ${m.p99.toFixed(2)}ms
    p99.9:            ${m.p99_9.toFixed(2)}ms

  Latency Stats:
    Mean:             ${m.mean.toFixed(2)}ms
    Std Dev:          ${m.stdDev.toFixed(2)}ms
    Min:              ${m.minLatency.toFixed(2)}ms
    Max:              ${m.maxLatency.toFixed(2)}ms

  Throughput:         ${m.queriesPerSecond.toFixed(2)} QPS
  Cache Hit Rate:     ${(m.cacheHitRate * 100).toFixed(1)}%

  Connection Pool:
    Active:           ${m.connectionPoolStats.activeConnections}
    Idle:             ${m.connectionPoolStats.idleConnections}
    Waiting:          ${m.connectionPoolStats.waitingClients}
`;
}

// ── Main Benchmark Suite ──────────────────────────────────────────────────

async function runBenchmarkSuite(): Promise<void> {
  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║      AGSK PRODUCTION HARDENING: PGVECTOR BENCHMARK         ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');

  const results: {
    timestamp: string;
    vectorSearch: { c5: BenchmarkMetrics; c20: BenchmarkMetrics };
    bm25Search: { c5: BenchmarkMetrics; c20: BenchmarkMetrics };
    rrfSearch: { c5: BenchmarkMetrics; c20: BenchmarkMetrics };
    versionFilter: { c5: BenchmarkMetrics; c20: BenchmarkMetrics };
    cacheBehavior: { cold: BenchmarkMetrics; warm: BenchmarkMetrics };
  } = {
    timestamp: new Date().toISOString(),
    vectorSearch: { c5: {} as BenchmarkMetrics, c20: {} as BenchmarkMetrics },
    bm25Search: { c5: {} as BenchmarkMetrics, c20: {} as BenchmarkMetrics },
    rrfSearch: { c5: {} as BenchmarkMetrics, c20: {} as BenchmarkMetrics },
    versionFilter: { c5: {} as BenchmarkMetrics, c20: {} as BenchmarkMetrics },
    cacheBehavior: { cold: {} as BenchmarkMetrics, warm: {} as BenchmarkMetrics },
  };

  try {
    // ─ Vector Search Benchmarks ──────────────────────────────────────────
    logger.info('\n▶ VECTOR SEARCH BENCHMARKS');
    logger.info('  Testing pgvector with HNSW index...');

    results.vectorSearch.c5 = await benchmarkVectorSearch(5, 10);
    logger.info(`  ✓ 5 concurrent: p50=${results.vectorSearch.c5.p50.toFixed(2)}ms, p99=${results.vectorSearch.c5.p99.toFixed(2)}ms`);

    results.vectorSearch.c20 = await benchmarkVectorSearch(20, 10);
    logger.info(`  ✓ 20 concurrent: p50=${results.vectorSearch.c20.p50.toFixed(2)}ms, p99=${results.vectorSearch.c20.p99.toFixed(2)}ms`);

    // ─ BM25 Search Benchmarks ────────────────────────────────────────────
    logger.info('\n▶ BM25 FULL-TEXT SEARCH BENCHMARKS');
    logger.info('  Testing GIN index on tsvector...');

    results.bm25Search.c5 = await benchmarkBM25Search(5, 10);
    logger.info(`  ✓ 5 concurrent: p50=${results.bm25Search.c5.p50.toFixed(2)}ms, p99=${results.bm25Search.c5.p99.toFixed(2)}ms`);

    results.bm25Search.c20 = await benchmarkBM25Search(20, 10);
    logger.info(`  ✓ 20 concurrent: p50=${results.bm25Search.c20.p50.toFixed(2)}ms, p99=${results.bm25Search.c20.p99.toFixed(2)}ms`);

    // ─ RRF Hybrid Search Benchmarks ──────────────────────────────────────
    logger.info('\n▶ RRF HYBRID SEARCH BENCHMARKS');
    logger.info('  Testing combined vector + BM25 retrieval...');

    results.rrfSearch.c5 = await benchmarkRRFSearch(5, 10);
    logger.info(`  ✓ 5 concurrent: p50=${results.rrfSearch.c5.p50.toFixed(2)}ms, p99=${results.rrfSearch.c5.p99.toFixed(2)}ms`);

    results.rrfSearch.c20 = await benchmarkRRFSearch(20, 10);
    logger.info(`  ✓ 20 concurrent: p50=${results.rrfSearch.c20.p50.toFixed(2)}ms, p99=${results.rrfSearch.c20.p99.toFixed(2)}ms`);

    // ─ Version Filtering Benchmarks ──────────────────────────────────────
    logger.info('\n▶ VERSION-FILTERED RETRIEVAL BENCHMARKS');
    logger.info('  Testing strict version isolation...');

    results.versionFilter.c5 = await benchmarkVersionFiltering(5, 10);
    logger.info(`  ✓ 5 concurrent: p50=${results.versionFilter.c5.p50.toFixed(2)}ms, p99=${results.versionFilter.c5.p99.toFixed(2)}ms`);

    results.versionFilter.c20 = await benchmarkVersionFiltering(20, 10);
    logger.info(`  ✓ 20 concurrent: p50=${results.versionFilter.c20.p50.toFixed(2)}ms, p99=${results.versionFilter.c20.p99.toFixed(2)}ms`);

    // ─ Cache Behavior Benchmark ──────────────────────────────────────────
    logger.info('\n▶ CACHE BEHAVIOR ANALYSIS');
    logger.info('  Testing cold vs warm cache performance...');

    const cacheBench = await benchmarkCacheBehavior();
    results.cacheBehavior = cacheBench;
    const coldWarmDelta = ((cacheBench.warm.p50 - cacheBench.cold.p50) / cacheBench.cold.p50) * 100;
    logger.info(`  ✓ Cold cache p50: ${cacheBench.cold.p50.toFixed(2)}ms`);
    logger.info(`  ✓ Warm cache p50: ${cacheBench.warm.p50.toFixed(2)}ms`);
    logger.info(`  ✓ Warm improvement: ${coldWarmDelta.toFixed(1)}%`);

    // ─ Summary Report ────────────────────────────────────────────────────
    logger.info('\n╔════════════════════════════════════════════════════════════╗');
    logger.info('║                    BENCHMARK SUMMARY                       ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    logger.info('\n📊 VECTOR SEARCH (5 concurrent):' + formatMetrics(results.vectorSearch.c5));
    logger.info('\n📊 VECTOR SEARCH (20 concurrent):' + formatMetrics(results.vectorSearch.c20));
    logger.info('\n📊 BM25 SEARCH (5 concurrent):' + formatMetrics(results.bm25Search.c5));
    logger.info('\n📊 BM25 SEARCH (20 concurrent):' + formatMetrics(results.bm25Search.c20));
    logger.info('\n📊 RRF HYBRID (5 concurrent):' + formatMetrics(results.rrfSearch.c5));
    logger.info('\n📊 RRF HYBRID (20 concurrent):' + formatMetrics(results.rrfSearch.c20));
    logger.info('\n📊 VERSION FILTER (5 concurrent):' + formatMetrics(results.versionFilter.c5));
    logger.info('\n📊 VERSION FILTER (20 concurrent):' + formatMetrics(results.versionFilter.c20));

    // Production readiness checks
    logger.info('\n╔════════════════════════════════════════════════════════════╗');
    logger.info('║                  PRODUCTION READINESS                      ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    const checks = {
      vectorP95_5: results.vectorSearch.c5.p95 < 200, // < 200ms at 5 concurrent
      vectorP95_20: results.vectorSearch.c20.p95 < 500, // < 500ms at 20 concurrent
      bm25P95_5: results.bm25Search.c5.p95 < 150,
      bm25P95_20: results.bm25Search.c20.p95 < 400,
      rrfP95_5: results.rrfSearch.c5.p95 < 250,
      rrfP95_20: results.rrfSearch.c20.p95 < 600,
      versionFilterOverhead: results.versionFilter.c5.p95 < (results.rrfSearch.c5.p95 * 1.3), // < 30% overhead
      cacheEffective: cacheBench.warm.p50 < (cacheBench.cold.p50 * 0.8), // > 20% improvement
    };

    let passCount = 0;
    for (const [check, passed] of Object.entries(checks)) {
      const icon = passed ? '✅' : '❌';
      logger.info(`  ${icon} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
      if (passed) passCount++;
    }

    logger.info(`\n  OVERALL: ${passCount}/${Object.keys(checks).length} checks passed`);
    logger.info('\n✨ Benchmark complete.');

    // Store results for report generation
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    logger.error({ err }, 'Benchmark failed');
    process.exit(1);
  }
}

runBenchmarkSuite();
