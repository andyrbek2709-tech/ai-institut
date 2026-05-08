# Table Truth Validation Architecture

> **Specialized Ground Truth Validation for Engineering Tables**
>
> *Tables are the second-highest risk OCR domain. This architecture ensures structural integrity, cell accuracy, and alignment validation.*

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** 🟡 **CRITICAL SPECIALIZED VALIDATION**  
**Implements:** GROUND_TRUTH_GOVERNANCE.md — LAYER 6 (Specialized Validation)

---

## Executive Summary

Tables are **the second-highest OCR risk** because:

```
Structural misalignment →
  ├─ Row drift (data from row N appears in row N+1)
  ├─ Column misalignment (pressure values in temperature column)
  ├─ Merged cell confusion (header spans multiple columns, OCR misses)
  ├─ Hierarchical header collapse (nested headers flattened)
  ├─ Cell value transposition (numbers swapped)
  ├─ Empty cell mishandling (null vs zero)
  └─ Engineering table complexity (units per column, multiple dimensions)
```

**This system ensures:**
- ✅ Table structure verification (rows, columns, merged cells)
- ✅ Header validation (hierarchical, units, metadata)
- ✅ Cell value accuracy (per-column context)
- ✅ Alignment integrity (no row/column drift)
- ✅ Unit standardization (per-column normalization)
- ✅ Empty cell handling (null vs zero vs N/A)
- ✅ Cross-cell consistency (logical relationships)

---

## Core Principle

**Table ground truth is NOT cell-by-cell OCR. It is structurally verified matrix with validated values.**

Ground truth table:
- **Structurally sound** (correct number of rows, columns, merged cells)
- **Column-context aware** (each column has consistent units/type)
- **Semantically consistent** (rows logically related, no transpositions)
- **Alignment-verified** (no row/column drift from original)

---

## PHASE 1: Table Classification & Structure Mapping

### Step 1: Identify Table Type

```
TYPE A: Simple Rectangular Table
  ├─ Fixed rows × fixed columns
  ├─ Single header row
  ├─ No merged cells
  ├─ All cells populated
  └─ Example: Material properties table (5 materials × 4 properties)

TYPE B: Hierarchical Header Table
  ├─ Multi-level column headers
  ├─ Headers span multiple rows
  ├─ Merged cells in header area
  ├─ Complex logical grouping
  └─ Example: Performance data (with sub-headers: Temperature [°C], Pressure [MPa], Stress [MPa])

TYPE C: Multi-Level Index Table
  ├─ Hierarchical row index (nested categories)
  ├─ Merged cells in row header area
  ├─ Example: Standards table grouped by standard family (ISO 6, ISO 7, IEC 61)

TYPE D: Engineering Matrix Table
  ├─ Dense numeric data
  ├─ Multiple units per column
  ├─ Footnotes reference specific cells
  ├─ Precision varies per column
  └─ Example: Material constants matrix (E, G, ν, α per material)

TYPE E: Equation/Formula Table
  ├─ First column: variable names (Greek + Latin + Cyrillic)
  ├─ Second column: formulas or equations
  ├─ Third column: units or descriptions
  └─ Example: Formula reference table (σ = F/A, Pa; τ = M/W, Pa)

TYPE F: Multi-Table Layout
  ├─ Multiple sub-tables in one figure
  ├─ Shared header, separate data sections
  ├─ Example: Standards comparison (Table 6a: ISO standard, 6b: GOST standard, 6c: IEC standard)

TYPE G: Decision Table / Matrix
  ├─ Row criteria vs column criteria
  ├─ Cell contains decision/recommendation
  ├─ Example: Material selection matrix (material type × temperature range → recommended use)
```

### Step 2: Map Table Structure

```
STRUCTURE MAPPING PROCESS:
═══════════════════════════════════════════════════════════

EXAMPLE TABLE (von Mises Stress Materials):

┌─────────────────┬──────────────────────────────────────────────┐
│ Material        │ Yield Strength σ_y [MPa]                     │
│ (Type)          │ @ 20°C    @ 100°C    @ 200°C   @ 300°C      │
├─────────────────┼──────────────────────────────────────────────┤
│ Steel 1018      │ 370       320        280       240           │
│ Aluminum 6061   │ 276       250        220       190           │
│ Titanium TC4    │ 880       820        750       700           │
└─────────────────┴──────────────────────────────────────────────┘

STRUCTURAL MAPPING:
  ├─ Table dimensions: 3 rows (data) × 5 columns (1 index + 4 data)
  ├─ Header rows: 2 (row 1: "Material", "Yield Strength..."; row 2: "(Type)", "@ 20°C", etc.)
  ├─ Header structure:
  │   ├─ Column 0: row index (material names)
  │   ├─ Column 1-4: temperature variants (merged header "Yield Strength @ [temp]")
  │   └─ Merged cell: (row=0, col=1-4) spans "Yield Strength σ_y [MPa]"
  │
  ├─ Row index: [Material type, (Type descriptor)]
  ├─ Column headers: [@ 20°C, @ 100°C, @ 200°C, @ 300°C]
  ├─ Column units: all [MPa] (inherited from header "σ_y [MPa]")
  ├─ Data cells: 3×4 numeric values
  │   ├─ Steel 1018: [370, 320, 280, 240]
  │   ├─ Aluminum 6061: [276, 250, 220, 190]
  │   └─ Titanium TC4: [880, 820, 750, 700]
  │
  └─ Special properties:
      ├─ Empty cells: none
      ├─ Merged cells: header (column 1-4 for main header)
      ├─ Footnotes: none
      └─ Units per column: all MPa (consistent)

VALIDATION CHECKLIST:
  [ ] Number of rows correct (3 data rows + 2 headers)
  [ ] Number of columns correct (5 total)
  [ ] Merged cells correct (header spans columns 1-4)
  [ ] Column headers extracted correctly
  [ ] Row index extracted correctly
  [ ] Units per column identified
  [ ] Temperature conditions all present (20, 100, 200, 300)
```

---

## PHASE 2: Header Validation

### Header Extraction Protocol

```
HEADER EXTRACTION:
═══════════════════════════════════════════════════════════

STEP 1: Identify Header Rows
  ├─ Locate row(s) with column labels
  ├─ Distinguish header rows from data rows
  │   Example: Row 0-1 = header (labels), Row 2-4 = data (numbers)
  └─ Mark header boundaries in lineage

STEP 2: Extract Column Metadata
  For each column:
    ├─ Column name (e.g., "Yield Strength σ_y")
    ├─ Column units (e.g., "[MPa]")
    ├─ Column data type (numeric, text, formula)
    ├─ Temperature/condition (if applicable)
    ├─ Precision expected (e.g., integers, 1 decimal, 2 decimals)
    └─ Special values handled (N/A, —, blank)

STEP 3: Validate Header Correctness
  Verification:
    ├─ Symbols in header correct (σ_y not σY or 6_y)
    ├─ Units standard (MPa not mpa, not MP2, not Mpa)
    ├─ Temperature notation consistent (°C vs C vs C°)
    ├─ Special characters preserved (subscript in σ_y)
    ├─ Column labels match data types (numeric header → numeric data)
    └─ Units per column consistent throughout

STEP 4: Handle Hierarchical Headers
  Example:
    ┌─────────────────┬───────────── Yield Strength σ_y [MPa] ─────────────┐
    │ Material        │    @ 20°C    @ 100°C    @ 200°C    @ 300°C         │
    
  Process:
    ├─ Identify hierarchy: "Yield Strength" is parent, temperatures are children
    ├─ Parse structure: 1 header (parent) × 4 sub-headers (children)
    ├─ Merge units: all 4 columns inherit [MPa] from parent
    ├─ Maintain child distinction: keep temperature differences
    └─ Result:
        Column 1: name="Yield Strength @ 20°C", units="[MPa]"
        Column 2: name="Yield Strength @ 100°C", units="[MPa]"
        Column 3: name="Yield Strength @ 200°C", units="[MPa]"
        Column 4: name="Yield Strength @ 300°C", units="[MPa]"
```

---

## PHASE 3: Cell Value Validation

### Cell Accuracy Protocol

```
CELL VALIDATION:
═══════════════════════════════════════════════════════════

STEP 1: Type Validation (per column)
  For numeric column (e.g., stress values):
    ├─ Each cell must be: number, optional unit, optional footnote
    ├─ Reject: text, formulas (unless formula column explicitly)
    ├─ Example: "370" ✓, "370 MPa" ✓ (redundant unit), "≈370" ✓, "~370" ✓
    │           "370 MPa ¹" ✓ (with footnote), "high" ✗, "σ_y=370" ✗

  For text column (e.g., material names):
    ├─ Each cell must be: descriptive text
    ├─ Example: "Steel 1018" ✓, "Aluminum 6061" ✓, "Titanium TC4" ✓
    │           "370" ✗ (should be material name, not number)

STEP 2: Precision Validation
  For numeric values:
    ├─ Identify expected precision per column (from header/context)
    ├─ Example: "Stress [MPa]" usually expects integers or 1 decimal
    ├─ Validate: "370" (0 decimals) ✓, "370.0" (1 decimal) ✓
    │            "370.00" (2 decimals) ✓, "370.001" (3 decimals) ? (verify)
    ├─ Detect precision loss: "37" instead of "370" (decimal lost?)
    └─ Detect precision inflation: "370.00000" (extra precision added?)

STEP 3: Value Range Validation
  For engineering values:
    ├─ Material strength: typically 0-2000 MPa (reject negative or >10000)
    ├─ Temperature: typically -273 to +1200°C (reject unrealistic values)
    ├─ Pressure: typically 0-1000 MPa (reject very large values)
    ├─ Detect unit errors:
    │   ├─ If "Stress [MPa]" shows "370000", likely unit error (should be 370 MPa, not 370000 MPa)
    │   ├─ If "Temperature [°C]" shows "4500", likely decimal error (should be 450°C)
    │   └─ Cross-reference with material properties (physical reasonableness)

STEP 4: Cell Transposition Detection
  For multi-row/column numeric data:
    ├─ Verify: within-column consistency (stress values all in reasonable range)
    ├─ Verify: within-row trend (e.g., stress should decrease with temperature)
    │   Example: Steel stress @ [20, 100, 200, 300]°C should be ~[370, 320, 280, 240]
    │            If seen as [370, 280, 320, 240], row is out-of-order
    └─ Detect: column drift
        Example: If pressure column values match stress column values → misalignment

STEP 5: Cross-Cell Consistency
  For related cells:
    ├─ If table has ratio/percentage column: verify math
    │   Example: Column A = 100, Column B = 50, Column "B/A %" should = 50%
    ├─ If table has sum rows: verify totals
    ├─ If table references other data: verify logical consistency
    └─ Example: If table references earlier table, material properties should match

EXAMPLE CELL VALIDATION:

Table Cell: (Row=2, Col=2) Value: "320"
Context: Material=Aluminum 6061, Header=Yield Strength @ 100°C [MPa]

Validation:
  ├─ Type: numeric ✓
  ├─ Precision: integers (0 decimals) ✓ (matches column pattern)
  ├─ Range: 250-300 MPa expected for Al 6061 @ 100°C
  │   Value 320 MPa: slightly high but possible (depends on alloy) → PROBABLE
  ├─ Trend: should be < value @ 20°C (which was 276)
  │   320 > 276: CONTRADICTORY (should be lower at higher temp)
  │   → ESCALATE: likely transposition or OCR error
  └─ Status: AMBIGUOUS (requires human review for physical reasonableness)
```

---

## PHASE 4: Structural Alignment Verification

### Alignment Protocol

```
ROW ALIGNMENT VERIFICATION:
═══════════════════════════════════════════════════════════

STEP 1: Row Boundary Detection
  Identify where each row starts/ends:
    ├─ Visual boundaries: horizontal lines in table
    ├─ Content boundaries: natural breaks in row data
    ├─ Example: if table shows:
    │   Row 1: Steel 1018      370  320  280  240
    │   Row 2: Aluminum 6061   276  250  220  190
    │   → Verify: 5 cells per row, clear row boundary between rows

STEP 2: Row Drift Detection
  Detect if values "drift" to wrong rows:
    ├─ Pattern: if row N has only partial data (missing columns)
    │           and row N+1 starts with numbers that "continue" row N
    │   → ROW DRIFT DETECTED
    ├─ Example (bad OCR):
    │   Row 1: Steel 1018      370  320  280
    │   Row 2:                240  Aluminum 6061  276  250
    │   → Values "240" belongs with "Steel 1018", not Row 2
    │   → Row boundary is wrong
    └─ Fix: realign rows to correct boundaries

STEP 3: Column Alignment Verification
  Verify column boundaries:
    ├─ Visual alignment: values line up under correct column headers
    ├─ Type consistency: all values in column have same data type
    │   Example: Column "Yield Strength [MPa]" should have ALL numeric
    │            If one cell has text "high" instead of number → MISALIGNMENT
    ├─ Unit consistency: all values in column have same units
    │   Example: if one cell shows "276", next shows "276 MPa", next shows "27.6 MPa"
    │            → unit inconsistency or column misalignment
    └─ Merged cell handling: verify merged headers don't shift column boundaries

COLUMN ALIGNMENT EXAMPLE:

Correct OCR:
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Material        │ @ 20°C   │ @ 100°C  │ @ 200°C  │ @ 300°C  │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Steel 1018      │ 370      │ 320      │ 280      │ 240      │
│ Aluminum 6061   │ 276      │ 250      │ 220      │ 190      │
│ Titanium TC4    │ 880      │ 820      │ 750      │ 700      │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘

Misaligned OCR (column drift):
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Material        │ @ 20°C   │ @ 100°C  │ @ 200°C  │ @ 300°C  │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Steel 1018      │ 370      │ 320      │ 280      │ 240      │
│ Aluminum 6061   │ 276      │ 220      │ 250      │ 190      │  ← swapped 250/220
│ Titanium TC4    │ 880      │ 750      │ 820      │ 700      │  ← swapped 750/820
└─────────────────┴──────────┴──────────┴──────────┴──────────┘

Detection: Temperature trend broken (100°C should be < 20°C)
→ ESCALATE: column misalignment
```

---

## PHASE 5: Merged Cell Handling

### Merged Cell Protocol

```
MERGED CELL VALIDATION:
═══════════════════════════════════════════════════════════

STEP 1: Identify Merged Cells
  Locate all cells that span multiple rows/columns:
    ├─ Example: header "Yield Strength σ_y [MPa]" spans columns 1-4
    ├─ Mark: (row=0, col=1-4, value="Yield Strength σ_y [MPa]")
    ├─ Verify: merged cell boundaries from source image
    └─ Document in lineage

STEP 2: Inheritance Rules
  Merged cells create logical inheritance:
    ├─ RULE 1: Child columns inherit units from parent header
    │   Example: Parent "Stress [MPa]" + Child "@ 20°C" = "Stress @ 20°C [MPa]"
    │
    ├─ RULE 2: Child rows inherit category from parent row
    │   Example: Parent "Pressure (Pa)" + Child "Critical" = "Pressure (Pa) — Critical"
    │
    └─ RULE 3: Merged cell value applies to all child cells logically
        Example: If "Safety Factor [unit less]" is merged header,
                 all child cells should be unitless ratios

STEP 3: OCR Challenges with Merged Cells
  Common errors:
    ├─ Merged header text duplicated in first child cell
    │   Example: Cell(row=0, col=1) = "Yield Strength σ_y [MPa] @ 20°C"
    │            instead of just: "@ 20°C"
    │   Fix: extract "@ 20°C" only, inherit "Yield Strength σ_y [MPa]"
    │
    ├─ Merged cell value lost entirely
    │   Example: Parent header "Yield Strength [MPa]" OCR'ed as empty
    │            Child cells become ambiguous (units unknown)
    │   Fix: recover from image or cross-reference with other tables
    │
    └─ Merged cell boundaries wrong
        Example: Header spans columns 1-3, OCR thinks it spans 1-4
        Result: misaligned unit inheritance
        Fix: verify boundaries from visual image

STEP 4: Merged Cell Ground Truth
  Record for each merged cell:
    ├─ Merged cell ID: (row, col_start, col_end or row_start, row_end)
    ├─ Merged cell value: exact text
    ├─ Child cells: which cells inherit from this merge
    ├─ Inherited property: what each child inherits (units, category)
    └─ Verification: merged boundaries match source image
```

---

## PHASE 6: Empty Cell & Special Value Handling

### Empty Cell Protocol

```
EMPTY CELL HANDLING:
═══════════════════════════════════════════════════════════

CONTEXT: Cells can be intentionally empty OR missing due to OCR:

CASE 1: Intentionally Empty
  Context: Cell is physically empty in source (no value)
  Example: Material property matrix where some properties not defined for material
    ┌─────────────┬──────────────┬──────────────┐
    │ Material    │ Thermal Cond. │ Electrical   │
    │             │ [W/m·K]       │ Conductivity │
    ├─────────────┼──────────────┼──────────────┤
    │ Copper      │ 400           │ (not listed) │
    │             │               │              │
    └─────────────┴──────────────┴──────────────┘
  
  Handling:
    ├─ Mark as: NULL (explicitly missing)
    ├─ Not represented as: "0", "N/A", "—", blank
    ├─ OR check source: does source show "—" or is page blank?
    └─ Ground truth: NONE (intentionally not measured/defined)

CASE 2: OCR Missed Data
  Context: Cell has value in source, but OCR couldn't read it
  Example: Low contrast, artifact, degraded scan
  Handling:
    ├─ Detection: pattern suggests value should exist (row has data, column has data)
    │   Example: "Steel 1018" row has [370, 320, 280, —] (last missing)
    │            Should be 240 based on pattern
    ├─ Recovery: human review source image to extract correct value
    ├─ Confidence: PROBABLE or AMBIGUOUS (image unclear)
    └─ Ground truth: extracted value with low confidence

CASE 3: Special Values
  N/A, —, ∞, ×, †, etc.
  
  Handling:
    ├─ IF symbol is: "—" (em dash / long dash)
    │   → Meaning: NOT APPLICABLE or NOT AVAILABLE
    │   → OCR often confuses: — vs - vs – (different dashes)
    │   → Ground truth: use "N/A" (canonical)
    │
    ├─ IF symbol is: "×" or "✕"
    │   → Meaning: NOT ALLOWED or NOT SUITABLE
    │   → Ground truth: use "NOT ALLOWED" (or "×" if explicitly in source)
    │
    ├─ IF symbol is: "∞" or "inf"
    │   → Meaning: INFINITE or VERY LARGE
    │   → Ground truth: keep as "∞" (symbolic), not "999999" (numeric)
    │
    └─ IF symbol is: "†" footnote marker
        → Meaning: see footnote
        → Ground truth: include "†" in cell, document footnote separately

EXAMPLE TABLE WITH EMPTY CELLS:

Source:
┌──────────────┬────────┬────────┬────────┐
│ Test Type    │ Min    │ Typical│ Max    │
│              │ [MPa]  │ [MPa]  │ [MPa]  │
├──────────────┼────────┼────────┼────────┤
│ Tensile      │ 400    │ 450    │ 500    │
│ Shear        │ 300    │ 350    │ —      │
│ Torsion      │ —      │ —      │ —      │
└──────────────┴────────┴────────┴────────┘

Ground Truth Cell Values:
  ├─ (Row 1, Col 3): "500" ✓
  ├─ (Row 2, Col 3): "N/A" (—) ← intentionally missing, normalized
  ├─ (Row 3, Col 1-3): "N/A" (—) ← test type not applicable
  └─ Confidence: REVIEWED (special value handling documented)
```

---

## PHASE 7: Multi-Reviewer Table Validation

### Table Validation Checklist

```
TABLE VALIDATION CHECKLIST
═════════════════════════════════════════════════════════════════

[ ] 1. STRUCTURE INTEGRITY
    [ ] Row count correct
    [ ] Column count correct
    [ ] Merged cells present and boundaries correct
    [ ] Header rows identified and extracted
    [ ] Row index (if applicable) extracted correctly

[ ] 2. HEADER VALIDATION
    [ ] Column names extracted correctly (no symbol corruption)
    [ ] Column units present and normalized
    [ ] Column data types consistent with headers
    [ ] Hierarchical headers maintained (if multi-level)
    [ ] Temperature/condition notation consistent (°C vs C vs °C)

[ ] 3. CELL CONTENT ACCURACY
    [ ] Numeric values: correct precision (0 decimals, 1 decimal, etc.)
    [ ] Numeric values: within expected range (physical reasonableness)
    [ ] Text cells: correct terminology (Steel 1018, not steel 1018)
    [ ] Formula cells: correct formula notation (if applicable)
    [ ] Special values: N/A, ×, ∞ correct (not "0", not "N/a")

[ ] 4. ALIGNMENT VERIFICATION
    [ ] No row drift (values in correct rows)
    [ ] No column shift (values in correct columns)
    [ ] Row boundaries clear and correct
    [ ] Column boundaries clear and correct
    [ ] Merged cells don't cause misalignment

[ ] 5. DATA CONSISTENCY
    [ ] Within-column consistency (same type/units throughout)
    [ ] Within-row logic (trends correct, e.g., temp increases → stress decreases)
    [ ] Cross-cell math (if applicable): ratios, sums verified
    [ ] No obvious transpositions or swaps

[ ] 6. MULTILINGUAL/SYMBOL HANDLING (if applicable)
    [ ] Greek letters in headers correct (σ not Σ, not 6)
    [ ] Cyrillic characters (if present) correct
    [ ] Mixed-language headers handled correctly
    [ ] Subscripts/superscripts present in formulas (σ_y not σy)

[ ] 7. EMPTY CELLS
    [ ] Empty cells are intentionally empty (not OCR misses)
    [ ] Special values (—, ×, ∞) are interpreted correctly
    [ ] Empty cells documented (NULL vs N/A vs —)
    [ ] No accidentally omitted data cells

[ ] 8. LINEAGE & TRACEABILITY
    [ ] Table source documented (standard, datasheet, paper)
    [ ] Reviewer chain complete (A, B, specialist)
    [ ] Merged cell inheritance documented
    [ ] Special value mappings documented
    [ ] Confidence level assigned (VERIFIED/REVIEWED/PROBABLE/AMBIGUOUS)
```

---

## PHASE 8: Disagreement Resolution for Tables

### Common Table Disagreements

```
DISAGREEMENT TYPE 1: Merged Cell Interpretation
═════════════════════════════════════════════════════════════
Reviewer-A: Header "Yield Strength [MPa]" spans columns 1-4 (all temperatures)
Reviewer-B: Header "Yield Strength [MPa]" spans column 1 only, temperature is separate

Resolution:
  ├─ Check source image: how far does merged header line extend?
  ├─ Verify: do all child columns have consistent units?
  ├─ Arbitration: visual boundaries determine merge span
  └─ Final: merge boundaries locked in lineage

DISAGREEMENT TYPE 2: Empty Cell Interpretation
═════════════════════════════════════════════════════════════
Reviewer-A: Cell is empty (no value in source)
Reviewer-B: Cell should have "0" (zero, not empty)

Resolution:
  ├─ Check source image: is there a printed "0" or is it blank?
  ├─ Context: does "0" make sense (e.g., stress can be 0, temperature typically ≠ 0)?
  ├─ Arbitration: if image blank → NULL; if "0" printed → 0
  └─ Final: ground truth set based on source image verification

DISAGREEMENT TYPE 3: Number Precision/Rounding
═════════════════════════════════════════════════════════════
Reviewer-A: Cell value = "370.0" (1 decimal)
Reviewer-B: Cell value = "370" (integer)

Resolution:
  ├─ Check source image: how many decimals shown (370 or 370.0)?
  ├─ Check column pattern: are other cells also 1 decimal?
  ├─ Arbitration: match source exactly
  ├─ Normalization: consistent with column precision
  └─ Final: REVIEWED (if normalized consistently, not VERIFIED)

DISAGREEMENT TYPE 4: Unit Normalization
═════════════════════════════════════════════════════════════
Reviewer-A: Column header = "[MPa]"
Reviewer-B: Column header = "[Mpa]" or "[mpa]"

Resolution:
  ├─ Standards: MPa (mega + pascal) = uppercase M, lowercase Pa
  ├─ Normalization: ALL column headers must be "[MPa]" (canonical)
  ├─ Inconsistency: if cell shows "[kPa]" (different unit), escalate
  └─ Final: REVIEWED (normalized to consistent unit notation)

DISAGREEMENT TYPE 5: Row/Column Order Discrepancy
═════════════════════════════════════════════════════════════
Reviewer-A: Materials in order [Steel, Aluminum, Titanium]
Reviewer-B: Materials in order [Aluminum, Steel, Titanium] (appears reordered)

Resolution:
  ├─ Check source image: exact order in source
  ├─ NO REORDERING in ground truth (preserve source order)
  ├─ If OCR reordered: error, fix to source order
  └─ Final: VERIFIED (source order exactly preserved)
```

---

## Summary

**Table ground truth validation ensures:**
- ✅ Correct structure (rows, columns, merged cells)
- ✅ Valid headers (names, units, hierarchies)
- ✅ Accurate cell values (type, precision, range)
- ✅ Alignment integrity (no row/column drift)
- ✅ Unit consistency (per-column normalization)
- ✅ Empty cell handling (NULL vs zero vs N/A)
- ✅ Cross-cell logic (within-row trends verified)
- ✅ Multi-reviewer consensus
- ✅ Complete lineage
- ✅ Confidence assignment (VERIFIED/REVIEWED/PROBABLE/AMBIGUOUS)

**Critical:** Table is **NOT** OCR-extracted candidate. It is **validated matrix** with verified structure and values, ready for pilot calibration.

**Next:** GROUND_TRUTH_LINEAGE.md for complete audit trail and GROUND_TRUTH_RELEASE_GATE.md for corpus approval criteria.
