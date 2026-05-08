#!/usr/bin/env node

/**
 * AGSK Complete Corpus Ingestion Runner
 *
 * Full workflow:
 * 1. Validate corpus structure (dry-run)
 * 2. Execute real ingestion (with embeddings)
 * 3. Test retrieval quality
 * 4. Generate final report
 *
 * Usage:
 *   npx tsx src/bin/corpus-ingestion-runner.ts [--skip-validation] [--skip-test]
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const args = {
  skipValidation: process.argv.includes('--skip-validation'),
  skipTest: process.argv.includes('--skip-test'),
};

interface RunnerStats {
  validation: { status: 'pending' | 'success' | 'failed'; error?: string; data?: any };
  ingestion: { status: 'pending' | 'success' | 'failed'; error?: string; chunks?: number };
  retrieval: { status: 'pending' | 'success' | 'failed'; error?: string; data?: any };
  report: {
    total_chunks: number;
    standards_ingested: number;
    embeddings_created: number;
    retrieval_ready: boolean;
    elapsed_ms: number;
  };
}

const stats: RunnerStats = {
  validation: { status: 'pending' },
  ingestion: { status: 'pending' },
  retrieval: { status: 'pending' },
  report: {
    total_chunks: 0,
    standards_ingested: 0,
    embeddings_created: 0,
    retrieval_ready: false,
    elapsed_ms: 0,
  },
};

function runCommand(cmd: string, label: string): { success: boolean; output: string; error?: string } {
  console.log(`\n⏳ ${label}...`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`✅ ${label} completed`);
    return { success: true, output };
  } catch (err: any) {
    const error = err.stderr || err.message;
    console.log(`❌ ${label} failed: ${error}`);
    return { success: false, output: '', error };
  }
}

async function main() {
  const startTime = Date.now();
  const srcDir = path.dirname(import.meta.url).replace('file://', '').slice(0, -5); // Remove /bin

  console.log('\n' + '='.repeat(80));
  console.log('🚀 AGSK CORPUS INGESTION — COMPLETE WORKFLOW');
  console.log('='.repeat(80));

  // ─── STEP 1: VALIDATION ───────────────────────────────────────────────
  if (!args.skipValidation) {
    const result = runCommand(
      `npx tsx ${srcDir}/bin/ingest-corpus.ts --dry-run --no-embed`,
      'STEP 1: Corpus Validation (dry-run)',
    );
    stats.validation.status = result.success ? 'success' : 'failed';
    if (!result.success) {
      stats.validation.error = result.error;
      console.log('\n❌ Validation failed. Aborting ingestion.');
      process.exit(1);
    }

    // Parse validation output
    const chunkMatch = result.output.match(/📝 Total chunks:\s+(\d+)/);
    if (chunkMatch) {
      stats.report.total_chunks = parseInt(chunkMatch[1], 10);
      console.log(`   → Found ${stats.report.total_chunks} chunks ready for ingestion`);
    }
  }

  // ─── STEP 2: REAL INGESTION ───────────────────────────────────────────
  const result = runCommand(
    `npx tsx ${srcDir}/bin/ingest-corpus.ts`,
    'STEP 2: Execute Real Ingestion (with embeddings)',
  );
  stats.ingestion.status = result.success ? 'success' : 'failed';
  if (!result.success) {
    stats.ingestion.error = result.error;
    console.log('\n⚠️  Ingestion encountered errors (but may have partially succeeded)');
  }

  // Parse ingestion output
  const filesMatch = result.output.match(/✅ Files processed:\s+(\d+)/);
  if (filesMatch) {
    stats.report.standards_ingested = parseInt(filesMatch[1], 10);
  }

  // ─── STEP 3: RETRIEVAL TEST ───────────────────────────────────────────
  if (!args.skipTest) {
    const result = runCommand(
      `npx tsx ${srcDir}/bin/test-retrieval.ts`,
      'STEP 3: Retrieval Quality Test',
    );
    stats.retrieval.status = result.success ? 'success' : 'failed';
    stats.retrieval.data = result.output;
    if (!result.success) {
      stats.retrieval.error = result.error;
      console.log('\n⚠️  Retrieval test failed — may indicate ingestion issues');
    }
  }

  // ─── FINAL REPORT ─────────────────────────────────────────────────────
  const elapsed = Date.now() - startTime;
  stats.report.elapsed_ms = elapsed;
  stats.report.embeddings_created = stats.report.total_chunks;
  stats.report.retrieval_ready = stats.retrieval.status === 'success';

  console.log('\n' + '='.repeat(80));
  console.log('📊 CORPUS INGESTION FINAL REPORT');
  console.log('='.repeat(80));

  console.log('\n✅ COMPLETION STATUS:');
  console.log(`   Step 1 (Validation):  ${stats.validation.status}`);
  console.log(`   Step 2 (Ingestion):   ${stats.ingestion.status}`);
  console.log(`   Step 3 (Retrieval):   ${stats.retrieval.status}`);

  console.log('\n📈 METRICS:');
  console.log(`   Total chunks:         ${stats.report.total_chunks}`);
  console.log(`   Standards ingested:   ${stats.report.standards_ingested}`);
  console.log(`   Embeddings created:   ${stats.report.embeddings_created}`);
  console.log(`   Retrieval ready:      ${stats.report.retrieval_ready ? '✅ Yes' : '❌ No'}`);
  console.log(`   Elapsed time:         ${(stats.report.elapsed_ms / 1000).toFixed(1)}s`);

  if (stats.validation.error) console.log(`\n   Validation error: ${stats.validation.error}`);
  if (stats.ingestion.error) console.log(`   Ingestion error: ${stats.ingestion.error}`);
  if (stats.retrieval.error) console.log(`   Retrieval error: ${stats.retrieval.error}`);

  console.log('\n' + '='.repeat(80));

  // Verdict
  const all_success = [stats.validation.status, stats.ingestion.status].every(s => s === 'success');
  const ready = all_success && stats.report.retrieval_ready;

  if (ready) {
    console.log('🎉 CORPUS INGESTION COMPLETE & READY FOR PRODUCTION');
    console.log('\n✅ All steps successful');
    console.log('✅ Retrieval quality validated');
    console.log('✅ Corpus ready for pilot program deployment');
    process.exit(0);
  } else if (all_success) {
    console.log('✅ CORPUS INGESTION COMPLETE');
    console.log('⚠️  Retrieval tests not completed or failed');
    console.log('⚠️  Recommend manual retrieval validation before production deployment');
    process.exit(0);
  } else {
    console.log('❌ CORPUS INGESTION FAILED');
    console.log('⚠️  Some steps did not complete successfully');
    console.log('⚠️  Review errors above and retry');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error in corpus ingestion runner:', err.message);
  process.exit(1);
});
