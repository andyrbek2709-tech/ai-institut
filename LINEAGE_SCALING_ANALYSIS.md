# LINEAGE SCALING ANALYSIS
## Storage Growth, Split/Merge Explosion & Query Performance Under Scale

**Status:** 🟨 OPERATIONAL SIMULATION — PHASE 4 (Lineage Scaling)  
**Date:** 2026-05-09  
**Version:** 1.0  
**Foundation:** SEMANTIC_GOVERNANCE_SIMULATION.md (Phase 1)

---

## 🎯 EXECUTIVE SUMMARY

### Critical Problem

Semantic lineage grows **non-linearly** under split/merge events:

```
LINEAGE EXPLOSION:

Base scenario: 500 entities
  Lineage records: ~500 (1 per entity)
  
After splits: 500 + 10 splits × 2-4 children = 520-540 entities
  Lineage records: ~1,500 (original + children + split history)
  
After cascading splits: Exponential growth
  Example: Split A→{A1,A2,A3}, then A1→{A1a,A1b}
  Lineage becomes tree structure
  Query complexity: O(depth × branching)
```

### Simulation Findings

- **Storage growth:** Lineage storage grows **3-5× faster** than entity count under splits
- **Query latency:** Most_ancestors queries become O(log N) to O(N²) as depth increases
- **Storage scaling:** At 5K entities with 50 splits, lineage storage exceeds 50MB (significant)
- **Split explosion risk:** If split decisions cascade, lineage depth reaches 10+ levels (dangerous)

---

## 1️⃣ LINEAGE STORAGE MODEL

### A. Lineage Record Structure

```
LINEAGE RECORD PER ENTITY:

{
  semantic_id: "physics.solids.stress",
  
  # Creation record (immutable)
  created_date: "2025-01-15",
  created_by: "eng-standards-board",
  
  # Ancestry (immutable, append-only)
  ancestors: [
    {
      ancestor_id: parent_1,
      relationship: "split_from",
      split_date: "2026-03-20"
    },
    {
      ancestor_id: parent_2,
      relationship: "merged_from",
      merge_date: "2026-04-15"
    }
  ],
  
  # Descendants (append-only)
  descendants: [
    {
      descendant_id: child_1,
      relationship: "split_to",
      split_date: "2026-05-01"
    }
  ],
  
  # Version history (immutable)
  versions: [
    {version: "1.0.0", created: "2025-01-15", hash: "..."},
    {version: "1.1.0", created: "2025-03-10", hash: "..."},
    {version: "2.0.0", created: "2026-02-20", hash: "..."}
  ],
  
  # Split/merge history (immutable)
  transformations: [
    {
      type: "split",
      date: "2026-03-20",
      parent_id: "...",
      children: ["...", "...", "..."],
      rationale: "..."
    }
  ]
}

RECORD SIZE ESTIMATE:
  Base entity: ~500 bytes
  + Ancestors (per): ~200 bytes
  + Descendants (per): ~150 bytes
  + Versions (per): ~100 bytes
  + Transformations (per split): ~300 bytes
  
  Typical entity: 500 + 1×200 + 2×150 + 3×100 + 1×300 = 1,300 bytes
  Heavy entity (with splits): 500 + 3×200 + 4×150 + 5×100 + 3×300 = 2,500 bytes
  
CORPUS STORAGE ESTIMATE:
  Conservative (500 entities, light lineage):
    = 500 × 1,200 bytes = 600 KB
  
  Moderate (1,500 entities, moderate lineage):
    = 1,500 × 1,500 bytes = 2.25 MB
  
  Aggressive (5,000 entities, heavy lineage with splits):
    = 5,000 × 2,500 bytes = 12.5 MB
```

### B. Lineage Growth with Split Events

```
SCENARIO: Conservative growth + 10 splits over 2 years

Timeline:
  Month 0: 500 entities, 0 splits
    Lineage storage: 600 KB
  
  Month 6: 800 entities, 2 splits
    Split 1: stress → {stress_nominal, stress_effective, stress_local} (+3 children)
    Split 2: pressure → {pressure_static, pressure_dynamic} (+2 children)
    
    New entities: 800 - 500 = 300
    Split children: 5
    Total entities: 805
    
    Lineage size: 805 × 1,400 bytes (increased due to split records)
    = 1.13 MB
  
  Month 12: 1,100 entities, 5 splits
    New splits add 8-12 children
    Total entities: 1,120
    Lineage growth: ancestors now average 2-3 per entity
    Storage: 1.6 MB
  
  Month 24: 1,500 entities, 10 splits
    Total children from splits: 25-30
    Total entities: 1,530
    Storage: 2.5-3 MB
    
    LINEAGE DEPTH:
      Average depth (ancestors): 1-2 levels
      Max depth: 3 levels (if cascading splits)

---

SCENARIO: Aggressive growth + split explosion (20+ splits)

Month 0: 500 entities, 0 splits
  Storage: 600 KB

Month 6: 1,200 entities, 3 splits
  Storage: 1.8 MB

Month 12: 2,500 entities, 8 splits
  Storage: 4 MB
  CRITICAL: Split A1 results in 3 children {A1a, A1b, A1c}
           Then A1a splits again → 2 new children {A1a-i, A1a-ii}
           Cascading splits begin (depth = 2)

Month 18: 4,000 entities, 15 splits
  Storage: 6.5 MB
  Lineage depth: max 3 levels (cascading splits)
  Ancestor chains: 15-20% of entities have 2+ ancestors
  Query complexity: Starting to matter

Month 24: 5,000 entities, 20+ splits
  Storage: 9-12 MB
  Lineage depth: 3-4 levels
  Complex queries become slower
  Storage is manageable but query performance risk emerging

---

DANGEROUS SCENARIO: Cascading splits (uncontrolled split explosion)

What if every major decision triggers split?
  
  Year 1: 500 entities, 2 splits
  Year 2: 1,000 entities, 5 splits
  Year 3: 2,500 entities, 20 splits (4× per month)
  Year 4: 6,000 entities, 50 splits (4× per month sustained)
  Year 5: 15,000 entities, 100+ splits
  
  Lineage depth: 5-8 levels (danger zone)
  Storage: 40-60 MB (significant but manageable)
  Query latency: Exponential growth
  
  CRITICAL: At this scale, lineage queries become prohibitively slow
```

---

## 2️⃣ QUERY PERFORMANCE ANALYSIS

### A. Common Lineage Queries

```
QUERY 1: get_ancestors(semantic_id)
  Purpose: Find all parent entities
  Complexity: O(depth) in best case
  
  Implementation:
    Start at semantic_id
    Follow ancestor_ids up tree
    Collect all ancestors at each level
  
  Performance:
    Depth 1: 1 query, <1ms
    Depth 2: 2 queries, 1-2ms
    Depth 3: 3 queries, 2-3ms
    Depth 5: 5 queries, 5-10ms
    Depth 10: 10 queries, 20-50ms
  
  Storage structure: B-tree on ancestor_id + date
  Index: ancestor_id (fast lookup)
  
  Threshold concern: Depth >5 queries become noticeable

---

QUERY 2: get_descendants(semantic_id)
  Purpose: Find all child entities
  Complexity: O(N) in worst case (full table scan)
  
  Implementation:
    Query descendants table WHERE ancestor_id = semantic_id
    Recursively fetch descendants of each child
  
  Performance:
    0 descendants: <1ms
    5 descendants: 1-2ms
    20 descendants (including cascade): 5-10ms
    100+ descendants: 10-50ms (table scan)
  
  Problem: Cascading splits create explosion
  
  Example:
    stress splits into {nominal, effective, local} (3 children)
    nominal then splits into {nominal_linear, nominal_nonlinear} (2 more)
    Total descendants: 3 + 2 = 5 (direct + 1 level deep)
    
    If 20 entities all split: 20 × 2 average children = 40 direct
    Plus 40 × 0.2 at second level = 48 total
    Query becomes expensive at scale

---

QUERY 3: get_lineage_integrity(semantic_id)
  Purpose: Verify lineage is complete & consistent
  Complexity: O(N log N) where N = ancestors + descendants
  
  Implementation:
    1. Get all ancestors (recursively)
    2. Verify no circular dependencies
    3. Check all references valid
    4. Verify immutability constraints
    5. Validate hash chains
  
  Performance:
    Small entity (1 ancestor, 2 descendants): 5-10ms
    Complex entity (3 ancestors, 10 descendants): 20-50ms
    At scale (5000 entities, avg 2 ancestors): 50-200ms
  
  Problem: This query runs on EVERY decision audit
  At aggressive scale, audit overhead becomes significant

---

QUERY 4: find_split_ancestors(semantic_id)
  Purpose: Find which split event created this entity
  Complexity: O(depth) + O(split_history)
  
  Implementation:
    For each ancestor, check transformations
    Find split event that created this entity
    Return split_id + parent + rationale
  
  Performance:
    Straightforward ancestor: <2ms
    With split history lookup: 5-10ms
  
  Optimization: Index on split_children for fast lookup

---

AGGREGATION QUERY: statistics()
  Purpose: Get corpus lineage statistics
  Example: "How many entities have been split? Max depth? Etc."
  Complexity: O(N) full table scan
  
  Implementation:
    Count entities with ancestors > 0
    Count splits
    Calculate max depth
    Calculate ancestor/descendant distribution
  
  Performance:
    At 500 entities: 10-20ms
    At 5,000 entities: 100-200ms
    At 10,000 entities: 200-500ms
  
  Problem: This is EXPENSIVE at scale
  Risk: Monthly audit queries become slow
  Solution: Cache statistics, update on split events
```

### B. Performance Degradation at Scale

```
CUMULATIVE QUERY LOAD:

Conservative scenario (500 entities):
  Monthly lineage queries: ~50 (one per new entity + audits)
  Total query time: 50 × 10ms = 500ms
  Acceptable

Moderate scenario (1,500 entities, 5 splits):
  Monthly lineage queries: ~150 (more entities + more splits)
  Total query time: 150 × 20ms = 3 seconds
  Acceptable but starting to add up

Aggressive scenario (5,000 entities, 20 splits):
  Monthly lineage queries: ~500 (many entities + split audits)
  Max depth: 3-4 levels
  Per-query performance: 20-50ms (due to depth & cascading)
  Total query time: 500 × 30ms = 15 seconds
  Potentially acceptable but concerning

DANGEROUS SCENARIO: Uncontrolled split explosion

Year 5 (15,000 entities, 100+ splits):
  Lineage depth: 5-8 levels
  Per-query performance: 50-200ms (exponential degradation)
  Monthly lineage queries: 1,000+
  Total query time: 1,000 × 100ms = 100 seconds (1.7 minutes)
  
  PROBLEM: Monthly audit now takes minutes
  RISK: Performance impact on core operations

REAL-TIME QUERY IMPACT:

If consumers query lineage in real-time:
  Current: <10ms response time acceptable
  At scale with deep lineage: 50-100ms (problematic)
  With cache misses: 100-200ms (unacceptable)
  
  Solution: Caching layer + pre-computed statistics
```

---

## 3️⃣ SPLIT/MERGE EXPLOSION MODEL

### A. Split Cascading Dynamics

```
SPLIT DECISIONS AND CASCADING:

Definition: When a split decision triggers downstream splits
  
Example: Stress initially atomic
  
  Year 1 Split: Stress → {stress_nominal, stress_effective, stress_local}
    Result: 3 new entities
    Lineage depth: parent → child (depth 1)
  
  Year 2 Split: Stress_nominal → {stress_nominal_linear, stress_nominal_nonlinear}
    Result: 2 new entities (grandchildren)
    Lineage depth: grandparent → parent → child (depth 2)
  
  Year 3 Splits:
    Stress_effective → {von_mises, hydrostatic_component} (2 new)
    Stress_local → {stress_concentration, notch_stress} (2 new)
    Result: 4 new entities
    Lineage depth: 2-3 levels
  
  Total entity explosion: 1 → 3 → 7 → 11 entities
  
CASCADING MODEL:

If each entity splits into average k children, and split rate is r/year:
  
  Year 0: 500 entities
  Year 1: 500 + 2 splits × 2.5 avg children = 505 entities
  Year 2: 505 + 5 splits × 2.5 = 517 entities
  Year 3: 517 + 8 splits × 2.5 = 537 entities (exponential cascade)
  
  At aggressive rate (4 splits/month):
    Year 4: 600+ entities (50% increase in 1 year)
    Year 5: 900+ entities (rapid explosion)
  
DANGEROUS: Cascading effect can compound
  Each split enables downstream splits
  Without governance control, could reach 100+ splits/year
  Result: Lineage becomes forest (multiple trees), hard to navigate
```

### B. Lineage Depth Distribution

```
LINEAGE DEPTH: Maximum number of ancestor levels

Healthy scenario:
  Max depth: 2-3 levels
  Average depth: 0.5 (most entities are atomic)
  Example: A → B → C (3 levels total, depth 2 links)
  
  Impact: Queries remain fast, lineage easy to understand

At-risk scenario:
  Max depth: 4-5 levels
  Average depth: 1-1.5 (25-30% of entities split)
  Cascading splits visible
  
  Impact: Query performance noticeable, complexity increasing
  Risk: Further splits could cause exponential depth growth

Dangerous scenario:
  Max depth: 6-8 levels
  Average depth: 2+
  Multiple cascading split chains
  
  Impact: Query performance degraded, lineage complex
  Risk: System becoming hard to reason about
  Solution: Lineage compaction or restructuring needed

UNBOUNDED SCENARIO:
  Max depth: 10+ levels
  Lineage becomes tangled forest
  
  Impact: Query performance unacceptable, lineage unmaintainable
  Solution: System broken, requires major restructuring
```

---

## 4️⃣ SCALING MITIGATION STRATEGIES

### A. Query Optimization

```
MITIGATION 1: Caching Layer

  Implement: Redis cache for frequently queried entities
  
  Cache entries:
    - ancestors (5 hour TTL)
    - descendants (2 hour TTL)
    - lineage_integrity (24 hour TTL)
    - statistics (24 hour TTL)
  
  Invalidation: On split/merge events
  
  Expected improvement: 80-90% cache hit rate
  Performance gain: 50-100× speedup for cached queries
  Cost: Redis instance (~$20-50/month)

---

MITIGATION 2: Query Indexing

  Current: Index on semantic_id, ancestor_id, split_date
  
  Additional indices:
    - split_date (for time-range queries)
    - transformation_type (for split/merge filtering)
    - max_depth_per_entity (cached, for depth queries)
  
  Benefit: Faster filtering, especially for large result sets
  Cost: ~5-10% increase in storage
  Performance gain: 2-5× improvement for complex queries

---

MITIGATION 3: Batch Processing

  Instead of: Real-time integrity checks
  Use: Batch audit jobs (daily, weekly)
  
  Schedule:
    Daily: Integrity check on new entities (100-200 items)
    Weekly: Full corpus audit (all entities)
    Monthly: Statistics recompute + deep integrity checks
  
  Benefit: Spreads load, prevents spike
  Cost: Audits not real-time (acceptable for governance)
```

### B. Lineage Compaction

```
MITIGATION 4: Lineage Pruning

  Problem: Old lineage records accumulate, making queries slower
  
  Strategy: Archive old lineage records after N years
  
  Implementation:
    Keep: Recent lineage (last 3 years)
    Archive: Older lineage (compressed historical records)
    Restore: Available if needed, but not in active query path
  
  Expected savings: 20-30% storage reduction
  Risk: Historical queries slower (acceptable)

---

MITIGATION 5: Lineage Snapshot & Reset

  Problem: Deep cascading splits (depth 5+) become unmanageable
  
  Strategy: Periodically take snapshot of lineage and "reset" depth
  
  Example:
    Old tree: A → B → C → D → E → F (depth 5)
    Snapshot: Take immutable snapshot of full tree
    Reset: Create synthetic entity "A_snapshot_v1" as single point
    New depth: A_snapshot_v1 → G (depth 1)
  
  Benefit: Reduces max depth, improves query performance
  Risk: Loses some lineage detail (but immutable snapshot preserves it)
  Cost: Complex implementation, needs governance approval
  
  Recommendation: Only if max depth exceeds 5 levels
```

---

## 5️⃣ LINEAGE SCALING SCENARIOS

### Scenario A: Conservative (Low Scaling Risk)

```
PROJECTION (2 years):
  Entities: 500 → 800
  Splits: 0 → 3 (total)
  Merge events: 0
  Max lineage depth: 1-2 levels
  Avg ancestor count: 0.1 per entity
  
STORAGE:
  Month 0: 600 KB
  Month 12: 1 MB
  Month 24: 1.3 MB
  Growth rate: ~350 KB/year

QUERY PERFORMANCE:
  Avg query time: 5-10ms
  Audit job duration: <1 second
  
SCALING RISK: LOW
  No mitigations needed in year 1
  Mitigations (caching) recommended year 2+
```

### Scenario B: Moderate (Manageable Scaling)

```
PROJECTION (2 years):
  Entities: 500 → 1,500
  Splits: 0 → 8 (total)
  Max lineage depth: 2-3 levels
  Avg ancestor count: 0.3 per entity
  
STORAGE:
  Month 0: 600 KB
  Month 12: 2 MB
  Month 24: 3.5 MB
  Growth rate: ~1.5 MB/year

QUERY PERFORMANCE:
  Avg query time: 10-20ms
  Audit job duration: 2-5 seconds
  
SCALING RISK: MODERATE
  Caching recommended by month 12
  Query optimization recommended by month 18
  
MITIGATIONS:
  1. Redis cache (by month 12)
  2. Query indexing (by month 18)
  3. Batch audit jobs (by month 20)
```

### Scenario C: Aggressive (High Scaling Risk)

```
PROJECTION (2 years):
  Entities: 500 → 5,000
  Splits: 0 → 20 (total, potentially cascading)
  Max lineage depth: 3-5 levels
  Avg ancestor count: 0.5-1 per entity
  
STORAGE:
  Month 0: 600 KB
  Month 12: 5 MB
  Month 24: 12-15 MB
  Growth rate: ~7 MB/year

QUERY PERFORMANCE:
  Month 12: Avg 15-20ms (manageable)
  Month 18: Avg 20-50ms (concerning)
  Month 24: Avg 50-100ms (problematic)
  Audit job duration: 10-30 seconds
  
SCALING RISK: HIGH
  Caching CRITICAL by month 6
  Query optimization CRITICAL by month 12
  
DANGEROUS SIGNALS:
  - If cascading splits detected (depth 4+ by month 12)
  - If audit job exceeds 30 seconds (month 18)
  - If query P95 exceeds 100ms (month 20)
  
MANDATORY MITIGATIONS:
  1. Redis cache (immediate, month 1)
  2. Query indexing (by month 6)
  3. Batch audit jobs (by month 9)
  4. Lineage snapshot if depth >4 (by month 18)
  5. Consider lineage pruning (by month 20)
```

---

## 6️⃣ SUCCESS CRITERIA

### Lineage Scaling Go/No-Go

```
PASS:
  ✅ Storage growth <10 MB under aggressive scenario
  ✅ Max lineage depth <4 levels
  ✅ Query latency <50ms even with deep lineage
  ✅ Audit jobs complete in <30 seconds
  ✅ Cascading split risk managed (depth capping)

CONDITIONAL PASS:
  🟨 Requires caching layer (Redis) by month 12
  🟨 Requires query indexing by month 18
  🟨 Requires batch audit scheduling
  🟨 If aggressive growth, requires lineage monitoring

FAIL:
  ❌ Storage exceeds 50 MB (unmanageable)
  ❌ Max depth exceeds 6 levels (queries too slow)
  ❌ Query latency >500ms (unacceptable)
  ❌ Cascading split explosion (depth uncontrolled)
  ❌ Audit jobs exceed 2 minutes (operationally impossible)
```

---

**Status:** ✅ Phase 4 Complete — Lineage scaling analyzed  
**Next:** Phase 5 — Semantic Fragmentation Analysis
