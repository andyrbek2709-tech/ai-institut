# FORMULA NORMALIZATION STANDARD
## Детерминированная нормализация инженерных формул

**Статус:** 🟦 STANDARD DESIGN  
**Дата:** 2026-05-10  
**Версия:** 1.0  
**Ссылка:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → STAGE 1

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **детерминированное преобразование** инженерных формул в canonical form, независимо от:
- Исходного представления (OCR, скан, печать, рукопись)
- Locale (англ., рус., смешанный)
- Unicode варианта (combining vs precomposed)
- Reviewer интерпретации

**Принцип:** Одинаковые inputs → одинаковые outputs (всегда).

---

## 1️⃣ NORMALIZATION RULES BY TYPE

### 1.1 MULTIPLICATION SYMBOLS

| Входной символ | Canonical | Причина |
|---|---|---|
| · (middle dot) | × | Standard ASCII multiplication |
| * (asterisk) | × | Common but unclear |
| × (multiplication sign) | × | CANONICAL |
| x (letter x) | CONTEXT | See below |
| × (pre-composed) | × | Standard form |

**Правила:**
- **Rule A1:** · → × (always)
- **Rule A2:** \* → × (always)
- **Rule A3:** x (letter) → × (only if context is multiplication, not variable)

**Context detection for letter 'x':**
```
Pattern: [number/unit/symbol] x [number/unit/symbol]
  → x is multiplication → × 

Pattern: x [number/symbol] OR [number/symbol] x
  → x is variable → keep as x

Example: 2 x 3 → 2 × 3
Example: y = 2x + 3 → y = 2x + 3 (x is variable, keep)
```

**примеры:**
```
Input:  K = G·a²/(π·t³)
Output: K = G×a²/(π×t³)

Input:  Strength = 250*E₁₂ + 150*E₂₃
Output: Strength = 250×E₁₂ + 150×E₂₃

Input:  V = 2 x 3 x 4 meters
Output: V = 2 × 3 × 4 meters

Input:  y = 2x + b
Output: y = 2x + b (x is variable, no change)
```

---

### 1.2 MINUS AND NEGATIVE SIGNS

| Входной символ | Canonical | Причина |
|---|---|---|
| − (minus sign U+2212) | - | ASCII minus |
| — (em dash U+2014) | - | Wrong symbol |
| – (en dash U+2013) | - | Wrong symbol |
| - (hyphen-minus U+002D) | - | CANONICAL |
| ‐ (hyphen U+2010) | - | Legacy hyphen |

**Правила:**
- **Rule B1:** − → - (always)
- **Rule B2:** — → - (always)
- **Rule B3:** – → - (always)
- **Rule B4:** ‐ → - (always)
- **Rule B5:** - (hyphen-minus) → - (CANONICAL, keep)

**примеры:**
```
Input:  σ = F₁−F₂
Output: σ = F₁-F₂

Input:  τ = (σ_max—σ_min)/2
Output: τ = (σ_max-σ_min)/2

Input:  n = 1e‐5
Output: n = 1e-5
```

---

### 1.3 DECIMAL SEPARATORS

| Входной символ | Canonical | Правило |
|---|---|---|
| . (period) | . | CANONICAL (English) |
| , (comma) | . | Localized → convert |
| · (middle dot) | . | European → convert |
| ‚ (single low 9 quote) | . | OCR error → convert |

**Правила:**
- **Rule C1:** , → . (always)
- **Rule C2:** · (when used as decimal) → .
- **Rule C3:** . → . (keep)

**Context rule:** Only apply if preceded by digit and followed by digit:
```
Pattern: [0-9][separator][0-9]
  → normalize separator to .

Example: 30,5 MPa → 30.5 MPa
Example: 1·10⁻³ → 1.0×10⁻³
Example: ISO 30·8-2010 → keep as is (not a decimal)
```

**примеры:**
```
Input:  σ_y = 250,5 MPa
Output: σ_y = 250.5 MPa

Input:  E = 1,2×10⁵ N/mm²
Output: E = 1.2×10⁵ N/mm²

Input:  Standard ISO 13,834-2010
Output: Standard ISO 13,834-2010 (not a decimal, keep comma)

Input:  π ≈ 3·14159
Output: π ≈ 3.14159 (middle dot as decimal)
```

---

### 1.4 WHITESPACE NORMALIZATION

| Случай | Правило | Пример |
|---|---|---|
| Двойные пробелы | Remove | K  =  F → K = F |
| Пробел перед юнитом | Add | 30MPa → 30 MPa |
| Пробел после запятой | Remove | σ , τ → σ, τ |
| Пробел в формуле | Preserve carefully | See context rules |

**Правила:**
- **Rule D1:** Двойные пробелы и выше → одиночный пробел
- **Rule D2:** Пробелы вокруг = → one space: a=b → a = b
- **Rule D3:** Пробелы вокруг ±, ×, ÷ → one space
- **Rule D4:** Пробелы в скобках → remove: ( a ) → (a)
- **Rule D5:** Пробел перед юнитом → add: 30MPa → 30 MPa
- **Rule D6:** Пробел после запятой → standardize: σ,τ → σ, τ

**примеры:**
```
Input:  K  =  G × a ²  /  π  ×  t ³
Output: K = G × a² / π × t³

Input:  30MPa
Output: 30 MPa

Input:  F(  x  )  =  2x  +  3
Output: F(x) = 2x + 3
```

---

### 1.5 SUPERSCRIPTS AND SUBSCRIPTS

| Форма | Canonical | Примеры |
|---|---|---|
| Superscript Unicode | KEEP | a², E₁₂ |
| Caret notation | Convert | a^2 → a² |
| Asterisk | Convert | a*2 → a² |
| Underscore | Convert | E_12 → E₁₂ |
| Mixed | Normalize | a^2_x → a²ₓ |

**Правила:**
- **Rule E1:** ^ → superscript (^2 → ²)
- **Rule E2:** _ → subscript (_12 → ₁₂)
- **Rule E3:** * (when exponent) → superscript (*2 → ²)
- **Rule E4:** Keep precomposed Unicode forms
- **Rule E5:** Order: base + subscript + superscript (E₁₂²)

**примеры:**
```
Input:  σ_y^2
Output: σᵧ²

Input:  a^2 + b^2 = c^2
Output: a² + b² = c²

Input:  E_11*c_11 + E_12*c_12
Output: E₁₁c₁₁ + E₁₂c₁₂

Input:  (F_max)^2
Output: (Fₘₐₓ)²
```

---

### 1.6 UNICODE VARIANTS AND NORMALIZATION

| Unicode form | Canonical | Action |
|---|---|---|
| NFC (composed) | NFC | Standard form |
| NFD (decomposed) | NFC | Recompose |
| NFKC (compatible) | NFC | Use NFC |
| NFKD | NFC | Use NFC |

**Правила:**
- **Rule F1:** Apply Unicode NFC normalization (composed form)
- **Rule F2:** σ (Cyrillic С) needs context to distinguish from Greek σ
- **Rule F3:** μ (Greek mu) may appear as m (Latin), disambiguate via context
- **Rule F4:** Use combining marks or precomposed (see confusion matrix)

**примеры:**
```
Input:  σ (composed) + combining mark
Output: σ (precomposed NFC form)

Input:  Stress σ (Cyrillic С)
Output: Stress σ (Greek sigma, disambiguated via context)
```

---

### 1.7 ENGINEERING NOTATION VARIANTS

| Форма | Canonical | Правило |
|---|---|---|
| 1e-5 | 1×10⁻⁵ | Scientific notation |
| 1E-5 | 1×10⁻⁵ | Uppercase E |
| 1×10⁻⁵ | 1×10⁻⁵ | CANONICAL |
| 1 × 10^-5 | 1×10⁻⁵ | With spaces |
| 10⁻⁵ | 1×10⁻⁵ | Shorthand (when ≥0.1) |

**Правила:**
- **Rule G1:** [0-9]e[+-][0-9] → 1×10^[exponent]
- **Rule G2:** Exponent: ^N → ᴺ (superscript)
- **Rule G3:** 10⁻⁵ is OK (shorthand) only if mantissa implicit
- **Rule G4:** 0.00001 → leave as is if engineer prefers decimal

**примеры:**
```
Input:  σ_max = 1.5e-3 MPa
Output: σ_max = 1.5×10⁻³ MPa

Input:  Coefficient = 2E+4 N/m²
Output: Coefficient = 2×10⁴ N/m²

Input:  ε = 10⁻⁶
Output: ε = 10⁻⁶ (OK as shorthand)
```

---

## 2️⃣ CONFUSION MATRIX (HIGH-RISK SYMBOLS)

### 2.1 GREEK vs CYRILLIC DISAMBIGUATION

| Char | Unicode | Language | Typical Use | Risk |
|---|---|---|---|---|
| σ | U+03C3 | Greek | Stress, standard deviation | HIGH |
| С | U+0421 | Cyrillic | Cyrillic text | HIGH |
| τ | U+03C4 | Greek | Shear stress, time constant | HIGH |
| т | U+0442 | Cyrillic | Cyrillic text | HIGH |
| μ | U+03BC | Greek | Micro-, mean, friction coeff | MEDIUM |
| м | U+043C | Cyrillic | Cyrillic text | MEDIUM |
| ρ | U+03C1 | Greek | Density, resistivity | MEDIUM |
| р | U+0440 | Cyrillic | Cyrillic text | MEDIUM |

**Правило:** Disambiguate via context
```
Context 1: Formula with typical engineering symbols
  σ, τ, μ, ρ, etc. → use GREEK forms

Context 2: Russian/Cyrillic document text
  С, т, м, р, etc. → use CYRILLIC forms

Context 3: Mixed (formula in Cyrillic text)
  σ = F/A (formula in Russian text)
  → σ is GREEK (engineering notation), text is CYRILLIC
```

**примеры:**
```
Input (Russian text):  "Напряжение σ (Greek) в стандарте"
Output:               σ is Greek sigma, not Cyrillic С

Input (English text):  "Stress σ and shear τ"
Output:               Both Greek (standard notation)

Input (Mixed):        "На основе σ_max следует..."
Output:               σ is Greek sigma, "на" is Cyrillic
```

---

### 2.2 LATIN vs GREEK vs CYRILLIC CONFUSION

| Char | Unicode | Language | Form | Risk |
|---|---|---|---|---|
| x | U+0078 | Latin | Variable | MEDIUM |
| × | U+00D7 | Symbol | Multiplication | MEDIUM |
| х | U+0445 | Cyrillic | Latin letter | MEDIUM |

**Правило:**
- Letter x in algebra → Latin x (keep)
- Multiplication operator → × (canonical)
- Cyrillic x (х) → context (usually variable in Russian)

---

### 2.3 LOOK-ALIKE CONFUSION

| Confusion | Resolution | Rule |
|---|---|---|
| 0 (zero) vs O (letter O) | Context: numeric vs text | Preserve intent |
| 1 (one) vs l (letter l) vs I | Context-dependent | Preserve intent |
| 4 vs △ (capital delta) | Context-dependent | Preserve intent |
| 6 vs Σ (Greek sigma) | Check full formula context | Preserve intent |

**примеры:**
```
Input:  E₁₂O (unclear if O or 0)
Output: E₁₂O if letter, E₁₂0 if number (preserve source intent)

Input:  Σ_i (summation) vs 6_i (unlikely, preserve Σ)
Output: Σᵢ (summation is correct)
```

---

## 3️⃣ FORMULA STRUCTURE NORMALIZATION

### 3.1 OPERATOR SPACING

**Правило:** Consistent spacing around binary operators

```
Input:  a=2×b+3
Output: a = 2×b + 3

Input:  F/A=σ
Output: F/A = σ

Input:  a²+b²=c²
Output: a² + b² = c²
```

### 3.2 PARENTHESES NORMALIZATION

**Правило:** Remove internal spaces, normalize nesting

```
Input:  ( a + b ) / ( c - d )
Output: (a + b)/(c - d)

Input:  [[ a ]]
Output: (a) [simplify to single nesting]
```

### 3.3 FRACTION NORMALIZATION

| Форма | Canonical | Правило |
|---|---|---|
| a/b | a/b | Linear notation |
| a÷b | a/b | Convert to slash |
| a / b | a/b | Remove spaces |
| $\\frac{a}{b}$ | a/b | LaTeX notation |

```
Input:  σ_y ÷ E
Output: σ_y/E

Input:  (a + b) / (c + d)
Output: (a + b)/(c + d)
```

### 3.4 EQUALS AND COMPARISON OPERATORS

| Оператор | Canonical | Правило |
|---|---|---|
| = | = | CANONICAL |
| ≈ | ≈ | Approximate (keep) |
| ≠ | ≠ | Not equal (keep) |
| < | < | Less than (keep) |
| > | > | Greater than (keep) |
| ≤ | ≤ | Less or equal (keep) |
| ≥ | ≥ | Greater or equal (keep) |

---

## 4️⃣ FORMULA VALIDATION DURING NORMALIZATION

### 4.1 Dimensional Analysis (Sanity Check)

After normalization, verify formula makes dimensional sense:

```
Formula: σ = F/A
Units:   σ [Pa] = F [N] / A [m²]
Check:   [N]/[m²] = [Pa] ✓ (correct)

Formula: E = m × c²
Units:   E [J] = m [kg] × c² [m²/s²]
Check:   [kg·m²/s²] = [J] ✓ (correct)
```

**Правило:** If dimensional analysis fails, flag as AMBIGUOUS.

### 4.2 Symbol Consistency

Check: Each symbol defined or used consistently.

```
Formula: F = m × a + μ × m × g
Check:   m appears 2× (same meaning: mass) ✓
         μ appears 1× (friction coefficient) ✓
         F, a, g appear 1× each ✓
```

---

## 5️⃣ MULTI-LINE FORMULA NORMALIZATION

### 5.1 Continuation Handling

```
Input:
σ_y = E × ε +
      K × (ε - ε₀)^N

Normalized:
σ_y = E×ε + K×(ε - ε₀)^N
```

### 5.2 System of Equations

```
Input:
{
  a + b = 5,
  a - b = 1
}

Normalized:
a + b = 5
a - b = 1
```

---

## 6️⃣ FORMULA NORMALIZATION EXAMPLES

### Example 1: Material Property Formula

```
Input (OCR variant):
σ_y·[E₁₂/E₂₂] = 250·10⁻³·(1 + μ·sin2θ)

Normalization steps:
1. Multiplication symbols: · → ×
   σ_y×[E₁₂/E₂₂] = 250×10⁻³×(1 + μ×sin2θ)

2. Decimal separators: none

3. Superscripts: 2θ → 2θ (already OK)

4. Whitespace: add around = and operators
   σ_y × [E₁₂/E₂₂] = 250 × 10⁻³ × (1 + μ × sin 2θ)

5. Engineering notation: 10⁻³ already canonical

Output:
σ_y × [E₁₂/E₂₂] = 250 × 10⁻³ × (1 + μ × sin 2θ)
```

### Example 2: Stress Formula (Russian)

```
Input:
σ (Cyrillic С) = F,A / N

Normalization steps:
1. Cyrillic vs Greek: context is stress formula → σ is Greek sigma
   σ = F,A / N

2. Decimal separator: , → .
   σ = F.A / N

3. Division notation: / → / (keep)
   σ = F.A / N

4. Whitespace normalization:
   σ = F.A/N

Output:
σ = F.A/N
```

### Example 3: Complex Engineering Notation

```
Input:
n = 1,5e-5 м²

Normalization steps:
1. Decimal separator: , → .
   n = 1.5e-5 м²

2. Engineering notation: e → ×10^
   n = 1.5 × 10⁻⁵ м²

3. Whitespace:
   n = 1.5×10⁻⁵ м²

Output:
n = 1.5×10⁻⁵ м²
```

---

## 7️⃣ FORMULA NORMALIZATION CHECKLIST

**Before marking as CANONICAL:**

- ✅ All multiplication symbols normalized to ×
- ✅ All minus signs normalized to -
- ✅ All decimal separators normalized to .
- ✅ Whitespace around operators consistent
- ✅ Superscripts and subscripts in Unicode forms
- ✅ Unicode NFC normalization applied
- ✅ Engineering notation standardized (e → ×10^)
- ✅ No confusion matrix conflicts
- ✅ Dimensional analysis passes (if applicable)
- ✅ Symbol consistency verified
- ✅ Formula structure normalized (fractions, parentheses)
- ✅ Reviewer validated against confusion matrix

---

## 8️⃣ NORMALIZATION EDGE CASES AND DECISIONS

### Case 1: Formula with Implicit Multiplication

```
Input:  2x + 3y (implicit multiplication)
Output: 2x + 3y (keep as is, no × inserted)
        (because context is algebra, not engineering formula)
```

### Case 2: Mixed Notation (Linear vs Fractional)

```
Input:  σ = F/A and τ = (F)/(A)
Output: Both normalized to: σ = F/A, τ = F/A (same canonical form)
```

### Case 3: Non-ASCII Engineering Notation

```
Input (Russian):  1,5×10⁻⁵ (with Russian formatting)
Output:           1.5×10⁻⁵ (canonical English notation)
```

---

## 9️⃣ VERSIONING AND UPDATES

**Version 1.0 (2026-05-10):**
- Multiplication symbol rules (A1-A3)
- Minus sign rules (B1-B5)
- Decimal separator rules (C1-C3)
- Whitespace rules (D1-D6)
- Superscript/subscript rules (E1-E5)
- Unicode normalization (F1-F4)
- Engineering notation (G1-G4)
- Confusion matrix (Greek/Cyrillic, Latin/Greek)
- Formula structure normalization
- Multi-line formula handling
- Normalization checklist

**Future updates:**
- Probability notation (P, Pr, Prob, ℙ) → standard form
- Matrix notation (A, [a], M) → standard form
- Calculus operators (∫, ∂, ∇, Δ) → standard form
- Complex numbers (j vs i for imaginary unit) → context rule

---

## 📝 ПРИМЕЧАНИЯ

1. **Determinism:** Каждое правило должно дать одинаковый результат всегда.
2. **Context:** Некоторые правила требуют контекста (например, буква x vs ×). Контекст инженерной формулы предполагается.
3. **Lineage:** Каждая нормализация записывается в NORMALIZATION_LINEAGE.
4. **Reviewer:** Reviewer проверяет нормализацию против этого стандарта, но не инвентирует вручную.

---

**Следующий документ:** UNIT_NORMALIZATION_STANDARD.md (canonical unit registry)
