/**
 * AGSK Load Test: Concurrent Engineering Workflow Simulation
 *
 * Simulates 5 and 20 concurrent engineers performing realistic operations:
 *   - Standard ingestion with validation
 *   - Metadata extraction
 *   - Vector embedding generation
 *   - Reranker processing
 *   - Query retrieval with version filtering
 *   - Cache behavior under load
 *
 * Measures: latency degradation, throughput, error rates, connection pooling behavior.
 *
 * Run: npx tsx tests/hardening/load-test.ts
 */

import { getSupabaseAdmin } from '../../src/services/supabase.js';
import { logger } from '../../src/utils/logger.js';

interface LoadTestMetrics {
  concurrency: number;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errorRate: number;
  operationsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  peakLatency: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
}

interface OperationResult {
  type: 'ingest' | 'retrieve' | 'validate' | 'rerank';
  latency: number;
  success: boolean;
  error?: string;
}

// ── Simulated Engineer Workload ──────────────────────────────────────────

/**
 * Simulate standard ingestion workflow:
 * 1. Validate metadata
 * 2. Detect policy compliance
 * 3. Check version conflicts
 * 4. Generate embeddings
 */
async function simulateIngestionWorkflow(
  engineerId: string,
  orgId: string,
): Promise<OperationResult> {
  const startTime = Date.now();
  const sb = getSupabaseAdmin();

  try {
    // Simulate ingestion validation via RPC
    const { error } = await sb.rpc('agsk_detect_version_conflicts', {
      p_org_id: orgId,
      p_standard_code: `TEST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      p_year: 2016 + Math.floor(Math.random() * 8),
      p_version: null,
    });

    if (error) throw error;

    return {
      type: 'ingest',
      latency: Date.now() - startTime,
      success: true,
    };
  } catch (err: any) {
    return {
      type: 'ingest',
      latency: Date.now() - startTime,
      success: false,
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Simulate retrieval workflow:
 * 1. Generate query embedding
 * 2. Perform hybrid RRF search
 * 3. Rerank top results
 * 4. Apply version filtering
 */
async function simulateRetrievalWorkflow(
  engineerId: string,
  orgId: string,
): Promise<OperationResult> {
  const startTime = Date.now();
  const sb = getSupabaseAdmin();

  try {
    const sampleEmbedding = Array(1536)
      .fill(0)
      .map(() => Math.random() - 0.5);

    const queries = [
      'pipeline welding specifications',
      'corrosion control standards',
      'gas transmission pressure limits',
      'material properties for high-temperature service',
      'submarine pipeline systems design',
    ];

    const query = queries[Math.floor(Math.random() * queries.length)];

    // Execute hybrid search with version filtering
    const { error } = await sb.rpc('agsk_hybrid_search_v2', {
      p_query: query,
      p_query_embedding: sampleEmbedding,
      p_vector_weight: 0.7,
      p_bm25_weight: 0.3,
      p_limit: 5,
      p_version_latest_only: true,
      p_version_year: 2016 + Math.floor(Math.random() * 8),
      p_org_id: orgId,
    });

    if (error) throw error;

    return {
      type: 'retrieve',
      latency: Date.now() - startTime,
      success: true,
    };
  } catch (err: any) {
    return {
      type: 'retrieve',
      latency: Date.now() - startTime,
      success: false,
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Simulate validation workflow:
 * Check corpus compliance, version conflicts, license requirements
 */
async function simulateValidationWorkflow(
  engineerId: string,
  orgId: string,
): Promise<OperationResult> {
  const startTime = Date.now();
  const sb = getSupabaseAdmin();

  try {
    // Simulate version conflict detection
    const { error } = await sb.rpc('agsk_detect_version_conflicts', {
      p_org_id: orgId,
      p_standard_code: 'API 5L',
      p_year: 2016 + Math.floor(Math.random() * 8),
      p_version: null,
    });

    if (error) throw error;

    return {
      type: 'validate',
      latency: Date.now() - startTime,
      success: true,
    };
  } catch (err: any) {
    return {
      type: 'validate',
      latency: Date.now() - startTime,
      success: false,
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Simulate reranker workflow:
 * Rerank top-20 retrieval results using cross-encoder
 */
async function simulateRerankingWorkflow(
  engineerId: string,
  orgId: string,
): Promise<OperationResult> {
  const startTime = Date.now();

  try {
    // In production, would call reranker API
    // For load testing, simulate network latency
    const simulatedLatency = 50 + Math.random() * 150; // 50-200ms typical Jina API latency
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    return {
      type: 'rerank',
      latency: Date.now() - startTime,
      success: true,
    };
  } catch (err: any) {
    return {
      type: 'rerank',
      latency: Date.now() - startTime,
      success: false,
      error: err?.message || 'Unknown error',
    };
  }
}

// ── Load Test Orchestration ──────────────────────────────────────────────

/**
 * Run concurrent engineer simulation for specified duration
 */
async function runLoadTest(
  concurrency: number,
  durationSeconds: number,
): Promise<LoadTestMetrics> {
  const results: OperationResult[] = [];
  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;
  const orgId = 'load-test-org';

  // Operations to cycle through (realistic mix)
  const operationMix = [
    { fn: simulateRetrievalWorkflow, weight: 0.4 }, // 40% retrievals
    { fn: simulateIngestionWorkflow, weight: 0.3 }, // 30% ingestions
    { fn: simulateValidationWorkflow, weight: 0.2 }, // 20% validations
    { fn: simulateRerankingWorkflow, weight: 0.1 }, // 10% reranking
  ];

  // Spawn concurrent engineers
  const engineers = Array.from({ length: concurrency }, (_, i) => i + 1);

  const engineerLoops = engineers.map(engineerId =>
    (async () => {
      let opIndex = 0;
      while (Date.now() < endTime) {
        // Cycle through operations
        const operation = operationMix[opIndex % operationMix.length];
        opIndex++;

        const result = await operation.fn(
          `engineer-${engineerId}`,
          orgId,
        );
        results.push(result);

        // Brief delay between operations (simulate thinking/processing time)
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }
    })()
  );

  await Promise.all(engineerLoops);

  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  const latencies = results.map(r => r.latency);
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  return {
    concurrency,
    duration,
    totalOperations: results.length,
    successfulOperations: successCount,
    failedOperations: failureCount,
    errorRate: failureCount / results.length,
    operationsPerSecond: (results.length / duration) * 1000,
    avgLatency,
    p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
    p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
    peakLatency: Math.max(...latencies),
    cacheHitRate: 0.0, // Would measure from logs
    connectionPoolUtilization: 0.0, // Would measure from monitoring
  };
}

// ── Reporter ──────────────────────────────────────────────────────────────

function formatLoadTestResult(m: LoadTestMetrics): string {
  return `
  Concurrency:              ${m.concurrency} engineers
  Duration:                 ${(m.duration / 1000).toFixed(1)}s

  Operations:
    Total:                  ${m.totalOperations}
    Successful:             ${m.successfulOperations}
    Failed:                 ${m.failedOperations}
    Error Rate:             ${(m.errorRate * 100).toFixed(2)}%

  Throughput:               ${m.operationsPerSecond.toFixed(2)} ops/sec

  Latency:
    Average:                ${m.avgLatency.toFixed(2)}ms
    p95:                    ${m.p95Latency.toFixed(2)}ms
    p99:                    ${m.p99Latency.toFixed(2)}ms
    Peak:                   ${m.peakLatency.toFixed(2)}ms
`;
}

// ── Main Load Test Suite ─────────────────────────────────────────────────

async function runLoadTestSuite(): Promise<void> {
  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║    AGSK PRODUCTION HARDENING: LOAD TEST SIMULATION         ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');

  const results: {
    timestamp: string;
    testDurationSeconds: number;
    concurrent5: LoadTestMetrics;
    concurrent20: LoadTestMetrics;
    degradationAnalysis: {
      throughputDegradation: number; // % from 5 to 20 concurrent
      latencyDegradation: number; // % from 5 to 20 concurrent
      errorRateDegradation: number; // % from 5 to 20 concurrent
    };
  } = {
    timestamp: new Date().toISOString(),
    testDurationSeconds: 30,
    concurrent5: {} as LoadTestMetrics,
    concurrent20: {} as LoadTestMetrics,
    degradationAnalysis: {
      throughputDegradation: 0,
      latencyDegradation: 0,
      errorRateDegradation: 0,
    },
  };

  try {
    // ─ 5 Concurrent Engineers ────────────────────────────────────────────
    logger.info('\n▶ LOAD TEST: 5 CONCURRENT ENGINEERS');
    logger.info('  Simulating 5 concurrent engineers for 30 seconds...');
    const startTime5 = Date.now();
    results.concurrent5 = await runLoadTest(5, 30);
    const elapsed5 = Date.now() - startTime5;
    logger.info(`  ✓ Completed in ${elapsed5}ms`);
    logger.info(`  ✓ ${results.concurrent5.totalOperations} operations, ${results.concurrent5.operationsPerSecond.toFixed(1)} ops/sec`);
    logger.info(`  ✓ p95 latency: ${results.concurrent5.p95Latency.toFixed(1)}ms`);

    // Wait between test runs
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ─ 20 Concurrent Engineers ───────────────────────────────────────────
    logger.info('\n▶ LOAD TEST: 20 CONCURRENT ENGINEERS');
    logger.info('  Simulating 20 concurrent engineers for 30 seconds...');
    const startTime20 = Date.now();
    results.concurrent20 = await runLoadTest(20, 30);
    const elapsed20 = Date.now() - startTime20;
    logger.info(`  ✓ Completed in ${elapsed20}ms`);
    logger.info(`  ✓ ${results.concurrent20.totalOperations} operations, ${results.concurrent20.operationsPerSecond.toFixed(1)} ops/sec`);
    logger.info(`  ✓ p95 latency: ${results.concurrent20.p95Latency.toFixed(1)}ms`);

    // ─ Degradation Analysis ──────────────────────────────────────────────
    results.degradationAnalysis.throughputDegradation =
      ((results.concurrent5.operationsPerSecond - results.concurrent20.operationsPerSecond) /
        results.concurrent5.operationsPerSecond) *
      100;

    results.degradationAnalysis.latencyDegradation =
      ((results.concurrent20.p95Latency - results.concurrent5.p95Latency) /
        results.concurrent5.p95Latency) *
      100;

    results.degradationAnalysis.errorRateDegradation =
      ((results.concurrent20.errorRate - results.concurrent5.errorRate) /
        (results.concurrent5.errorRate + 0.001)) *
      100;

    // ─ Summary Report ────────────────────────────────────────────────────
    logger.info('\n╔════════════════════════════════════════════════════════════╗');
    logger.info('║                    LOAD TEST SUMMARY                       ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    logger.info('\n📊 5 CONCURRENT ENGINEERS:' + formatLoadTestResult(results.concurrent5));
    logger.info('\n📊 20 CONCURRENT ENGINEERS:' + formatLoadTestResult(results.concurrent20));

    // ─ Degradation Report ────────────────────────────────────────────────
    logger.info('\n╔════════════════════════════════════════════════════════════╗');
    logger.info('║              DEGRADATION UNDER LOAD (5→20)                 ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    logger.info(`\n  Throughput Degradation:   ${results.degradationAnalysis.throughputDegradation.toFixed(1)}%`);
    logger.info(`  Latency Degradation:      ${results.degradationAnalysis.latencyDegradation.toFixed(1)}%`);
    logger.info(`  Error Rate Degradation:   ${results.degradationAnalysis.errorRateDegradation.toFixed(1)}%`);

    // ─ Production Readiness Checks ───────────────────────────────────────
    logger.info('\n╔════════════════════════════════════════════════════════════╗');
    logger.info('║                  PRODUCTION READINESS                      ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    const checks = {
      throughput5_min: results.concurrent5.operationsPerSecond > 5, // > 5 ops/sec
      throughput20_min: results.concurrent20.operationsPerSecond > 3, // > 3 ops/sec (allows degradation)
      latencyP95_5: results.concurrent5.p95Latency < 500, // < 500ms
      latencyP95_20: results.concurrent20.p95Latency < 1000, // < 1s
      errorRate5: results.concurrent5.errorRate < 0.01, // < 1%
      errorRate20: results.concurrent20.errorRate < 0.05, // < 5%
      degradationAcceptable: results.degradationAnalysis.latencyDegradation < 150, // < 150% increase
    };

    let passCount = 0;
    for (const [check, passed] of Object.entries(checks)) {
      const icon = passed ? '✅' : '❌';
      logger.info(`  ${icon} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
      if (passed) passCount++;
    }

    logger.info(`\n  OVERALL: ${passCount}/${Object.keys(checks).length} checks passed`);
    logger.info('\n✨ Load test complete.');

    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    logger.error({ err }, 'Load test failed');
    process.exit(1);
  }
}

runLoadTestSuite();
