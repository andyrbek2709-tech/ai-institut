# OCR Pilot Corpus Specification

> **STAGE 1: Pilot Corpus Design**
>
> *Representative pilot dataset for OCR operational validation.*

**Status:** 🟡 **CORPUS DESIGN SPECIFICATION**

**Date:** 2026-05-09  
**Scope:** 50-100 documents, 2,000-3,000 blocks, representative mix

---

## Corpus Overview

### Purpose
Validate OCR operational assumptions on **representative** documents without requiring full production scale.

### Non-Goal
- ❌ NOT a large-scale corpus (that's Phase 4+)
- ❌ NOT cherry-picked (representative, not easy cases)
- ❌ NOT production data yet (control, reproducibility)

### Design Principle
**Controlled chaos** — representative variety with known ground truth.

---

## Corpus Categories

### Category 1: Scanned Standards (15-20 documents, 60-70% of corpus)

**Objective:** Baseline OCR performance on typical engineering documentation

**Description:**
- Representative standards from AGSK (engineering, industrial, process)
- PDF scans at 150-300 DPI (typical document quality)
- Mix of pure text, tables, formulas, figures
- Cyrillic + Latin text (Russian-English mixed)

**Selection Criteria:**
1. **Diversity of standard types:**
   - ISO standards (process, measurement)
   - Industrial engineering standards (materials, stress)
   - Process documentation (procedures, workflows)
   - Regulatory standards (safety, compliance)

2. **Diversity of content:**
   - Pure text (explanations, requirements)
   - Mixed text + tables (lookup tables, specifications)
   - Mixed text + formulas (calculation procedures)
   - Mixed text + figures (diagrams, schemas)

3. **Language mix:**
   - Russian standards (Cyrillic)
   - English standards (Latin)
   - Mixed Russian/English (variable names, units)

**Document Specifications:**

| Attribute | Value | Rationale |
|-----------|-------|-----------|
| Count | 15-20 | Large enough to surface issues, small enough to complete pilot |
| Pages/doc | 30-100 | Typical standard length |
| Total pages | 400-800 | Representative volume |
| DPI | 150-300 | Typical scanning quality |
| Format | PDF/A-2 | Standard compliance |
| Content | 70% text, 20% tables, 10% formulas/figures | Typical distribution |

**Selection Process:**
1. List all AGSK standards (sources: AGSK-1, AGSK-2, AGSK-3)
2. Stratify by type (ISO, industrial, process, regulatory)
3. Select representative subset (2-3 per category)
4. Verify diversity of content (text, tables, formulas)
5. Create reference corpus (canonical text for ground truth)

**Validation Method:**
- Extract canonical text from native PDFs (if available)
- Compare OCR output against canonical
- Measure character-level accuracy, block-level accuracy
- Categorize errors (formula, table, numeric, multilingual)

---

### Category 2: Engineering Formulas (10-15 documents, 20-30% of corpus)

**Objective:** Validate formula extraction (critical for AGSK, high error risk)

**Description:**
- Curated documents with high formula density
- Multiline formulas, complex subscripts/superscripts
- Mixed Cyrillic/Latin variable names
- Units expressions (dimensional analysis)
- Reference formulas (ground truth for validation)

**Formula Types:**

1. **Simple Single-Line:**
   ```
   E = mc²
   F = ma
   σ = E × ε
   ```

2. **Multiline Complex:**
   ```
   τ = (N × M × L) / (E × I)
   
   where:
   - τ: shear stress
   - N: normal force
   - M: moment
   - etc.
   ```

3. **Cyrillic with Subscripts:**
   ```
   Q = V × ρ × c × ΔT
   
   where:
   - Q: heat (Дж)
   - V: volume (м³)
   - ρ: density (кг/м³)
   - c: specific heat (Дж/кг·К)
   ```

4. **Complex Fraction/Nesting:**
   ```
   k = (a / b) × (c / d) × (e² + f²) / (g - h)
   ```

5. **Unit Expressions:**
   ```
   P = F / A  [N/m² = Pa]
   v = s / t  [m/s]
   ```

**Document Specifications:**

| Attribute | Value |
|-----------|-------|
| Count | 10-15 documents |
| Pages/doc | 20-50 (formula-heavy) |
| Total pages | 200-300 |
| Formulas/page | 2-5 (high density for focused testing) |
| Total formulas | 500-1,500 |
| Subscripts/doc | 20-50 (comprehensive testing) |
| Cyrillic | 40-60% of formulas (Russian variable names) |
| Reference | Canonical formula corpus (spreadsheet/JSON) |

**Formula Categories:**

| Category | Count | Complexity | Cyrillic % |
|----------|-------|-----------|-----------|
| Simple (1-line) | 300-500 | Low | 30% |
| Multiline (3-5 lines) | 150-300 | Medium | 50% |
| Complex (5+ lines) | 50-100 | High | 70% |
| Units | 100-200 | Medium | 40% |
| **Total** | **600-1,100** | | **50%** |

**Validation Method:**
- Parse canonical formulas → reference corpus
- Extract OCR formulas → OCR corpus
- Compare symbol-by-symbol
- Measure accuracy metrics:
  - Symbol recognition (%, by symbol type)
  - Subscript accuracy (position, size)
  - Unit preservation (%, by unit type)
  - Corruption rate (missing operators, wrong subscripts)

**Success Criteria:**
- Formula symbol accuracy ≥ 95%
- Subscript accuracy ≥ 90%
- Unit preservation ≥ 95%
- Corruption rate ≤ 5%

---

### Category 3: Engineering Tables (5-10 documents, 15-25% of corpus)

**Objective:** Validate table extraction (high value, high complexity)

**Description:**
- 3-5 tables per document (focused testing)
- Varying table complexity (simple → complex)
- Row/column headers, gridlines, sparse cells
- Numeric + text cells
- Cyrillic + Latin headers/data

**Table Types:**

1. **Simple Gridded (2D Matrix):**
   ```
   Material | Density | Strength | Cost
   ---------|---------|----------|------
   Steel    | 7,850   | 400      | 2.5
   Aluminum | 2,700   | 310      | 5.0
   Copper   | 8,960   | 200      | 8.0
   ```

2. **Complex Lookup (Variable Rows/Cols):**
   ```
   Standard | Year | Revision | Status
   ---------|------|----------|--------
   ISO 1234 | 2020 | 2        | Current
   ISO 5678 | 2018 | 1        | Superseded
   ```

3. **Nested Headers (Multi-Level):**
   ```
             | Group A      | Group B
             | Sub 1 | Sub 2 | Sub 1 | Sub 2
   Material | Value | Value | Value | Value
   Steel    | 100   | 200   | 300   | 400
   ```

4. **Sparse Table (Missing Cells):**
   ```
   Product | Jan | Feb | Mar | Apr
   --------|-----|-----|-----|-----
   A       | 100 | 110 |     | 120
   B       |     | 200 | 210 | 220
   C       | 300 |     |     | 300
   ```

5. **Bordered vs. Borderless:**
   - Gridded tables (full borders)
   - Minimal borders (header borders only)
   - No borders (spaces/alignment only)

**Document Specifications:**

| Attribute | Value |
|-----------|-------|
| Count | 5-10 documents |
| Pages/doc | 10-30 (table-heavy) |
| Total pages | 50-100 |
| Tables/doc | 3-5 |
| Total tables | 20-40 |
| Cells/table | 20-200 (variable) |
| Total cells | 1,000-3,000 |
| Header rows | 1-3 |
| Data rows | 5-50 |

**Table Categories:**

| Category | Count | Complexity | Cyrillic |
|----------|-------|-----------|----------|
| Simple 2D | 5-10 | Low | 30% |
| Lookup | 3-5 | Medium | 50% |
| Nested header | 3-5 | High | 60% |
| Sparse | 2-5 | High | 40% |
| Borderless | 2-5 | Very High | 40% |
| **Total** | **15-30** | | **45%** |

**Validation Method:**
- Create reference tables (CSV format)
- Extract OCR tables (structured format)
- Compare cell-by-cell
- Measure accuracy:
  - Table recognition (%, found vs. total)
  - Row alignment (%, correct position)
  - Column alignment (%, correct position)
  - Cell accuracy (%, value correct)
  - Header extraction (%, header found)

**Success Criteria:**
- Table recognition ≥ 95%
- Row/column alignment ≥ 90%
- Cell accuracy ≥ 90%
- Header extraction ≥ 95%

---

### Category 4: Low-Quality Scans (8-12 documents, 20-25% of corpus)

**Objective:** Validate confidence degradation under adverse conditions

**Description:**
- Intentionally degraded scans (to test preprocessing + confidence)
- Rotated pages (45°, 90°, partial)
- Low-resolution (100 DPI)
- Ink shadows, watermarks, background noise
- Partial page scans (cropped edges)

**Degradation Types:**

1. **Rotation (Page-Level):**
   - 45° rotation (partial, askew)
   - 90° rotation (sideways)
   - Multiple page rotation (some rotated, some not)

2. **Resolution Degradation:**
   - 100 DPI (low, typical fax quality)
   - 75 DPI (very low, borderline illegible)
   - Variable DPI (mixed quality in document)

3. **Image Artifacts:**
   - Ink shadows (from writing on page back)
   - Watermarks (subtle → heavy)
   - Fold marks (creases, damage)
   - Stains (coffee, water, age)

4. **Preprocessing Challenges:**
   - Very low contrast (light text on light background)
   - Very high contrast (black text only, no gray)
   - Lighting artifacts (uneven illumination)
   - Camera lens distortion (curved pages)

5. **Partial Degradation:**
   - Cropped edges (text cut off)
   - Half page (folded document)
   - Missing regions (torn document)

**Document Specifications:**

| Attribute | Value |
|-----------|-------|
| Count | 8-12 documents |
| Pages/doc | 5-20 (mixed quality) |
| Total pages | 100-150 |
| Rotation cases | 3-5 (45°, 90°) |
| Low-DPI cases | 2-3 (100 DPI, 75 DPI) |
| Artifact cases | 2-3 (shadows, watermarks) |
| Contrast cases | 1-2 (extreme contrast) |

**Validation Method:**
- Preprocess each degraded scan
- Measure preprocessing success (image quality improvement)
- Measure OCR confidence (should degrade proportionally)
- Verify confidence flags (MEDIUM → LOW as quality drops)

**Success Criteria:**
- Preprocessing success ≥ 80% (legible after preprocessing)
- Confidence responds (drops proportionally to degradation)
- No crashes (preprocessing doesn't fail)
- Preprocessing deterministic (reproducible results)

---

### Category 5: Multilingual Documents (5-8 documents, 15-20% of corpus)

**Objective:** Validate Cyrillic/Latin handling

**Description:**
- Mixed Russian + English text
- Variable encoding (UTF-8, Windows-1251 legacy)
- Cyrillic variable names in formulas
- Mixed character confusion (Cyrillic А ↔ Latin A, Cyrillic О ↔ Latin 0)

**Language Complexity:**

1. **Pure Cyrillic (Russian Standards):**
   ```
   Напряжение τ = (N × M × L) / (E × I)
   
   где τ — внутреннее напряжение, Н/м²
   ```

2. **Mixed Cyrillic/Latin (Variable Names):**
   ```
   Давление P = F / A, где:
   - P: давление (Па)
   - F: сила (Н)
   - A: площадь (м²)
   ```

3. **Character Confusion Risk:**
   ```
   Cyrillic А (U+0410) vs. Latin A (U+0041)
   Cyrillic О (U+041E) vs. Latin O (U+004F)
   Cyrillic Р (U+0420) vs. Latin P (U+0050)
   Cyrillic С (U+0421) vs. Latin C (U+0043)
   ```

4. **Encoding Legacy (Windows-1251 → UTF-8):**
   - Some scans may encode Cyrillic as Windows-1251
   - OCR output must normalize to UTF-8
   - Test encoding handling

**Document Specifications:**

| Attribute | Value |
|-----------|-------|
| Count | 5-8 documents |
| Pages/doc | 20-50 |
| Total pages | 100-200 |
| Cyrillic % | 60-80% |
| Latin % | 20-40% |
| Mixed blocks | 50-100 (Cyrillic + Latin formula) |
| Character confusion risks | 100-200 (known lookalikes) |

**Character Pairs to Test:**

| Cyrillic | Latin | Risk | Example |
|----------|-------|------|---------|
| А | A | High | Variable name confusion |
| О | O | High | Variable name confusion |
| Р | P | Medium | Formula variable |
| С | C | Medium | Formula variable |
| Е | E | Low | Usually context-clear |
| Х | X | Low | Context-clear |
| У | Y | Low | Context-clear |

**Validation Method:**
- Create reference corpus (canonical Cyrillic/Latin text)
- Extract OCR output (UTF-8)
- Measure character-level accuracy
- Count character confusion (А vs A, etc.)
- Verify encoding (all UTF-8, no legacy encodings)

**Success Criteria:**
- Cyrillic accuracy ≥ 95%
- Latin accuracy ≥ 98%
- Mixed blocks ≥ 90% accuracy
- Character confusion < 2%
- All output UTF-8 (zero encoding errors)

---

### Category 6: Known Failure Cases (3-5 documents, 5% of corpus)

**Objective:** Validate error detection and correction workflow

**Description:**
- Curated documents known to fail (from architecture analysis)
- Formula/table fusion (ambiguous regions)
- Ultra-low-quality (near-illegible)
- Complex Cyrillic subscripts
- Expected confidence: LOW or VERY_LOW
- Expected outcome: caught by review workflow

**Failure Exemplars:**

1. **Formula/Table Boundary Confusion:**
   ```
   Equation 3.2:  Q = Σ(a_i × b_i) / n
   
   Table 3.1: Coefficients
   ───────────────────
   i  | a_i  | b_i
   ───|------|------
   1  | 0.5  | 1.2
   2  | 0.8  | 0.9
   ```
   **Risk:** OCR may treat formula as table row, or vice versa
   **Expected:** Confidence VERY_LOW, routed to review

2. **Ultra-Low-Quality Scan (Near-Illegible):**
   - Faxed document (poor quality)
   - Age-degraded document (faded text)
   - Heavy fold/crease artifacts
   **Expected:** Confidence VERY_LOW, human review required

3. **Complex Cyrillic Subscripts:**
   ```
   Формула:
   τ_пред = (М_изг / W_x) + (N / A) ≤ σ_доп
   
   (complex subscripts: _пред, _изг, _доп with diacritics)
   ```
   **Risk:** Subscript positioning errors, character confusion
   **Expected:** Confidence LOW, requires review

4. **Mixed Script Density (Hard for OCR):**
   - Russian paragraph followed by English table
   - Latin chemical symbols mixed with Cyrillic text
   - Mathematical notation (ℵ, ∑, ∫) mixed with text
   **Risk:** Region confusion, confidence instability
   **Expected:** Confidence MEDIUM→LOW, requires review

5. **Intentional Stress Test:**
   - Compressed text (very small font)
   - Extreme contrast (unusual color scheme)
   - Text + graphics overlay (ambiguous regions)
   **Risk:** OCR failure or hallucination
   **Expected:** Confidence VERY_LOW, escalated to human

**Document Specifications:**

| Attribute | Value |
|-----------|-------|
| Count | 3-5 documents |
| Pages/doc | 5-10 (failure-heavy) |
| Total pages | 15-30 |
| Failure cases | 1-2 per document |
| Expected LOW/VERY_LOW | 80%+ of blocks |
| Expected review rate | 90%+ (intentional) |

**Validation Method:**
- Process known failure documents through OCR pipeline
- Measure confidence (should be LOW/VERY_LOW)
- Verify routing (mandatory review queue)
- Track reviewer corrections
- Categorize failure mode (formula/table, quality, encoding, etc.)

**Success Criteria:**
- Confidence ≤ 0.84 (LOW or VERY_LOW) for 80%+ of blocks
- 100% routed to review queue
- Reviewer correction success ≥ 70% (corrected properly)
- No false negatives (all failures caught)

---

## Corpus Assembly

### Step 1: Source Collection
1. List all available AGSK standards
2. Identify candidate documents for each category
3. Acquire documents (scanning if necessary)
4. Verify format compatibility (PDF/A or convertible)

### Step 2: Reference Corpus Creation
1. Extract canonical text from native PDFs (where available)
2. Create canonical formula/table references (CSV, JSON)
3. Document ground truth (character counts, structure)
4. Version-lock reference corpus (immutable)

### Step 3: Controlled Degradation
1. For low-quality category: create intentional degradations
   - Rotate pages (45°, 90°)
   - Resample to 100 DPI
   - Add artifacts (watermarks, shadows)
2. Save degraded versions alongside originals

### Step 4: Corpus Manifest
Create OCR_PILOT_CORPUS_MANIFEST.md:
- Document list (name, source, category, pages)
- Canonical references (location, format)
- Known failures (description, expected confidence)
- Sampling strategy (if corpus too large)

---

## Corpus Specifications Summary

| Category | Count | Pages | Blocks | Focus |
|----------|-------|-------|--------|-------|
| Scanned Standards | 15-20 | 400-800 | 800-1,600 | Baseline |
| Formulas | 10-15 | 200-300 | 600-1,100 | Subscripts, Cyrillic |
| Tables | 5-10 | 50-100 | 400-900 | Alignment, complexity |
| Low-Quality | 8-12 | 100-150 | 200-300 | Degradation response |
| Multilingual | 5-8 | 100-200 | 300-500 | Cyrillic/Latin handling |
| Known Failures | 3-5 | 15-30 | 100-150 | Error detection |
| **Total** | **50-100** | **900-1,700** | **2,400-4,550** | **Representative** |

---

## Corpus Quality Assurance

### Validation Checklist
- [ ] All documents acquired and readable
- [ ] Reference corpus created (canonical text locked)
- [ ] Ground truth documented (character counts, structure)
- [ ] Degraded versions created (rotation, low-DPI, artifacts)
- [ ] Manifest complete (document list, known failures)
- [ ] Category mix verified (standards 60-70%, balanced others)
- [ ] Language mix verified (40-60% Cyrillic)
- [ ] All documents marked with metadata (category, source, notes)

### Quality Metrics
- **Diversity:** All 6 categories represented
- **Realism:** No cherry-picking (representative mix)
- **Reproducibility:** Reference corpus immutable
- **Traceability:** Manifest links each document to source

---

## Related Documents

- **OCR_PILOT_ARCHITECTURE.md** — Overall pilot design
- **OCR_PILOT_PIPELINE_CONFIG.md** — Execution pipeline (coming)
- **OCR_PILOT_CONFIDENCE_RESULTS.md** — Confidence validation results (coming)
- **OCR_PILOT_FAILURE_ANALYSIS.md** — Failure categorization (coming)

---

**Status:** 🟡 STAGE 1 CORPUS DESIGN SPEC COMPLETE  
**Next:** Assemble corpus, create manifest, begin Stage 2
