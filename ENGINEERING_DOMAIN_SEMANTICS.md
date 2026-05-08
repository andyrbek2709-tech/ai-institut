# ENGINEERING DOMAIN SEMANTICS
## Дисциплинарно-осведомлённая семантическая интерпретация

**Статус:** 🟦 SEMANTIC ARCHITECTURE — PHASE 3  
**Дата:** 2026-05-09  
**Версия:** 1.0  
**Контекст:** SEMANTIC_EQUIVALENCE_ARCHITECTURE.md → STAGE 3

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **дисциплинарно-специфичную интерпретацию** инженерных формул, которая:
- Разрешает многозначность одинаковых формул в разных дисциплинах
- Отслеживает domain-specific constraints и assumptions
- Идентифицирует "одна формула, разный смысл" ситуации
- Валидирует формулы в контексте их инженерной дисциплины

**Принцип:** Одинаковая формула может иметь совершенно разный смысл в разных дисциплинах.

---

## 1️⃣ ENGINEERING DISCIPLINES REGISTRY

### 1.1 DISCIPLINE DEFINITION

```
ENGINEERING_DISCIPLINE := {
  name: string                      // "structural_engineering"
  full_name: string                 // "Structural Engineering"
  subdisciplines: string[]          // ["concrete_design", "steel_design"]
  primary_quantities: string[]      // quantities commonly used
  common_formulas: string[]         // frequently used formulas
  failure_criteria: string[]        // how failure is defined
  standards: string[]               // applicable codes (ACI, AISC, etc.)
  constraints: DOMAIN_CONSTRAINT[]  // domain-specific rules
  unit_preferences: {               // typical unit choices
    [quantity]: unit[]
  }
  dangerous_confusions: string[]    // what to watch for
  cross_domain_conflicts: string[]  // where conflicts with other domains occur
}
```

### 1.2 REGISTERED DISCIPLINES

```
1. STRUCTURAL ENGINEERING
   Subdisciplines: concrete, steel, masonry, timber, composites
   Primary quantities: stress, strain, force, moment, deflection
   Failure criteria: yield, ultimate, fatigue, buckling
   Standards: ACI 318, AISC 360, ASCE 7
   Common confusion: "Is this stress or pressure?"
   Units: kN, m, MPa, kN/m², mm

2. PIPING ENGINEERING
   Subdisciplines: pressure vessels, process piping, HVAC, utility
   Primary quantities: pressure, temperature, flow rate, velocity
   Failure criteria: burst, corrosion, fatigue, thermal expansion
   Standards: ASME B31.1, ASME B31.3, ASME VIII
   Common confusion: gauge vs absolute pressure, unit conversions
   Units: bar, psi, °C, m³/s, m/s

3. MECHANICAL ENGINEERING
   Subdisciplines: machine design, vibration, dynamics, thermodynamics
   Primary quantities: force, torque, power, temperature, pressure
   Failure criteria: yield, fatigue, thermal, vibration
   Standards: AGMA, DIN, ISO
   Common confusion: "Is this torque or moment?" (both have [M L² T⁻²])
   Units: N⋅m, kW, °C, rpm, bar

4. FLUID MECHANICS
   Subdisciplines: open channel, pipe flow, aerodynamics, hydraulics
   Primary quantities: pressure, velocity, viscosity, density
   Failure criteria: cavitation, erosion, separation, instability
   Standards: Fluid mechanics first principles (Bernoulli, Navier-Stokes)
   Common confusion: "Kinematic vs dynamic viscosity"
   Units: Pa, m/s, m²/s, Pa⋅s, kg/m³

5. THERMAL ENGINEERING
   Subdisciplines: heat transfer, HVAC, combustion, cryogenics
   Primary quantities: temperature, heat flux, thermal conductivity
   Failure criteria: thermal stress, creep, thermal expansion mismatch
   Standards: ASHRAE, ISO thermal properties
   Common confusion: "Is this absolute or gauge?" (especially for pressure)
   Units: °C, K, W/m², W/(m⋅K), J/s

6. ELECTRICAL ENGINEERING
   Subdisciplines: power, controls, electronics, communications
   Primary quantities: voltage, current, power, resistance, frequency
   Failure criteria: overcurrent, overvoltage, insulation breakdown
   Standards: IEEE, IEC, NFPA 70 (NEC)
   Common confusion: AC vs DC, RMS vs peak, phase relationships
   Units: V, A, W, Ω, Hz

7. MATERIAL SCIENCE
   Subdisciplines: metallurgy, ceramics, polymers, composites
   Primary quantities: strength, modulus, toughness, ductility
   Failure criteria: brittle fracture, creep, fatigue, corrosion
   Standards: ASTM, ISO material testing
   Common confusion: "Different test conditions yield different values"
   Units: MPa, %, J/m², kJ/m²

8. CONTROL SYSTEMS
   Subdisciplines: feedback control, signal processing, systems
   Primary quantities: gain, frequency, damping, response time
   Failure criteria: instability, overshoot, steady-state error
   Standards: control theory (Nyquist, Bode, root locus)
   Common confusion: "Same equation, different interpretation (analog vs digital)"
   Units: Hz, dB, rad/s, s, dimensionless
```

---

## 2️⃣ DOMAIN-SPECIFIC FORMULA INTERPRETATION

### 2.1 STRESS/PRESSURE DISAMBIGUATION

```
FORMULA: X = F / A

In STRUCTURAL ENGINEERING:
  X = STRESS (σ)
  Definition: Internal resistance of material to deformation
  Formula interpretation: Normal stress on cross-section
  Units: Pa, MPa, kPa, psi
  Failure check: σ ≤ σ_yield (material property)
  Typical range: 0.1 - 1000 MPa
  Domain constraints:
    - F must be force applied to member
    - A must be cross-sectional area of member
    - Assumes uniaxial stress (not multi-axial)
    - Assumes quasi-static loading

In PIPING ENGINEERING:
  X = PRESSURE (P)
  Definition: Normal force per unit area on vessel wall
  Formula interpretation: Fluid pressure acting on surface
  Units: bar, Pa, psi, atm
  Failure check: P ≤ P_allowable (design pressure)
  Typical range: 0.1 - 350 bar
  Domain constraints:
    - F is hydrostatic force (ρ × g × h) or external load
    - A is wetted surface area
    - Must account for gauge vs absolute
    - Temperature-dependent (affects allowable)

In MATERIAL SCIENCE (TESTING):
  X = STRESS (σ_test)
  Definition: Stress applied to test specimen
  Formula interpretation: Applied load divided by original cross-section
  Units: Pa, MPa, kPa, psi (same as structural)
  Failure check: σ_test relates to material properties (yield, UTS)
  Typical range: same as structural but measured under controlled conditions
  Domain constraints:
    - F is controlled test load
    - A is original (initial) cross-sectional area
    - Must account for strain-hardening effects
    - Temperature and strain rate controlled

SEMANTIC EQUIVALENCE:
  Formula: IDENTICAL (F / A)
  Dimension: IDENTICAL ([M¹ L⁻¹ T⁻²])
  Semantics: DIFFERENT (solid stress vs fluid pressure vs test specimen)
  
  → Dimensionally equivalent ✓
  → Semantically equivalent ONLY within same domain ✓
  → Cross-domain equivalence FALSE ✗
```

### 2.2 MODULUS INTERPRETATION

```
FORMULA: E = σ / ε  (stress divided by strain)

In STRUCTURAL MECHANICS:
  E = MODULUS_OF_ELASTICITY (Young's modulus)
  Definition: Stiffness of material in tension/compression
  Interpretation: How much stress needed for unit strain
  Units: Pa, MPa, GPa, psi
  Typical values: 30 GPa (steel), 200 GPa (aluminum), 0.2 GPa (wood)
  Domain constraints:
    - Valid only in elastic range (before yield)
    - Assumes linear relationship (σ = E × ε)
    - Material property (independent of geometry)
    - Temperature-dependent

In MATERIAL SCIENCE (DMA):
  E = COMPLEX_MODULUS (frequency-dependent)
  Definition: Dynamic mechanical property under oscillation
  Interpretation: E'(ω) = storage modulus, E''(ω) = loss modulus
  Units: Pa, MPa, GPa (same as above)
  Typical values: Similar to static but frequency-dependent
  Domain constraints:
    - Valid for oscillatory loading
    - Depends on frequency and temperature
    - Shows material damping (E'')
    - Different from static modulus

In THERMAL ANALYSIS:
  E ≠ modulus (different meaning in different context)
  But: thermal expansion α × E affects stress (thermal stress)
  Domain constraints:
    - E enters as elastic modulus in stress calculation
    - But E itself may be temperature-dependent
    - Thermal strain ε_thermal = α × ΔT

SEMANTIC EQUIVALENCE:
  Equation form: IDENTICAL (σ / ε)
  Dimension: IDENTICAL ([M¹ L⁻¹ T⁻²])
  Semantics: DIFFERENT (static elastic, dynamic, thermal context)
  
  → Cannot simply interchange static and dynamic modulus ✗
  → Must specify domain: "E (static)" vs "E' (dynamic)" ✓
```

### 2.3 PRESSURE INTERPRETATION

```
FORMULA: P = ρ × g × h  (hydrostatic pressure)

In PIPING ENGINEERING:
  P = HYDROSTATIC_PRESSURE (static fluid)
  Definition: Pressure at depth h below surface
  Interpretation: P increases linearly with depth
  Units: bar, Pa, psi
  Domain constraints:
    - Valid for incompressible fluid (most liquids)
    - ρ is fluid density (constant)
    - g is gravitational acceleration
    - h is vertical depth (not distance along slope)
    - Assumes static equilibrium

In AERODYNAMICS:
  P_dynamic = 0.5 × ρ × v²  (dynamic pressure)
  Definition: Pressure equivalent of kinetic energy
  Interpretation: Stagnation pressure minus static pressure
  Units: Pa, bar, psi (same units but different meaning)
  Domain constraints:
    - Valid for moving fluid
    - ρ is air density
    - v is velocity relative to object
    - Compressibility effects ignored (low Mach)

In OCEAN/GEOTECHNICS:
  P = P_atmospheric + ρ × g × h  (total pressure)
  Definition: Absolute pressure at depth
  Interpretation: Must account for atmospheric pressure
  Units: Pa, bar, psi (absolute, not gauge)
  Domain constraints:
    - P_atmospheric ≈ 1 bar at sea level
    - Critical for suction (cavitation occurs at ~0.1 bar absolute)
    - Different from gauge pressure (P_gauge = P_absolute - P_atm)

SEMANTIC EQUIVALENCE:
  Formula: Different formulas! (P = ρgh vs P = ½ρv²)
  Dimension: IDENTICAL ([M¹ L⁻¹ T⁻²])
  Semantics: COMPLETELY DIFFERENT (hydrostatic vs dynamic)
  
  → Same dimension but CANNOT be interchanged ✗
  → Must understand which P (hydrostatic, dynamic, total, gauge) ✗
```

---

## 3️⃣ DOMAIN-SPECIFIC CONSTRAINTS

### 3.1 CONSTRAINT TYPES

```
CONSTRAINT_TYPE := {
  type: string                      // "EQUATION_DOMAIN", "ASSUMPTION", "UNIT_REQUIREMENT"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description: string               // human-readable
  enforcement: "AUTOMATIC" | "MANUAL" | "CONTEXTUAL"
  check_function: lambda            // how to verify
}
```

### 3.2 STRUCTURAL ENGINEERING CONSTRAINTS

```
CONSTRAINT 1: Ultimate Strength Check
  Formula applies: σ = M × y / I  (bending stress)
  Constraint: σ_actual ≤ φ × f_y  (φ = resistance factor)
  Severity: CRITICAL (safety-critical)
  Why: Yield or rupture failure must be prevented
  Domain specifics:
    - φ depends on load type (tension, compression, bending)
    - f_y varies by steel grade (ASTM, EUROCODES)
    - Material properties must be tested/certified

CONSTRAINT 2: Buckling Check
  Formula applies: σ_critical = π² × E / (KL/r)²  (Euler)
  Constraint: σ_actual ≤ σ_critical × φ_b
  Severity: CRITICAL (especially long, slender members)
  Why: Buckling is sudden, catastrophic failure
  Domain specifics:
    - K = effective length factor (1.0 to 2.0 typically)
    - r = radius of gyration (geometry-dependent)
    - Valid only if KL/r > threshold (slenderness)

CONSTRAINT 3: Serviceability Limit State
  Formula applies: Δ = L / 240 (deflection limit)
  Constraint: Δ_actual ≤ Δ_allowable
  Severity: MEDIUM (not safety-critical, affects functionality)
  Why: Excessive deflection affects finishes, causes cracking
  Domain specifics:
    - Limit depends on member type (beam, cantilever, etc.)
    - Limits vary by code (1/240 to 1/360 common)
    - Must use service-load analysis (not ultimate)

CONSTRAINT 4: Fatigue Check
  Formula applies: S_n = σ_limit / (log(N) / log(10³))
  Constraint: σ_range ≤ S_n (stress range must not exceed endurance limit)
  Severity: CRITICAL (for cyclic loading)
  Why: Fatigue failure occurs at much lower stress than static
  Domain specifics:
    - Number of cycles N affects allowable stress
    - σ_limit depends on material condition
    - Stress concentration factors must be included
```

### 3.3 PIPING ENGINEERING CONSTRAINTS

```
CONSTRAINT 1: Pressure Boundary Integrity
  Formula applies: t = (P × D) / (2 × σ × e) + c  (wall thickness)
  Constraint: t_design ≥ t_required (safety factor ≥ 1.5)
  Severity: CRITICAL (explosive rupture risk)
  Why: Sudden release of pressurized fluid is dangerous
  Domain specifics:
    - P = design pressure (typically 1.5 × operating)
    - D = outside diameter
    - σ = material allowable stress (temp-dependent)
    - e = weld efficiency (0.85 - 1.0)
    - c = corrosion allowance (0.5-3 mm)

CONSTRAINT 2: Pressure Relief Valve Setting
  Formula applies: P_relief = 1.1 × P_design  (overpressure protection)
  Constraint: Relief valve must open before pipe bursts
  Severity: CRITICAL (overpressure protection)
  Why: Prevents system damage and personnel hazard
  Domain specifics:
    - ASME code mandates 10% overpressure maximum
    - Relief valve capacity must match max pump flow
    - Multiple valves needed for redundancy

CONSTRAINT 3: Thermal Expansion
  Formula applies: ΔL = α × L × ΔT  (linear expansion)
  Constraint: Expansion stress: σ = α × ΔT × E (must be accommodated)
  Severity: HIGH (can cause rupture if pipe is constrained)
  Why: Temperature changes cause pipe length changes
  Domain specifics:
    - α varies by material (steel: ~12 μm/m/K)
    - Expansion loops or flexible joints must be provided
    - Stress can reach yield if motion is prevented
    - Design must account for max/min temperature range

CONSTRAINT 4: Corrosion Allowance
  Formula applies: t_actual = t_required + c  (where c = corrosion allowance)
  Constraint: c ≥ expected_corrosion_depth over vessel_life
  Severity: HIGH (failure if allowance too small)
  Why: Corrosion gradually reduces wall thickness
  Domain specifics:
    - c typically 1-3 mm for industrial piping
    - Depends on fluid, temperature, material
    - Can be 5-10 mm for highly corrosive services
```

### 3.4 THERMAL ENGINEERING CONSTRAINTS

```
CONSTRAINT 1: Heat Transfer Rate Limitation
  Formula applies: Q = U × A × ΔT_LMTD  (heat exchanger)
  Constraint: Q_required ≤ Q_available (must provide enough heat transfer area)
  Severity: CRITICAL (if not met, process fails)
  Why: Insufficient heat transfer means poor temperature control
  Domain specifics:
    - U = overall heat transfer coefficient (W/(m²⋅K))
    - A = heat transfer surface area
    - ΔT_LMTM = log mean temperature difference
    - U varies with fouling (changes over time)

CONSTRAINT 2: Insulation Thickness
  Formula applies: R_total = R_inside + R_insulation + R_outside
  Constraint: Temperature drop across insulation must be calculated
  Severity: MEDIUM (affects efficiency)
  Why: Too little insulation wastes energy
  Domain specifics:
    - R = thermal resistance (K/W)
    - Insulation thickness depends on acceptable heat loss
    - Environmental/safety regulations may set minimum
    - Cost-benefit analysis determines optimal thickness

CONSTRAINT 3: Freeze Protection
  Formula applies: T_surface ≥ 0°C (water pipes)
  Constraint: Must ensure surface temperature stays above freezing
  Severity: HIGH (frozen pipes break)
  Why: Water expands when frozen, ruptures pipe
  Domain specifics:
    - Heat tracing or insulation required in cold climates
    - Pipe diameter affects freezing time
    - Pipe material affects heat loss (copper vs steel)
```

---

## 4️⃣ MULTI-DOMAIN FORMULA DISAMBIGUATION

### 4.1 ALGORITHM

```
function disambiguate_formula_domain(
  formula: SEMANTIC_FORMULA,
  possible_domains: string[]
): DOMAIN_INTERPRETATION[]

algorithm:
  interpretations = []
  
  for each domain in possible_domains:
    // Check if formula is valid in this domain
    if not is_valid_formula_in_domain(formula, domain):
      continue
    
    // Resolve symbol meanings in this domain
    resolved_symbols = resolve_symbols_in_domain(formula, domain)
    
    // Check domain-specific constraints
    constraint_violations = []
    for each constraint in domain_constraints[domain]:
      if not check_constraint(formula, constraint):
        constraint_violations.add(constraint)
    
    // Calculate "fit" score
    fit_score = calculate_domain_fit(
      formula,
      domain,
      constraint_violations
    )
    
    // Create interpretation
    interpretation = {
      domain: domain,
      resolved_symbols: resolved_symbols,
      constraints_satisfied: constraint_violations.empty(),
      violations: constraint_violations,
      fit_score: fit_score,
      safety_critical: is_safety_critical(domain),
      standard_reference: lookup_applicable_standard(domain)
    }
    
    interpretations.add(interpretation)
  
  // Sort by fit score
  interpretations.sort_by(fit_score, descending)
  
  return interpretations
```

### 4.2 EXAMPLE: P = ρ × g × h

```
Input formula: P = ρ × g × h
Possible domains: [piping, aerodynamics, geotechnics, hydraulics]

INTERPRETATION 1: PIPING (fit_score = 95%)
  Domain: Piping Engineering
  Symbol resolution:
    P = HYDROSTATIC_PRESSURE (bar, Pa, psi)
    ρ = fluid density (kg/m³)
    g = gravitational acceleration (9.81 m/s²)
    h = vertical depth (m)
  
  Constraints satisfied:
    ✓ Incompressible fluid assumption
    ✓ Static equilibrium assumed
    ✓ Units consistent (Pa)
  
  Constraints violated: None
  
  Safety critical: YES (relates to vessel rupture)
  Standard: ASME B31.3, ASME VIII

INTERPRETATION 2: GEOTECHNICS (fit_score = 92%)
  Domain: Geotechnical/Foundation Engineering
  Symbol resolution:
    P = TOTAL_EARTH_PRESSURE (kPa, psi)
    ρ = soil density (kg/m³)
    g = gravitational acceleration (9.81 m/s²)
    h = depth below surface (m)
  
  Constraints satisfied:
    ✓ Used for foundation design
    ✓ Hydrostatic pressure component
  
  Constraints violated:
    ⚠️ Actually P = σ_z = γ × h (specific weight, not ρ×g)
  
  Safety critical: YES (foundation stability)
  Standard: ASCE 7, Geotechnical codes

INTERPRETATION 3: HYDRAULICS (fit_score = 88%)
  Domain: Hydraulic Systems
  Symbol resolution:
    P = STATIC_HYDRAULIC_PRESSURE (bar, psi)
    ρ = hydraulic fluid density (~800-1000 kg/m³)
    g = gravitational acceleration (9.81 m/s²)
    h = fluid height in column (m)
  
  Constraints satisfied:
    ✓ Fluid is incompressible
    ✓ Used for accumulator sizing
  
  Constraints violated: None
  
  Safety critical: MEDIUM (system loses power if pressure drops)
  Standard: ISO fluid power standards

INTERPRETATION 4: AERODYNAMICS (fit_score = 5%)
  Domain: Aerodynamics
  Symbol resolution:
    This formula does NOT represent dynamic pressure
    Dynamic pressure = ½ × ρ × v² (completely different)
  
  Constraints satisfied: None (wrong formula)
  Constraints violated:
    ✗ Aerodynamic pressure is NOT hydrostatic
    ✗ Formula misapplied to aerodynamics
  
  Safety critical: N/A
  Standard: Fluid mechanics (would need correct formula)
  
Recommendation:
  This formula is AMBIGUOUS between piping, geotechnics, and hydraulics.
  MUST disambiguate based on context:
    - If "pressure at pipe wall" → Piping (ASME)
    - If "pressure on foundation" → Geotechnics (ASCE)
    - If "pressure in fluid column" → Hydraulics (ISO)
  
  NOT applicable to aerodynamics (different formula needed).
```

---

## 5️⃣ DANGEROUS DOMAIN CONFUSIONS

### 5.1 STRESS vs PRESSURE (HIGHEST RISK)

```
CONFUSION: These formulas look identical but mean different things

STRUCTURAL DESIGN:
  σ = F / A  (stress in solid member)
  Check: σ ≤ f_y (yield strength of steel)
  Failure: Plastic deformation, member becomes unusable
  Example: σ = 250 N / 100 mm² = 2.5 N/mm² = 2.5 MPa

PIPING DESIGN:
  P = F / A  (pressure in vessel)
  Check: P ≤ P_allowable (max working pressure)
  Failure: Rupture, explosive release of contents
  Example: P = 250,000 N / 100 mm² = 2500 N/mm² = 2500 MPa (way too high!)

SAME FORMULA, VERY DIFFERENT CONSEQUENCES!

Risk: Confusing 2.5 MPa (steel stress) with 2500 MPa (vessel pressure) 
      would over-design vessel by 1000×, but design codes separate them.
```

### 5.2 TORQUE vs ENERGY

```
CONFUSION: Both have dimension [M¹ L² T⁻²], can be confused

MECHANICAL ENGINEERING:
  τ = r × F (torque = radius × force)
  Interpretation: Rotational force
  Units: N⋅m (SI)
  Application: Motor sizing, shaft design
  Example: τ = 0.5 m × 1000 N = 500 N⋅m

ENERGY/WORK:
  E = F × d (energy = force × distance)
  Interpretation: Work done (translational)
  Units: N⋅m = J (joule)
  Application: Power, efficiency calculations
  Example: E = 1000 N × 0.5 m = 500 J

SAME VALUE, DIFFERENT MEANING!

Risk: Confusing rotational power (τ × ω) with translational power (F × v)
      Different formulas: P_rot = τ × ω, P_trans = F × v
```

### 5.3 KINEMATIC vs DYNAMIC VISCOSITY

```
CONFUSION: Different dimensions but constantly confused

DYNAMIC VISCOSITY (μ):
  Dimension: [M¹ L⁻¹ T⁻¹]
  Units: Pa⋅s, cP (centipoise)
  Definition: Resistance to shear stress
  Formula: τ = μ × (dv/dy)  (Newton's law of viscosity)
  Example: μ_water = 1 cP @ 20°C

KINEMATIC VISCOSITY (ν):
  Dimension: [L² T⁻¹]  ← DIFFERENT dimension!
  Units: m²/s, cSt (centistokes)
  Definition: Dynamic viscosity divided by density
  Formula: ν = μ / ρ
  Example: ν_water = 1 cSt @ 20°C

DANGER: Velocity in pipe flow formula is:
  v = √(2 × g × Δh / (L/D × (1 + e) × ρ/ρ₀))
  
  Confusion: Using kinematic viscosity where dynamic needed (or vice versa)
  Result: Wrong friction factor, wrong pressure drop calculation
  
  Consequence: Undersized pump = inadequate flow
             Oversized pump = wasted energy
```

### 5.4 ABSOLUTE vs GAUGE PRESSURE

```
CONFUSION: Same units, VERY different meanings in HVAC/piping

ABSOLUTE PRESSURE:
  P_absolute = pressure measured from vacuum (0)
  Reference: Perfect vacuum
  Typical: 100 kPa (sea level atmosphere)
  HVAC: Absolute pressure used in psychrometric charts
  Piping: Some calculations require absolute pressure

GAUGE PRESSURE:
  P_gauge = pressure measured from atmospheric baseline
  Reference: Local atmospheric pressure (~100 kPa sea level)
  Typical: 0 kPa (atmospheric), 500 kPa (0.5 MPa gauge)
  HVAC: Often given as gauge pressure (e.g., 30 kPa gauge)
  Piping: Design pressures usually gauge (ASME, ANSI standards)

CONVERSION:
  P_absolute = P_gauge + P_atmospheric
  Example: P_gauge = 500 kPa → P_absolute = 500 + 100 = 600 kPa

DANGER:
  In refrigeration: 
    Saturation pressure tables use ABSOLUTE pressure
    But gauges read GAUGE pressure
    Missing conversion → wrong refrigerant selection → system fails
  
  In vacuum systems:
    Formula uses absolute pressure
    Using gauge pressure (negative) gives wrong answer
    Consequence: Vacuum system designed incorrectly
```

---

## 6️⃣ DOMAIN VALIDATION API

### 6.1 CORE FUNCTIONS

```typescript
// Get domain interpretation of formula
function get_domain_interpretation(
  formula: SEMANTIC_FORMULA,
  domain: string
): DOMAIN_INTERPRETATION

// Disambiguate formula across multiple domains
function disambiguate_across_domains(
  formula: SEMANTIC_FORMULA,
  possible_domains: string[]
): DOMAIN_INTERPRETATION[]

// Check if formula is valid in domain
function validate_formula_in_domain(
  formula: SEMANTIC_FORMULA,
  domain: string
): {valid: boolean, violations: CONSTRAINT_VIOLATION[]}

// Find formulas with same structure in different domains
function find_homomorphic_formulas(
  formula: SEMANTIC_FORMULA,
  domains: string[]
): {domain: string, similar_formulas: SEMANTIC_FORMULA[]}[]

// Get domain-specific constraints
function get_domain_constraints(domain: string): DOMAIN_CONSTRAINT[]

// Check constraint compliance
function check_constraint_compliance(
  formula: SEMANTIC_FORMULA,
  constraint: DOMAIN_CONSTRAINT,
  domain: string
): {compliant: boolean, details: string}

// Get applicable standard for domain
function get_applicable_standard(domain: string, formula_type: string): STANDARD
```

### 6.2 DATA STRUCTURES

```typescript
type DOMAIN_INTERPRETATION = {
  domain: string
  resolved_symbols: {[symbol: string]: RESOLVED_SYMBOL}
  constraints_satisfied: boolean
  violations: CONSTRAINT_VIOLATION[]
  fit_score: number        // 0-100
  safety_critical: boolean
  standard_reference: string
  typical_units: {[quantity]: string[]}
  common_mistakes: string[]
}

type RESOLVED_SYMBOL = {
  symbol: string
  engineering_quantity: string
  domain_specific_meaning: string
  typical_values_range: {min: number, max: number, unit: string}
}

type CONSTRAINT_VIOLATION = {
  constraint: DOMAIN_CONSTRAINT
  violated: boolean
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  explanation: string
}
```

---

## 7️⃣ REMAINING QUESTIONS FOR PHASE 3

- [ ] How to handle discipline boundaries (e.g., mechanical-thermal coupling)?
- [ ] How to represent evolving standards (old vs new codes)?
- [ ] How to track domain expertise levels (which assumptions are standard vs advanced)?
- [ ] How to handle exceptions to domain rules (e.g., non-standard materials)?
- [ ] How to represent incomplete domain knowledge?

---

## PHASE 3 SUMMARY

✅ **Delivered:**
1. Engineering disciplines registry (8 major disciplines)
2. Domain-specific formula interpretation (stress/pressure examples)
3. Modulus interpretation across domains
4. Pressure interpretation (hydrostatic, dynamic, absolute, gauge)
5. Domain-specific constraints (5 categories)
6. Structural engineering constraints
7. Piping engineering constraints
8. Thermal engineering constraints
9. Multi-domain disambiguation algorithm
10. Dangerous domain confusions (4 high-risk cases)
11. Domain validation API
12. Worked examples

➡️ **NEXT PHASE:** SEMANTIC_REVIEW_CONTRACT.md (ÉTАП 4)
   - How human reviewers validate semantic equivalence
   - Mandatory semantic review procedures
   - Arbitration workflow
