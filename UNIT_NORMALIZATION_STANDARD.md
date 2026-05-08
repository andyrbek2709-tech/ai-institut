# UNIT NORMALIZATION STANDARD
## Canonical Unit Registry и локаль-независимая нормализация

**Статус:** 🟦 STANDARD DESIGN  
**Дата:** 2026-05-10  
**Версия:** 1.0  
**Ссылка:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → STAGE 2

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **single canonical form** для каждой инженерной единицы, независимо от:
- Locale (англ. Pa vs рус. Па)
- OCR ошибок (Мпа vs МПа vs mPa)
- Unicode вариантов (mm² vs mm^2)
- Legacy notation (N·m vs Nm vs Нм)

**Принцип:** Разные локализации одной единицы → одна canonical форма.

---

## 1️⃣ CANONICAL UNIT REGISTRY

### PRESSURE/STRESS UNITS

```yaml
Unit: Pascal
  Canonical: Pa
  SI: true
  Category: Pressure/Stress
  Variants:
    - Pa (English)
    - Па (Cyrillic)
    - PА (mixed case)
  Aliases:
    - pressure
    - stress
    - normal_stress
  Related_Units:
    - kPa: 1000
    - MPa: 1000000
    - hPa: 100
    - bar: 100000
    - atm: 101325
  Context: "Used in material science, fluid mechanics"
  Example: "σ_y = 250 Pa" → canonical

Unit: Kilopascal
  Canonical: kPa
  SI: true
  Category: Pressure/Stress
  Variants:
    - kPa (English)
    - кПа (Cyrillic)
    - КПа (mixed case)
    - KPa (typo)
  Aliases:
    - kilopascal
    - pressure_kilo
  Conversion: 1 kPa = 0.001 MPa = 1000 Pa
  Example: "P = 50 kPa" → canonical

Unit: Megapascal
  Canonical: MPa
  SI: true
  Category: Pressure/Stress
  Variants:
    - MPa (English)
    - МПа (Cyrillic)
    - Мпа (mixed case)
    - mPa (typo - actually millipascal!)
  Aliases:
    - megapascal
    - pressure_mega
  Conversion: 1 MPa = 1000 kPa = 1000000 Pa
  Example: "σ_max = 350 MPa" → canonical
  WARNING: 'mPa' is MILLIPASCAL (0.001 Pa), not Megapascal!
```

### LENGTH/AREA UNITS

```yaml
Unit: Millimeter
  Canonical: mm
  SI: false
  Category: Length
  Variants:
    - mm (English)
    - мм (Cyrillic)
  Example: "t = 5 mm" → canonical

Unit: Square Millimeter
  Canonical: mm²
  SI: false
  Category: Area
  Variants:
    - mm² (Unicode superscript, CANONICAL)
    - mm^2 (caret notation)
    - mm2 (numeric 2)
    - мм² (Cyrillic)
    - мм^2 (Cyrillic caret)
  Normalization_Rule: "All forms → mm² (Unicode superscript)"
  Example: "A = 100 mm²" → canonical

Unit: Meter
  Canonical: m
  SI: true
  Category: Length
  Variants:
    - m (English)
    - м (Cyrillic)
  Example: "L = 10 m" → canonical

Unit: Square Meter
  Canonical: m²
  SI: true
  Category: Area
  Variants:
    - m² (Unicode)
    - m^2 (caret)
    - m2 (numeric)
  Normalization_Rule: "All forms → m² (Unicode superscript)"
```

### FORCE/MOMENT UNITS

```yaml
Unit: Newton
  Canonical: N
  SI: true
  Category: Force
  Variants:
    - N (English)
    - Н (Cyrillic)
  Example: "F = 100 N" → canonical

Unit: Newton-Meter
  Canonical: N·m
  SI: true
  Category: Moment/Torque
  Variants:
    - N·m (with middle dot) → CANONICAL
    - Nm (no separator)
    - N·m (different dot)
    - Н·м (Cyrillic)
    - Нм (Cyrillic no separator)
    - N-m (with hyphen)
    - N m (with space)
  Normalization_Rule: "All forms → N·m (middle dot separator)"
  Context: "Torque, moment of force"
  Example: "T = 50 N·m" → canonical
  
Unit: Kilogram-Force
  Canonical: kgf
  SI: false
  Category: Force (legacy)
  Variants:
    - kgf (English)
    - кгс (Cyrillic "kilograms-force")
    - kg-f (with hyphen)
    - kgF (mixed case)
  Conversion: 1 kgf ≈ 9.81 N
  Context: "Legacy notation, still used in some standards"
  Example: "F = 100 kgf" → canonical
```

### TEMPERATURE UNITS

```yaml
Unit: Celsius
  Canonical: °C
  SI: false
  Category: Temperature
  Variants:
    - °C (Unicode degree + C)
    - C (just C, ambiguous!)
    - °C (different degree form)
    - ℃ (special symbol U+2103, avoid)
  Normalization_Rule: "All → °C (Unicode degree + C)"
  Example: "T = 25 °C" → canonical

Unit: Kelvin
  Canonical: K
  SI: true
  Category: Temperature
  Variants:
    - K (English)
    - К (Cyrillic)
    - K (generic Latin K)
  Normalization_Rule: "All → K"
  Note: "No degree symbol for Kelvin"
  Example: "T = 298 K" → canonical
```

### COMPOSITE ENGINEERING UNITS

```yaml
Unit: Stress (Pressure)
  Canonical_Form: "MPa" (default), "kPa" (smaller scales), "Pa" (micro)
  Common: MPa (most engineering)
  Contexts:
    - Material stress: MPa
    - Atmospheric pressure: kPa or bar
    - Fluid mechanics: Pa or kPa
  Example: "σ = 250 MPa" (material strength) → canonical

Unit: Young's Modulus
  Canonical_Form: "GPa" (most common) or "MPa"
  Base: N/m² but usually written as Pa (Pascal)
  Examples:
    - E = 210 GPa (steel)
    - E = 70 GPa (aluminum)
  Variants:
    - GPa (gigapascal)
    - ГПа (Cyrillic)
  Normalization_Rule: "All → GPa (if large)"

Unit: Density
  Canonical_Form: "kg/m³"
  Variants:
    - kg/m³ (slash notation)
    - kg·m⁻³ (dot notation)
    - kg m⁻³ (space)
    - kg/m^3 (caret)
  Normalization_Rule: "All → kg/m³ (slash with superscript 3)"
  Example: "ρ = 7850 kg/m³" → canonical

Unit: Energy/Work
  Canonical_Form: "J" (Joule)
  Variants:
    - J (English)
    - Дж (Cyrillic)
    - N·m (alternative, same dimension)
    - Wh (watt-hour)
    - kWh (kilowatt-hour)
  Context: "N·m same as J for moment, but context determines usage"
  Example: "W = 100 J" → canonical
```

---

## 2️⃣ LOCALE NORMALIZATION RULES

### 2.1 English vs Cyrillic

| Unit Type | English | Cyrillic | Canonical |
|-----------|---------|----------|-----------|
| Pascal | Pa | Па | **Pa** |
| Kilopascal | kPa | кПа | **kPa** |
| Megapascal | MPa | МПа | **MPa** |
| Meter | m | м | **m** |
| Square Meter | m² | м² | **m²** |
| Kilogram | kg | кг | **kg** |
| Newton | N | Н | **N** |
| Joule | J | Дж | **J** |
| Celsius | °C | °C | **°C** |

**Правило Loc1:** При нормализации → всегда английские/ASCII формы (Pa, kPa, MPa, etc.)

### 2.2 Unicode Normalization for Units

| Вариант | Unicode | Проблема | Canonical |
|---------|---------|----------|-----------|
| m² | U+00B2 | Precomposed superscript 2 | **m²** |
| m^2 | Caret | Text notation | → **m²** |
| m2 | Digit | Looks like m times 2 | → **m²** |
| m ² | Space | Spacing issue | → **m²** |
| m<sup>2</sup> | HTML | Web notation | → **m²** |

**Правило Uni1:** Все варианты площади → Unicode superscript (m²)

### 2.3 Prefix Normalization (SI Prefixes)

| Prefix | Factor | Canonical | Variants | Canonical |
|--------|--------|-----------|----------|-----------|
| kilo | 10³ | k | K, kilo | **k** |
| mega | 10⁶ | M | meg, Meg, MEGA | **M** |
| giga | 10⁹ | G | gig, Gig, GIGA | **G** |
| milli | 10⁻³ | m | milli, mil | **m** |
| micro | 10⁻⁶ | μ | micro, u, µ | **μ** (Greek mu) |
| nano | 10⁻⁹ | n | nano, nan | **n** |

**Правило Pref1:** SI префиксы → canonical single-letter form (k, M, G, m, μ, n)

**⚠️ HIGH RISK:** μ (Greek mu) for "micro" often confused with:
- m (Latin m for "milli")
- u (Latin u for "micro" in some contexts)

**Context rule:** 
```
Pattern: "[number] μ[unit]" → micro (10⁻⁶)
Example: "5 μm" → 5 micrometers

Pattern: "[number] m[unit]" → milli (10⁻³)
Example: "5 mm" → 5 millimeters

Pattern: "[number] u[unit]" → often OCR error for μ → convert to μ
```

---

## 3️⃣ COMPOSITE UNIT NORMALIZATION

### 3.1 Slash Notation vs Dot Notation

| Unit | Slash | Dot | Canonical | Rule |
|------|-------|-----|-----------|------|
| Newton-meter | N/m (wrong!) | N·m | **N·m** | Dot for composite |
| Kilogram per meter cubed | kg/m³ | kg·m⁻³ | **kg/m³** | Slash for ratio |
| Joule per kilogram | J/kg | J·kg⁻¹ | **J/kg** | Slash for specific |

**Правило Comp1:** 
- **Moment/force composite:** use dot (N·m, N·mm)
- **Ratio/specific:** use slash (kg/m³, J/kg)

### 3.2 Exponent Notation

| Форма | Unicode | Canonical | Rule |
|-------|---------|-----------|------|
| m^-3 | Caret | m⁻³ | Superscript |
| m-3 | Minus | → m⁻³ | Not a minus! |
| m/m/m | Slash | m⁻³ | Expand |
| m-1 | Dash | Ambiguous | Context |

**Правило Exp1:** Exponents → superscript forms (⁻³, ³, etc.)

---

## 4️⃣ UNIT NORMALIZATION WORKFLOW

```
┌──────────────────────────────────────┐
│ EXTRACTED UNIT (from ground truth)   │
│ Example: "Мпа", "МПа", "mPa"        │
└────────────┬─────────────────────────┘
             │
    ┌────────▼──────────┐
    │ STEP 1:           │
    │ Identify base unit│
    │ (Pascal)          │
    └────────┬──────────┘
             │
    ┌────────▼──────────┐
    │ STEP 2:           │
    │ Extract prefix    │
    │ (mega, M)         │
    └────────┬──────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 3:                    │
    │ Apply prefix normalization │
    │ (M → always capital)       │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 4:                    │
    │ Apply unit normalization   │
    │ (Pa is canonical)          │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ STEP 5:                    │
    │ Check locale conversion    │
    │ (Па → Pa)                  │
    └────────┬────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ CANONICAL UNIT: MPa       │
    │ Ready for lineage tracking│
    └───────────────────────────┘
```

---

## 5️⃣ UNIT NORMALIZATION EXAMPLES

### Example 1: Pressure Units

```
Input:  Мпа (Cyrillic typo)
Steps:
1. Identify: mega + pascal
2. Normalize prefix: М → M
3. Normalize base: па → Pa
4. Normalize locale: Cyrillic → English
Output: MPa

Input:  mPa (millipascal, wrong!)
Steps:
1. Identify: milli + pascal = 10⁻³ Pa (wrong order of magnitude for stress)
2. Context check: material strength → should be MPa or kPa, not mPa
3. Flag: AMBIGUOUS (mPa vs MPa confusion)
Output: Marked AMBIGUOUS, review required

Input:  МПа (correct Cyrillic)
Steps:
1. Identify: mega + pascal (Cyrillic М, П, а)
2. Normalize locale: Cyrillic → English
Output: MPa
```

### Example 2: Area Units

```
Input:  mm^2
Steps:
1. Identify: millimeter squared
2. Normalize exponent: ^2 → ²
Output: mm²

Input:  мм²
Steps:
1. Identify: millimeter squared (Cyrillic)
2. Normalize locale: мм → mm
Output: mm²

Input:  mm2 (numeric 2)
Steps:
1. Identify: millimeter squared (written as number)
2. Normalize: 2 → ²
Output: mm²
```

### Example 3: Composite Units

```
Input:  N-m (with hyphen)
Steps:
1. Identify: newton-meter (moment)
2. Normalize separator: - → · (dot for composite)
Output: N·m

Input:  Nm (no separator)
Steps:
1. Identify: newton-meter (no separator)
2. Normalize: add canonical separator
Output: N·m

Input:  kg/m³
Steps:
1. Identify: kilogram per cubic meter (already slash notation)
2. Normalize exponent: 3 → ³
Output: kg/m³ (OK)
```

### Example 4: Complex Composite

```
Input:  N·mm²/мм (mixed English/Cyrillic)
Steps:
1. Normalize locale: мм → mm
2. Normalize units: N·mm²/mm → N·mm
Output: N·mm

Input:  kg·m/s² (SI form of Newton)
Steps:
1. Identify: equivalent to Newton
2. Context: if used for force → should be N
3. If used for definition → can keep kg·m/s² or convert to N
4. Decision: depends on context (assume canonical N for force)
Output: N
```

---

## 6️⃣ UNIT VALIDATION RULES

### Rule V1: Dimensional Consistency

When unit appears in formula, verify consistency:

```
Formula: σ = F/A
Units:   σ [Pa] = F [N] / A [m²]
Check:   [N]/[m²] = [Pa] ✓

Formula: v = distance/time
Units:   v [m/s] = distance [m] / time [s]
Check:   [m]/[s] = [m/s] ✓
```

### Rule V2: Context-Based Unit Selection

Same physical quantity may have different canonical units by context:

```
Context 1: Material strength → canonical MPa
  Example: σ_y = 250 MPa (high value, MPa)

Context 2: Atmospheric pressure → canonical kPa
  Example: P = 101.3 kPa (medium value, kPa)

Context 3: Micro-scale → canonical Pa
  Example: p = 0.1 Pa (low value, Pa)
```

### Rule V3: Locale-Independent Recognition

Unit should be recognizable in any locale:

```
VALID (recognized):
  MPa, МПа, mPa (though mPa is millipascal!)
  
INVALID (flagged):
  Мпа (mixed case)
  MPА (mixed Latin/Cyrillic)
  mpa (lowercase m for mega is wrong!)
```

---

## 7️⃣ MICRO UNIT HIGH-RISK HANDLING

⚠️ **CRITICAL:** μ (micro prefix) is often confused with m (milli).

| Case | Unicode | Problem | Resolution |
|------|---------|---------|-----------|
| 5 μm | U+03BC | Greek mu (correct) | **CANONICAL** |
| 5 µm | U+00B5 | Micro sign (variant) | → 5 μm |
| 5 um | Latin u | OCR error for μ | → 5 μm |
| 5 mm | Latin m | Millimeter (10⁻³) | Different unit! |
| 5 mμm | Both | Nonsense | Flag AMBIGUOUS |

**Правило Micro1:**
```
Pattern: [digit] [space]? μ[unit]
  → micro prefix (10⁻⁶)

Pattern: [digit] [space]? m[unit] (where unit ≠ meter)
  → milli prefix (10⁻³)

Pattern: [digit] [space]? u[unit]
  → likely OCR error for μ → convert to μ

Pattern: [digit] [space]? m[unit] (where unit = meter)
  → millimeter (10⁻³ meter)
```

---

## 8️⃣ UNIT NORMALIZATION CHECKLIST

**Before marking unit as CANONICAL:**

- ✅ Locale converted to English (Pa not Па)
- ✅ Prefix normalized (M not М, m not м)
- ✅ Unicode superscripts used (² not ^2)
- ✅ Composite units use correct separator (· for moment, / for ratio)
- ✅ No locale mixing (not МПа or mpa)
- ✅ Micro prefix uses μ not u or m
- ✅ Dimensional consistency verified with formula
- ✅ Context-appropriate scale used (MPa for stress, not kPa)
- ✅ No ambiguous abbreviations (checked against confusion matrix)
- ✅ Lineage recorded (source → canonical)

---

## 9️⃣ COMMON UNIT NORMALIZATION ERRORS

| Error | Input | Wrong | Correct |
|-------|-------|-------|---------|
| Locale | Мпа | Missing conversion | MPa |
| Case | mpa | Micro-pascal? | MPa (uppercase M) |
| Prefix | mPa | Is it milli or mega? | MPa (ambiguous, flag) |
| Exponent | m2 | Looks like m×2 | m² (Unicode superscript) |
| Separator | Nm | Missing middle dot | N·m (for torque) |
| Micro | um | OCR error | μm (Greek mu) |
| Unicode | m^2 | Caret notation | m² (superscript) |

---

## 🔟 VERSIONING AND REGISTRY SIZE

**Version 1.0 (2026-05-10):**
- 100+ unit definitions
- SI base units and derived units
- Common engineering units
- Prefix normalization rules
- Composite unit rules
- Locale normalization (English/Cyrillic)
- Micro prefix disambiguation

**Registry size:** ~300 lines (expandable per domain)

**Future expansions:**
- Electrical units (V, A, W, Ω, F, H)
- Thermal units (K, °C, °F, W/m·K)
- Acoustic units (dB, Pa, Hz)
- Optical units (lm, cd, lux)
- Chemical units (mol, mol/L, ppm)

---

## 📝 ПРИМЕЧАНИЯ

1. **One canonical form per unit:** E.g., only "MPa", never "МПа" or "Мпа" in canonical text.
2. **Context matters:** Same dimension may have different canonical scales (MPa vs kPa vs Pa).
3. **Lineage:** Each unit normalization is recorded (source → canonical).
4. **Confusion matrix:** High-risk confusions (milli vs micro, English vs Cyrillic) must be flagged.
5. **Reviewer role:** Reviewer checks units against this registry, does NOT invent canonical forms.

---

**Следующий документ:** TABLE_NORMALIZATION_STANDARD.md (canonical table structure)
