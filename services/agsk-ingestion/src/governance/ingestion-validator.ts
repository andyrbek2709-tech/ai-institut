/**
 * AGSK Ingestion Validator
 *
 * Pre-ingestion validation middleware. Runs BEFORE PDF parsing to detect:
 *   1. Policy compliance (standard in approved list)
 *   2. Version conflicts (duplicate, older version already ready)
 *   3. License/access control requirements
 *   4. Duplicate detection (exact standard+version combination)
 *
 * Called by the ingestion job handler after file download, before parsing.
 * Stores validation result in agsk_ingestion_validation table.
 *
 * If validation fails with 'error' severity → abort job.
 * If validation fails with 'warning' severity → proceed but log warning.
 */

import { getSupabaseAdmin } from '../services/supabase.js';
import { logger } from '../utils/logger.js';
import {
  findPolicy,
  detectPolicyFromText,
  validateRevisionPolicy,
  findCorpusGaps,
} from './corpus-policy.js';
import type { ExtractedMetadata } from '../processors/metadata-extractor.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type ValidationStatus = 'passed' | 'failed' | 'warning' | 'skipped';
export type ConflictType =
  | 'version_conflict'
  | 'duplicate_standard'
  | 'unapproved_source'
  | 'license_violation'
  | 'revision_policy_violation'
  | 'unknown';

export interface ValidationResult {
  status:         ValidationStatus;
  checks_run:     string[];
  checks_failed:  string[];
  warnings:       string[];
  conflict_type?: ConflictType;
  conflict_id?:   string;
  details:        Record<string, unknown>;
}

// ── Validation Checks ────────────────────────────────────────────────────

async function checkPolicyApproval(
  standardCode: string,
  documentText: string,
  filename:     string,
): Promise<{ passed: boolean; failed: string[] }> {
  const failed: string[] = [];

  // Try exact match first
  let policy = findPolicy(standardCode);

  // Fallback: detect from document
  if (!policy) {
    policy = detectPolicyFromText(documentText, filename);
  }

  if (!policy) {
    failed.push(`Standard "${standardCode}" not in approved corpus`);
  }

  return { passed: failed.length === 0, failed };
}

async function checkVersionConflicts(
  standardCode: string,
  year:         number | null | undefined,
  version:      string | null | undefined,
  orgId:        string,
): Promise<{ passed: boolean; failed: string[]; conflicts: any[] }> {
  const failed: string[] = [];
  const sb      = getSupabaseAdmin();
  const conflicts: any[] = [];

  // Query RPC to detect conflicts
  const { data: conflictData, error } = await sb.rpc(
    'agsk_detect_version_conflicts',
    {
      p_org_id:        orgId,
      p_standard_code: standardCode,
      p_year:          year ?? null,
      p_version:       version ?? null,
    },
  );

  if (error) {
    logger.warn({ err: error }, 'Version conflict RPC failed, skipping');
    return { passed: true, failed: [], conflicts: [] };
  }

  for (const conflict of conflictData ?? []) {
    conflicts.push(conflict);
    if (conflict.severity === 'error') {
      failed.push(
        `Version conflict: ${conflict.conflict_type} with existing ${conflict.existing_code} (${conflict.existing_year}) — status: ${conflict.existing_status}`
      );
    }
  }

  return { passed: failed.length === 0, failed, conflicts };
}

async function checkRevisionPolicy(
  standardCode: string,
  year:         number | null | undefined,
  version:      string | null | undefined,
): Promise<{ passed: boolean; failed: string[] }> {
  const failed: string[] = [];
  const policy = findPolicy(standardCode);

  if (!policy) {
    return { passed: true, failed };  // policy check already caught this
  }

  const policyError = validateRevisionPolicy(policy, year, version);
  if (policyError) {
    failed.push(policyError);
  }

  return { passed: failed.length === 0, failed };
}

async function checkLicenseCompliance(
  standardCode: string,
  orgId:        string,
): Promise<{ passed: boolean; failed: string[] }> {
  const failed: string[] = [];
  const policy = findPolicy(standardCode);

  if (!policy) {
    return { passed: true, failed };
  }

  // License type 'proprietary' or 'org_license' requires access control
  // In production, would check org's license agreement in a subscriptions table
  if (policy.license_type === 'proprietary') {
    failed.push(`Standard requires proprietary license agreement (not implemented yet)`);
  }

  if (policy.requires_access_ctrl) {
    // Check: does the org have permission to ingest this standard?
    // For now, allow all orgs (licensing module to be added later)
    logger.debug({ standard_code: standardCode }, 'License OK (not yet enforced)');
  }

  return { passed: failed.length === 0, failed };
}

// ── Main validation orchestrator ─────────────────────────────────────────

export async function validateIngestion(
  standardId:    string,
  orgId:         string,
  jobId:         string,
  metadata:      ExtractedMetadata,
  documentText:  string,
  filename:      string,
): Promise<ValidationResult> {
  const checks_run: string[] = [];
  const checks_failed: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = {
    standard_code:  metadata.standard_code,
    year:           metadata.year,
    version:        metadata.version,
    discipline:     metadata.discipline,
    organization:   metadata.organization,
  };

  let status: ValidationStatus = 'passed';
  let conflict_type: ConflictType | undefined;
  let conflict_id: string | undefined;

  // ─ Check 1: Policy Approval ────────────────────────────────────────────
  {
    checks_run.push('policy_approval');
    const result = await checkPolicyApproval(
      metadata.standard_code,
      documentText,
      filename,
    );
    if (!result.passed) {
      checks_failed.push('policy_approval');
      checks_failed.push(...result.failed);
      status = 'failed';
      conflict_type = 'unapproved_source';
    }
  }

  // ─ Check 2: Version Conflicts ──────────────────────────────────────────
  {
    checks_run.push('version_conflicts');
    const result = await checkVersionConflicts(
      metadata.standard_code,
      metadata.year,
      metadata.version,
      orgId,
    );
    details.version_conflicts = result.conflicts;
    if (!result.passed) {
      checks_failed.push('version_conflicts');
      checks_failed.push(...result.failed);
      status = 'failed';
      conflict_type = 'version_conflict';
      if (result.conflicts.length > 0) {
        conflict_id = result.conflicts[0].existing_id;
      }
    }
  }

  // ─ Check 3: Revision Policy ───────────────────────────────────────────
  {
    checks_run.push('revision_policy');
    const result = await checkRevisionPolicy(
      metadata.standard_code,
      metadata.year,
      metadata.version,
    );
    if (!result.passed) {
      checks_failed.push('revision_policy');
      checks_failed.push(...result.failed);
      status = 'failed';
      conflict_type = 'revision_policy_violation';
    }
  }

  // ─ Check 4: License Compliance ─────────────────────────────────────────
  {
    checks_run.push('license_compliance');
    const result = await checkLicenseCompliance(metadata.standard_code, orgId);
    if (!result.passed) {
      // License failures are logged but do NOT block (for now)
      warnings.push(...result.failed);
      details.license_warning = true;
    }
  }

  // ─ Determine overall status ─────────────────────────────────────────────
  if (checks_failed.length > 0) {
    status = 'failed';
  } else if (warnings.length > 0) {
    status = 'warning';
  }

  const result: ValidationResult = {
    status,
    checks_run,
    checks_failed,
    warnings,
    conflict_type,
    conflict_id,
    details,
  };

  // ─ Persist validation result ────────────────────────────────────────────
  await persistValidation(standardId, jobId, orgId, result);

  logger.info(
    { standard_id: standardId, job_id: jobId, status, failed: checks_failed },
    'Ingestion validation complete',
  );

  return result;
}

async function persistValidation(
  standardId: string,
  jobId:      string,
  orgId:      string,
  result:     ValidationResult,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('agsk_ingestion_validation')
    .insert({
      standard_id:     standardId,
      job_id:          jobId,
      org_id:          orgId,
      validation_status: result.status,
      policy_violation: result.checks_failed.join(' | ') || null,
      conflict_type:   result.conflict_type || null,
      conflict_with_id: result.conflict_id || null,
      checks_run:      result.checks_run,
      checks_failed:   result.checks_failed,
      warnings:        result.warnings,
      details:         result.details as any,
    });

  if (error) {
    logger.error({ err: error }, 'Failed to persist validation result');
  }
}

/**
 * Report corpus gaps (Tier-1 critical standards not yet ingested).
 */
export async function reportCorpusGaps(orgId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data: standards, error } = await sb
    .from('agsk_standards')
    .select('standard_code')
    .eq('org_id', orgId)
    .eq('status', 'ready');

  if (error) {
    logger.warn({ err: error }, 'Failed to fetch ingested standards');
    return [];
  }

  const ingestedCodes = (standards ?? []).map((s: any) => s.standard_code);
  const gaps = findCorpusGaps(ingestedCodes);

  return gaps.map(g => g.standard_code);
}
