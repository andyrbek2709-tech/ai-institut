# TABLE NORMALIZATION STANDARD
## Canonical Table Structure и нормализация таблиц

**Статус:** 🟦 STANDARD DESIGN  
**Дата:** 2026-05-10  
**Версия:** 1.0  
**Ссылка:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → STAGE 4

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **deterministic canonicalization** для инженерных таблиц, независимо от:
- OCR варианта (merged cells interpretation, header detection)
- Форматирования (alignment, decimals, whitespace)
- Locale (запятые vs точки в числах)
- Structural ambiguity (какие ячейки наследуют заголовки)

**Принцип:** Одна physical table → одна canonical structure.

---

## 1️⃣ TABLE TYPE CLASSIFICATION

### Type 1: Simple Rectangular Table (No Merged Cells)

```
┌─────────────┬──────────┬──────────┐
│ Material    │ Strength │ Density  │
├─────────────┼──────────┼──────────┤
│ Steel       │ 250 MPa  │ 7850 kg/m³
│ Aluminum    │ 70 MPa   │ 2700 kg/m³
│ Concrete    │ 30 MPa   │ 2400 kg/m³
└─────────────┴──────────┴──────────┘

Canonical structure:
- 1 header row (Material, Strength, Density)
- 3 data rows
- 3 columns (all aligned)
- No merged cells
- No ambiguity
```

**Normalization:** Straightforward (just normalize values and units).

### Type 2: Hierarchical Header Table

```
┌─────────────────────────────────────┐
│         Mechanical Properties       │
├──────────────────┬──────────────────┤
│  Elastic Modulus │  Yield Strength  │
├──────┬──────────┼──────┬───────────┤
│ E    │ G        │ σ_y  │ τ_y       │
├──────┼──────────┼──────┼───────────┤
│ GPa  │ GPa      │ MPa  │ MPa       │
├──────┼──────────┼──────┼───────────┤
│ 210  │ 80       │ 250  │ 150       │
│ 70   │ 26       │ 70   │ 45        │
└──────┴──────────┴──────┴───────────┘

Canonical structure:
- Level 1 header: 1 cell (merged across 4 columns)
- Level 2 header: 2 cells (merged across 2 columns each)
- Level 3 header: 4 cells (E, G, σ_y, τ_y)
- Level 4 header: 4 cells (units: GPa, GPa, MPa, MPa)
- Data rows: 2
```

**Normalization:**
1. Identify header levels (top-down)
2. Track column group memberships
3. Normalize each level independently
4. Preserve hierarchy structure

### Type 3: Multi-Level Index Table

```
┌─────────┬─────────┬──────────┬──────────┐
│ Grade   │ Temper  │ Strength │ Hardness │
├─────────┼─────────┼──────────┼──────────┤
│ 6061    │ T6      │ 275 MPa  │ 95 HV    │
│         │ T4      │ 170 MPa  │ 65 HV    │
│ 7075    │ T6      │ 570 MPa  │ 150 HV   │
│         │ T73     │ 505 MPa  │ 140 HV   │
└─────────┴─────────┴──────────┴──────────┘

Canonical structure:
- Column 1 (Grade): merged cells for groups
- Column 2 (Temper): individual values within groups
- Columns 3-4: data
- Merged cell in column 1 spans rows 2-3 (grade 6061)
- Merged cell in column 1 spans rows 4-5 (grade 7075)
```

**Normalization:**
1. Identify merged cell boundaries
2. Track which rows belong to which group
3. Normalize group labels
4. Ensure row alignment within groups

### Type 4: Engineering Matrix

```
┌─────────────────────────────────────┐
│    Stiffness Matrix [K] (N/m)       │
├────────┬────────┬────────┬────────┬──┤
│  K11   │  K12   │  K13   │  K14   │..│
├────────┼────────┼────────┼────────┼──┤
│  K21   │  K22   │  K23   │  K24   │..│
├────────┼────────┼────────┼────────┼──┤
│  ...   │  ...   │  ...   │  ...   │..│
└────────┴────────┴────────┴────────┴──┘

Canonical structure:
- Header: single title (merged across all columns)
- Unit specification: (N/m)
- Matrix notation: Kᵢⱼ
- Square matrix (4×4 shown, potentially larger)
```

**Normalization:**
1. Preserve matrix structure (square or rectangular)
2. Normalize subscripts (K_11 → K₁₁)
3. Canonicalize units
4. Track matrix dimensions

### Type 5: Decision/Lookup Table

```
┌──────────┬──────────┬──────────┐
│ Condition│ Action   │ Result   │
├──────────┼──────────┼──────────┤
│ σ < σ_y  │ Elastic  │ Continue │
│ σ ≥ σ_y  │ Plastic  │ Check    │
└──────────┴──────────┴──────────┘

Canonical structure:
- 3 columns (logical structure)
- 2 data rows (decision branches)
- Text values (not numeric)
```

**Normalization:**
1. Normalize formula expressions (σ < σ_y)
2. Preserve decision logic
3. Normalize action descriptions
4. Keep result mapping consistent

---

## 2️⃣ TABLE STRUCTURE CANONICALIZATION

### Rule S1: Header Row Detection

**Table must have exactly 1 canonical header row** (top row or explicit header).

```
Input:
┌────────┬────────┐
│ Steel  │ 250    │  ← ambiguous: is this header or data?
├────────┼────────┤
│ Alum   │ 70     │
└────────┴────────┘

Normalization:
1. Infer from context: first row looks like categories
2. Canonicalize: ensure header is clearly marked
3. Normalize header values (Steel → steel? Or Material: Steel?)

Output (canonical):
┌──────────────┬──────────┐
│ Material     │ Strength │
├──────────────┼──────────┤
│ Steel        │ 250 MPa  │
│ Aluminum     │ 70 MPa   │
└──────────────┴──────────┘
```

### Rule S2: Column Alignment

**Each column must have consistent data type and unit.**

```
Input:
┌──────┬──────┐
│ σ    │ E    │
├──────┼──────┤
│ 250  │ 210 GPa    │
│ 70   │ 70 GPa     │
│ N/A  │ undefined  │  ← mixed types!
└──────┴──────┘

Normalization:
1. Column 1 (σ): numeric [MPa]
2. Column 2 (E): numeric [GPa]
3. Row 3: flag inconsistent column 1 value (N/A in numeric column)

Output:
┌──────────┬──────────┐
│ σ [MPa]  │ E [GPa]  │
├──────────┼──────────┤
│ 250      │ 210      │
│ 70       │ 70       │
│ NULL     │ NULL     │  ← canonical for missing numeric
└──────────┴──────────┘
```

### Rule S3: Column Unit Normalization

**Each numeric column must have explicit unit.**

```
Input:
┌──────┬──────┐
│ Force│ Area │
├──────┼──────┤
│ 1000 │ 10   │  ← units not specified
└──────┴──────┘

Normalization:
1. Infer units from context (Force → N, Area → mm²)
2. Canonicalize column header
3. Add unit annotation

Output (canonical):
┌──────────────┬──────────────┐
│ Force [N]    │ Area [mm²]    │
├──────────────┼──────────────┤
│ 1000         │ 10           │
└──────────────┴──────────────┘
```

---

## 3️⃣ CELL VALUE NORMALIZATION

### Rule V1: Numeric Formatting

| Case | Input | Canonical | Rule |
|------|-------|-----------|------|
| Decimal | 250.50 | 250.5 | Remove trailing zeros |
| Locale | 250,5 | 250.5 | Convert comma to period |
| Integer | 250 | 250 | Keep as is |
| Scientific | 1e-5 | 1×10⁻⁵ | Engineering notation |
| Precision | 250.5000 | 250.5 | Standardize to minimal |

**Правила:**
- **V1a:** Decimal separator → . (not ,)
- **V1b:** Trailing zeros → remove (except 1 for .0)
- **V1c:** Scientific notation → ×10ⁿ format

```
Input row:
┌──────────────┬──────────────┐
│ 250,50       │ 0.00001      │
└──────────────┴──────────────┘

Canonical row:
┌──────────────┬──────────────┐
│ 250.5        │ 1×10⁻⁵       │
└──────────────┴──────────────┘
```

### Rule V2: Unit Normalization in Cells

Some cells may contain inline units.

```
Input:
┌──────────────┐
│ 250 Мпа      │
└──────────────┘

Normalization:
1. Separate value from unit: 250 | Мпа
2. Normalize unit: Мпа → MPa
3. Normalize spacing: 250MPa → 250 MPa

Canonical:
┌──────────────┐
│ 250 MPa      │
└──────────────┘

Better (unit in header):
┌──────────────┐
│ Strength [MPa]
├──────────────┤
│ 250          │
└──────────────┘
```

### Rule V3: Empty Cell Handling

| Symbol | Meaning | Canonical | Rule |
|--------|---------|-----------|------|
| NULL | Missing data | **NULL** | Standard |
| — | Missing/undefined | **NULL** | Convert |
| N/A | Not applicable | **NULL** | Convert |
| 0 | Actual zero | **0** | Different from NULL! |
| — (dash) | Separator | **NULL** | Context-dependent |

```
Input:
┌──────┬──────┐
│ σ    │ τ    │
├──────┼──────┤
│ 250  │ —    │
│ 70   │ N/A  │
│ 0    │ NULL │
└──────┴──────┘

Canonical:
┌──────┬──────┐
│ σ [MPa]
│ τ [MPa]
├──────┼──────┤
│ 250  │ NULL │
│ 70   │ NULL │
│ 0    │ NULL │
└──────┴──────┘
```

**⚠️ CRITICAL:** Zero (0) ≠ NULL. Preserve both.

---

## 4️⃣ MERGED CELL NORMALIZATION

### Rule M1: Header Inheritance

Merged cells in header inherit to all columns below.

```
Input:
┌─────────────────────────────┐
│    Mechanical Properties    │  ← merged header
├──────────────┬──────────────┤
│ σ_y [MPa]    │ E [GPa]      │
├──────────────┼──────────────┤
│ 250          │ 210          │
└──────────────┴──────────────┘

Canonical structure:
- Group header: "Mechanical Properties" (spans 2 columns)
  - Column 1: σ_y [MPa]
  - Column 2: E [GPa]
- Row 1 data: 250, 210
```

**Rule M1a:** Each column under merged header inherits the group name.
```
Canonical annotation:
  Column 1: [Mechanical Properties] σ_y [MPa]
  Column 2: [Mechanical Properties] E [GPa]
```

### Rule M2: Data Row Index Inheritance

Merged cells in row index (first column) inherit to all cells to the right.

```
Input:
┌────────┬──────┬──────┐
│ Steel  │ 250  │ 80   │  ← merged row index
│        │      │      │
│        │ 210  │ 75   │
└────────┴──────┴──────┘

Canonical structure:
- Group: Steel (rows 1-2)
  - Row 1: σ_y=250, E=80 (implied: Material=Steel)
  - Row 2: σ_y=210, E=75 (implied: Material=Steel)

Normalized:
┌────────────┬──────┬──────┐
│ Material   │ σ_y  │ E    │
├────────────┼──────┼──────┤
│ Steel      │ 250  │ 80   │
│ Steel      │ 210  │ 75   │
└────────────┴──────┴──────┘
```

---

## 5️⃣ TABLE NORMALIZATION WORKFLOW

```
┌─────────────────────────────────────┐
│ EXTRACTED TABLE (OCR, raw)          │
└────────────┬────────────────────────┘
             │
    ┌────────▼──────────┐
    │ STEP 1:           │
    │ Classify table    │
    │ type              │
    └────────┬──────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 2:                    │
    │ Detect header rows/cols    │
    │ (merged cells)             │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 3:                    │
    │ Normalize header values    │
    │ (symbols, units)           │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 4:                    │
    │ Normalize cell values      │
    │ (numerics, decimals)       │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 5:                    │
    │ Normalize units per column │
    │ (MPa, mm², etc.)           │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ CANONICAL TABLE STRUCTURE │
    │ (ready for lineage)        │
    └────────────────────────────┘
```

---

## 6️⃣ TABLE NORMALIZATION EXAMPLES

### Example 1: Simple Material Properties Table

```
Input (OCR variant):
┌────────────┬────────────┬────────────┐
│Material    │Strength Мпа│Density kg/ │  ← misaligned headers
├────────────┼────────────┼────────────┤
│Steel       │250.50      │ 7850,0     │  ← comma decimal, typo in unit
│Aluminum    │70.00       │ 2700.0     │
└────────────┴────────────┴────────────┘

Normalization steps:
1. Classify: Simple rectangular (no merged cells) → Type 1
2. Header detection: Row 1 is header
3. Normalize headers:
   - "Material" → "Material"
   - "Strength Мпа" → "Strength [MPa]" (normalize unit)
   - "Density kg/" → "Density [kg/m³]" (incomplete unit)
4. Normalize cell values:
   - 250.50 → 250.5 (remove trailing zero)
   - 7850,0 → 7850.0 (convert comma)
   - 70.00 → 70 (remove trailing zeros)
5. Unit normalization:
   - Мпа → MPa
   - kg/ → kg/m³ (infer m³)

Canonical output:
┌──────────────┬─────────────────┬──────────────────┐
│ Material     │ Strength [MPa]   │ Density [kg/m³]  │
├──────────────┼─────────────────┼──────────────────┤
│ Steel        │ 250.5            │ 7850.0           │
│ Aluminum     │ 70               │ 2700.0           │
└──────────────┴─────────────────┴──────────────────┘
```

### Example 2: Hierarchical Header Table

```
Input (OCR variant with merged cells):
┌─────────────────────────────────┐
│  Elastic Modulus and Yield      │  ← merged header row
├──────────────────┬──────────────┤
│  Modulus         │  Strength    │  ← level 2 headers (merged)
├──────┬───────────┼──────┬───────┤
│ E    │ G         │ σ_y  │ τ_y   │  ← level 3 headers
├──────┼───────────┼──────┼───────┤
│GPa   │ GPa       │ МПа  │ МПа   │  ← units (different locale)
├──────┼───────────┼──────┼───────┤
│210   │ 80        │250   │150    │
│70    │ 26        │70    │45     │
└──────┴───────────┴──────┴───────┘

Normalization:
1. Classify: Hierarchical headers → Type 2
2. Merged cell tracking:
   - Row 1: "Elastic Modulus and Yield" (spans 4 columns)
   - Row 2: "Modulus" (spans 2), "Strength" (spans 2)
3. Header normalization:
   - Level 1: "Elastic Modulus and Yield"
   - Level 2: "Modulus" → "Elastic Modulus", "Strength" → "Yield Strength"
   - Level 3: E, G, σ_y, τ_y (normalize subscripts: σ_y → σᵧ)
   - Unit row: Мпа → MPa
4. Cell normalization: 250 → 250 (already clean)
5. Merged cell hierarchy tracked:
   - Column 1 under "Modulus": E [GPa]
   - Column 2 under "Modulus": G [GPa]
   - Column 3 under "Strength": σᵧ [MPa]
   - Column 4 under "Strength": τᵧ [MPa]

Canonical output:
┌─────────────────────────────────────────────────────┐
│           Elastic Modulus and Yield Strength        │
├─────────────────────────┬───────────────────────────┤
│ Elastic Modulus         │ Yield Strength            │
├──────────────┬──────────┼──────────────┬────────────┤
│ E [GPa]      │ G [GPa]  │ σᵧ [MPa]     │ τᵧ [MPa]   │
├──────────────┼──────────┼──────────────┼────────────┤
│ 210          │ 80       │ 250          │ 150        │
│ 70           │ 26       │ 70           │ 45         │
└──────────────┴──────────┴──────────────┴────────────┘
```

### Example 3: Index Table with Merged Rows

```
Input:
┌──────────┬──────────┬──────────┐
│ Grade    │ Strength │ Hardness │
├──────────┼──────────┼──────────┤
│ 6061     │ 275 MPa  │ 95 HV    │
│          │ 170 MPa  │ 65 HV    │  ← Row 2-3 same grade
│ 7075     │ 570 MPa  │ 150 HV   │
│          │ 505 MPa  │ 140 HV   │  ← Row 4-5 same grade
└──────────┴──────────┴──────────┘

Normalization:
1. Classify: Index table → Type 3
2. Identify merged row indices:
   - Grade 6061: rows 2-3
   - Grade 7075: rows 4-5
3. Normalize values (units to canonical):
   - Мпа → MPa, Па → Pa (if any)
   - All units → canonical forms
4. Merged cell tracking:
   - Row 2: (6061, 275 MPa, 95 HV)
   - Row 3: (6061, 170 MPa, 65 HV) [6061 inherited from row 2]
   - Row 4: (7075, 570 MPa, 150 HV)
   - Row 5: (7075, 505 MPa, 140 HV) [7075 inherited from row 4]

Canonical output:
┌──────────┬──────────────┬──────────────┐
│ Grade    │ Strength [MPa]│ Hardness [HV]│
├──────────┼──────────────┼──────────────┤
│ 6061     │ 275          │ 95           │
│ 6061     │ 170          │ 65           │
│ 7075     │ 570          │ 150          │
│ 7075     │ 505          │ 140          │
└──────────┴──────────────┴──────────────┘

Or alternatively (explicit merged cell notation):
┌──────────┬──────────────┬──────────────┐
│ Grade    │ Strength [MPa]│ Hardness [HV]│
├──────────┼──────────────┼──────────────┤
│ 6061 ×2  │ 275; 170     │ 95; 65       │  ← explicit merger notation
│ 7075 ×2  │ 570; 505     │ 150; 140     │
└──────────┴──────────────┴──────────────┘
```

---

## 7️⃣ TABLE VALIDATION DURING NORMALIZATION

### Check T1: Rectangular Consistency

All rows have same number of columns.

```
Invalid:
┌──────┬──────┬──────┐
│ a    │ b    │ c    │
├──────┼──────┤
│ 1    │ 2    │      │  ← missing column 3!
└──────┴──────┘

Must normalize or flag AMBIGUOUS.
```

### Check T2: Header-Data Alignment

Each column has consistent data type across all rows.

```
Invalid:
┌──────┬──────┐
│ σ    │ E    │
├──────┼──────┤
│ 250  │ 210  │
│ text │ 70   │  ← σ column mixed numeric/text!
└──────┴──────┘

Must normalize or flag AMBIGUOUS.
```

### Check T3: Unit Consistency

All numeric values in column have same unit.

```
Invalid:
┌──────────────┐
│ Stress [MPa] │
├──────────────┤
│ 250          │
│ 0.25 kPa     │  ← unit mismatch!
└──────────────┘

Normalize: 0.25 kPa → 0.00025 MPa or flag for review.
```

---

## 8️⃣ TABLE NORMALIZATION CHECKLIST

**Before marking table as CANONICAL:**

- ✅ Table type classified (simple, hierarchical, index, matrix, decision)
- ✅ Header rows identified and normalized
- ✅ Merged cells tracked and structure preserved
- ✅ All numeric values normalized (decimals, notation)
- ✅ All units canonicalized (MPa not Мпа, mm² not mm^2)
- ✅ Columns have consistent data types
- ✅ Empty cells marked as NULL (not —, N/A, etc.)
- ✅ Zero (0) distinguished from NULL
- ✅ Cell values match column units
- ✅ Column unit specifications explicit ([MPa], [kg/m³], etc.)
- ✅ Superscripts/subscripts normalized (σ_y → σᵧ, mm² → mm²)
- ✅ Rectangular consistency verified
- ✅ Merged cell inheritance rules applied
- ✅ Reviewer validated structure

---

## 9️⃣ COMMON TABLE NORMALIZATION ERRORS

| Error | Input | Problem | Canonical |
|-------|-------|---------|-----------|
| Merged cells | Visually merged | OCR interprets as missing | Track structure |
| Unit mismatch | 250 MPa, 0.25 kPa | Mixed units in column | Normalize to MPa |
| Decimal format | 250,50 | Locale comma | 250.5 |
| Missing units | 250 | Unit unspecified | Add [MPa] to header |
| Empty cells | — or N/A | Ambiguous meaning | NULL |
| Alignment | σ vs σ | Symbol variant | σ (canonical) |
| Header inference | No explicit header | First row may be data | Verify context |

---

## 🔟 VERSIONING

**Version 1.0 (2026-05-10):**
- Table type classification (5 types)
- Header row detection and normalization
- Column alignment and unit standardization
- Merged cell handling (header inheritance, row inheritance)
- Cell value normalization (decimals, units, empty cells)
- Validation checks (rectangular consistency, data type, units)
- Table normalization workflow
- Normalization checklist

**Future expansions:**
- Complex matrix tables (large dimensions)
- Time-series tables (temporal normalization)
- Probabilistic tables (confidence/reliability columns)
- Multi-language tables (text normalization)
- Pivot table canonicalization

---

## 📝 ПРИМЕЧАНИЯ

1. **Structure preservation:** Table canonicalization preserves logical structure (merged cells, hierarchy) while normalizing values.
2. **Ambiguity flagging:** If table structure is ambiguous (e.g., unclear if first row is header), flag as AMBIGUOUS for review.
3. **Lineage:** Each table normalization is recorded (source structure → canonical structure).
4. **Reviewer role:** Reviewer validates table structure against this standard, not invents canonical forms.

---

**Следующий документ:** NORMALIZATION_LINEAGE_MODEL.md (traceable normalization with audit trail)
