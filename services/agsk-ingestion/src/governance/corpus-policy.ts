/**
 * AGSK Corpus Governance Policy
 *
 * Defines the approved standards corpus, revision rules, and
 * license/provenance requirements. Loaded by the ingestion validator
 * before accepting any new standard.
 *
 * This is the local (static) policy layer. The authoritative policy
 * is persisted in agsk_corpus_policy (migration 023) for dynamic updates.
 * This file acts as a seed / fallback for offline validation.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type RevisionPolicy = 'latest_only' | 'any_revision' | 'pinned' | 'min_year';
export type LicenseType    = 'proprietary' | 'open_access' | 'org_license' | 'public_domain' | 'fair_use';
export type PriorityTier   = 1 | 2 | 3;

export interface StandardPolicy {
  standard_code:        string;
  canonical_name:       string;
  organization:         string;
  discipline:           string;
  priority_tier:        PriorityTier;
  revision_policy:      RevisionPolicy;
  min_year?:            number;
  pinned_version?:      string;
  license_type:         LicenseType;
  requires_access_ctrl: boolean;
  // Patterns that uniquely identify this standard in document text
  detection_patterns:   RegExp[];
  notes?:               string;
}

// ── Approved Standards Corpus ─────────────────────────────────────────────

export const APPROVED_STANDARDS: StandardPolicy[] = [
  // ── TIER 1: CRITICAL — Pipeline Engineering ───────────────────────────
  {
    standard_code:        'API 5L',
    canonical_name:       'Specification for Line Pipe',
    organization:         'API',
    discipline:           'pipeline',
    priority_tier:        1,
    revision_policy:      'min_year',
    min_year:             2012,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/API\s*5L/i, /SPEC\s*5L/i, /line\s+pipe\s+specification/i],
  },
  {
    standard_code:        'API 1104',
    canonical_name:       'Welding of Pipelines and Related Facilities',
    organization:         'API',
    discipline:           'welding',
    priority_tier:        1,
    revision_policy:      'min_year',
    min_year:             2013,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/API\s*1104/i, /welding\s+of\s+pipelines/i],
  },
  {
    standard_code:        'ASME B31.4',
    canonical_name:       'Pipeline Transportation Systems for Liquids and Slurries',
    organization:         'ASME',
    discipline:           'pipeline',
    priority_tier:        1,
    revision_policy:      'min_year',
    min_year:             2016,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/ASME\s*B31\.4/i, /pipeline\s+transportation.*liquid/i],
  },
  {
    standard_code:        'ASME B31.8',
    canonical_name:       'Gas Transmission and Distribution Piping Systems',
    organization:         'ASME',
    discipline:           'pipeline',
    priority_tier:        1,
    revision_policy:      'min_year',
    min_year:             2016,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/ASME\s*B31\.8/i, /gas\s+transmission.*distribution/i],
  },
  {
    standard_code:        'NACE MR0175',
    canonical_name:       'Petroleum and Natural Gas Industries — Materials for Use in H2S-Containing Environments',
    organization:         'AMPP',
    discipline:           'corrosion',
    priority_tier:        1,
    revision_policy:      'latest_only',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/NACE\s*MR0175/i, /ISO\s*15156/i, /H2S.{0,20}environment/i],
  },
  {
    standard_code:        'NACE SP0169',
    canonical_name:       'Control of External Corrosion on Underground or Submerged Metallic Piping Systems',
    organization:         'AMPP',
    discipline:           'corrosion',
    priority_tier:        1,
    revision_policy:      'latest_only',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/NACE\s*SP0169/i, /NACE\s*RP0169/i, /external\s+corrosion.*underground/i],
  },
  {
    standard_code:        'ГОСТ 20295',
    canonical_name:       'Трубы стальные сварные для магистральных газонефтепроводов',
    organization:         'ГОСТ',
    discipline:           'pipeline',
    priority_tier:        1,
    revision_policy:      'any_revision',
    license_type:         'public_domain',
    requires_access_ctrl: false,
    detection_patterns:   [/ГОСТ\s*20295/i, /трубы\s+стальные\s+сварные.*магистраль/i],
  },
  {
    standard_code:        'СТ РК ISO 3183',
    canonical_name:       'Petroleum and Natural Gas Industries — Steel Pipe for Pipeline Transportation Systems',
    organization:         'КазСтандарт',
    discipline:           'pipeline',
    priority_tier:        1,
    revision_policy:      'latest_only',
    license_type:         'public_domain',
    requires_access_ctrl: false,
    detection_patterns:   [/СТ\s*РК\s*ISO\s*3183/i, /ISO\s*3183/i],
  },

  // ── TIER 2: STANDARD ─────────────────────────────────────────────────
  {
    standard_code:        'ASME B31.3',
    canonical_name:       'Process Piping',
    organization:         'ASME',
    discipline:           'pipeline',
    priority_tier:        2,
    revision_policy:      'min_year',
    min_year:             2016,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/ASME\s*B31\.3/i, /process\s+piping/i],
  },
  {
    standard_code:        'ASME Section IX',
    canonical_name:       'Welding, Brazing, and Fusing Qualifications',
    organization:         'ASME',
    discipline:           'welding',
    priority_tier:        2,
    revision_policy:      'min_year',
    min_year:             2017,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/ASME\s*Section\s*IX/i, /welding.*brazing.*fusing.*qualif/i],
  },
  {
    standard_code:        'AWS D1.1',
    canonical_name:       'Structural Welding Code — Steel',
    organization:         'AWS',
    discipline:           'welding',
    priority_tier:        2,
    revision_policy:      'min_year',
    min_year:             2015,
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/AWS\s*D1\.1/i, /structural\s+welding\s+code.*steel/i],
  },
  {
    standard_code:        'OSHA 1910',
    canonical_name:       'Occupational Safety and Health Standards (General Industry)',
    organization:         'OSHA',
    discipline:           'general',
    priority_tier:        2,
    revision_policy:      'any_revision',
    license_type:         'public_domain',
    requires_access_ctrl: false,
    detection_patterns:   [/OSHA\s*1910/i, /29\s*CFR\s*1910/i],
  },
  {
    standard_code:        'NFPA 58',
    canonical_name:       'Liquefied Petroleum Gas Code',
    organization:         'NFPA',
    discipline:           'fire_safety',
    priority_tier:        2,
    revision_policy:      'latest_only',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/NFPA\s*58/i, /liquefied\s+petroleum\s+gas\s+code/i],
  },

  // ── TIER 3: SUPPLEMENTARY ─────────────────────────────────────────────
  {
    standard_code:        'ASTM A106',
    canonical_name:       'Standard Specification for Seamless Carbon Steel Pipe for High-Temperature Service',
    organization:         'ASTM',
    discipline:           'mechanical',
    priority_tier:        3,
    revision_policy:      'any_revision',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/ASTM\s*A106/i, /seamless\s+carbon\s+steel\s+pipe.*high.temp/i],
  },
  {
    standard_code:        'DNV-ST-F101',
    canonical_name:       'Submarine Pipeline Systems',
    organization:         'DNV',
    discipline:           'pipeline',
    priority_tier:        3,
    revision_policy:      'latest_only',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/DNV[\s-]*ST[\s-]*F101/i, /submarine\s+pipeline\s+systems/i],
  },
  {
    standard_code:        'BS 7910',
    canonical_name:       'Guide to Methods for Assessing the Acceptability of Flaws in Metallic Structures',
    organization:         'BSI',
    discipline:           'structural',
    priority_tier:        3,
    revision_policy:      'latest_only',
    license_type:         'org_license',
    requires_access_ctrl: true,
    detection_patterns:   [/BS\s*7910/i, /acceptability\s+of\s+flaws/i],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────

const policyMap = new Map<string, StandardPolicy>(
  APPROVED_STANDARDS.map(p => [p.standard_code.toUpperCase(), p])
);

export function findPolicy(standardCode: string): StandardPolicy | undefined {
  return policyMap.get(standardCode.toUpperCase());
}

export function detectPolicyFromText(text: string, filename: string): StandardPolicy | undefined {
  const sample = filename + ' ' + text.slice(0, 3000);
  return APPROVED_STANDARDS.find(p =>
    p.detection_patterns.some(rx => rx.test(sample))
  );
}

/**
 * Validate a proposed standard's year against the policy.
 * Returns null if OK, or an error string if policy is violated.
 */
export function validateRevisionPolicy(
  policy:  StandardPolicy,
  year:    number | null | undefined,
  version: string | null | undefined,
): string | null {
  switch (policy.revision_policy) {
    case 'latest_only':
      return null;  // enforced at ingestion time by conflict detection

    case 'min_year':
      if (year == null) return null;  // can't validate without year
      if (year < (policy.min_year ?? 0)) {
        return `${policy.standard_code} requires year >= ${policy.min_year}, got ${year}`;
      }
      return null;

    case 'pinned':
      if (!policy.pinned_version) return null;
      if (version && version !== policy.pinned_version) {
        return `${policy.standard_code} is pinned to version ${policy.pinned_version}, got ${version}`;
      }
      return null;

    case 'any_revision':
    default:
      return null;
  }
}

/**
 * Return all Tier-1 critical standards not yet in the provided inventory.
 * Used to identify corpus gaps.
 */
export function findCorpusGaps(
  ingestedCodes: string[],
): StandardPolicy[] {
  const ingested = new Set(ingestedCodes.map(c => c.toUpperCase()));
  return APPROVED_STANDARDS.filter(
    p => p.priority_tier === 1 && !ingested.has(p.standard_code.toUpperCase())
  );
}
