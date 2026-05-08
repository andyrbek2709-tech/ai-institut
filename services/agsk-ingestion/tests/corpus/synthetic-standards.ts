/**
 * Synthetic Standards Corpus — Week 5
 *
 * Generates representative ParsedDocument objects for 6 priority engineering standards.
 * Bypasses PDF parsing (proven working in Week 3/4) to test chunking + retrieval
 * against realistic standards content aligned with evaluation_dataset.json queries.
 *
 * Standards covered:
 *   PRIORITY 1: ASME B31.4, ASME B31.8, API 5L, API 1104, NACE MR0175, NACE SP0169
 *   PRIORITY 2: GOST 20295, ST RK ISO 3183 (pipeline welding + corrosion)
 *
 * Corpus classification: all 'normative' corpus_type
 */

import type { ParsedDocument, ParsedPage, ParsedSection } from '../../src/parsers/pdf-parser.js';

export interface SyntheticStandard {
  id:           string;
  filename:     string;
  org:          string;
  discipline:   string;
  corpus_type:  'normative' | 'catalog' | 'reference';
  doc:          ParsedDocument;
}

// ── Helper to build ParsedDocument from section list ─────────────────────────

function buildDoc(
  sections: Array<{ heading: string; level: number; path: string[]; content: string; page: number }>,
  title: string,
): ParsedDocument {
  const parsedSections: ParsedSection[] = sections.map((s, i) => ({
    heading:      s.heading,
    level:        s.level,
    section_path: s.path,
    content:      s.content,
    page_start:   s.page,
    page_end:     s.page + Math.ceil(s.content.split('\n').length / 40),
  }));

  // Build pages from sections (~ 40 lines per page)
  const allLines: Array<{ text: string; page: number }> = [];
  for (const s of sections) {
    allLines.push({ text: s.heading, page: s.page });
    for (const line of s.content.split('\n')) {
      allLines.push({ text: line, page: s.page });
    }
  }

  const pageMap = new Map<number, string[]>();
  for (const { text, page } of allLines) {
    if (!pageMap.has(page)) pageMap.set(page, []);
    pageMap.get(page)!.push(text);
  }

  const pages: ParsedPage[] = [...pageMap.entries()].sort((a, b) => a[0] - b[0]).map(([num, lines]) => ({
    page_number: num,
    text:        lines.join('\n'),
    word_count:  lines.join(' ').split(/\s+/).filter(Boolean).length,
  }));

  const text_full = sections.map(s => s.heading + '\n' + s.content).join('\n\n');
  const word_count = text_full.split(/\s+/).filter(Boolean).length;

  return {
    text_full,
    pages,
    sections: parsedSections,
    page_count: Math.max(...sections.map(s => s.page)) + 1,
    word_count,
    metadata: { title },
  };
}

// ── STANDARD 1: API 5L — Specification for Line Pipe ─────────────────────────

function buildAPI5L(): SyntheticStandard {
  const sections = [
    {
      heading: 'API 5L Specification for Line Pipe — Forty-Sixth Edition, 2018',
      level: 1, path: [], page: 1,
      content: `This specification covers seamless and welded steel line pipe. It includes plain-end, threaded-end, and
belled-end pipe, as well as through-the-flowline (TFL) pipe and pipe with ends prepared for use with special
couplings.

Scope: This specification covers two product specification levels (PSL 1 and PSL 2) for Grade B through X80.
PSL 1 provides basic requirements for line pipe. PSL 2 imposes additional mandatory requirements for
notch toughness and other properties.

Referenced Standards: ASME B31.4, ASME B31.8, ASME B31.12, ISO 3183, ASTM A370, ASTM E112.`,
    },
    {
      heading: '1 Scope',
      level: 1, path: ['1'], page: 2,
      content: `1.1 This specification covers seamless and welded steel pipes for use in pipeline transportation systems
in the petroleum and natural gas industries.

1.2 The material requirements apply to Grade B, X42, X46, X52, X56, X60, X65, X70, and X80.

1.3 PSL 1 and PSL 2 requirements:
- PSL 1: Standard quality level with minimum tensile properties
- PSL 2: Enhanced quality with mandatory Charpy impact testing, additional NDE`,
    },
    {
      heading: '4 Dimensions, Mass, and Tolerances',
      level: 1, path: ['4'], page: 5,
      content: `4.1 Pipe diameters range from NPS 1/8 through NPS 80 (DN 6 through DN 2000).

4.2 Wall Thickness — Minimum wall thickness shall not be less than the specified wall thickness minus the
permissible minus tolerance. For pipe ordered to a specified wall thickness:
- Minus tolerance: 12.5% of specified wall thickness
- Plus tolerance: mill practice

4.3 Specified outside diameter tolerances (Table 9):
- NPS ≤ 4 (DN ≤ 100): ±0.031 in. (±0.8 mm)
- NPS 4.5–12 (DN 115–300): ±0.031 in. (±0.8 mm)
- NPS > 12 (DN > 300): ±0.1% OD`,
    },
    {
      heading: '7 Mechanical Properties — PSL 1 and PSL 2',
      level: 1, path: ['7'], page: 12,
      content: `7.1 General Requirements
Pipe shall conform to the tensile property requirements specified in Table 2 (PSL 1) and Table 3 (PSL 2).

7.2 Yield Strength and Tensile Strength — Grade X52 (PSL 1):
- Minimum yield strength: 52,200 psi (360 MPa)
- Minimum tensile strength: 66,700 psi (460 MPa)
- Maximum yield strength: 75,400 psi (520 MPa)
- Maximum YS/TS ratio: 0.93

7.3 Grade X65 (PSL 2):
- Minimum yield strength: 65,300 psi (450 MPa)
- Minimum tensile strength: 77,500 psi (535 MPa)
- Charpy impact energy (full size at 0°C): ≥ 27 J (transverse)

7.4 Wall Thickness and Pressure Design (reference ASME B31.8 Section 841.1):
Minimum wall thickness for given pressure P (psi), OD D (in.), grade SMYS (psi):
   t_min = P × D / (2 × SMYS × F × E × T)
where F = design factor (0.72 pipeline, 0.60 class 2), E = 1.0 seamless, T = temperature factor.

For Grade X52 at 1000 psi operating pressure, NPS 16 (D = 16.000 in.):
   t_min = 1000 × 16 / (2 × 52200 × 0.72 × 1.0 × 1.0) = 0.213 in. (5.41 mm)`,
    },
    {
      heading: 'Table 7 — Permissible Hydrostatic Test Pressures',
      level: 2, path: ['7', '7.T7'], page: 14,
      content: `Hydrostatic test pressures for selected grades and wall thicknesses (psi):

Grade X42:  yield strength 42,000 psi, test pressure = 0.60 × SMYS × 2t/D
Grade X52:  yield strength 52,000 psi, minimum wall thickness per OD and test pressure
Grade X65:  yield strength 65,000 psi, enhanced impact requirements (PSL 2 only)
Grade X80:  yield strength 80,000 psi, PSL 2 only, special heat treatment

Wall thickness selection is based on:
  - Maximum allowable operating pressure (MAOP)
  - Class location (Class 1–4 per ASME B31.8)
  - Design factor F (0.72 Class 1, 0.60 Class 2, 0.50 Class 3, 0.40 Class 4)
  - Temperature derating if T > 250°F (121°C)`,
    },
    {
      heading: '9 Testing Requirements',
      level: 1, path: ['9'], page: 20,
      content: `9.1 Hydrostatic Testing
Each length of pipe shall be hydrostatically tested to the pressure specified in Section 9.5 for a minimum
duration of 5 seconds (mill test) or 1800 seconds (field test at elevated pressure).

9.2 Tensile Testing — per ASTM A370
- Longitudinal body: one test per heat
- Transverse weld: one test per 200 joints (ERW pipe)

9.3 Charpy V-Notch Impact Testing (PSL 2)
Required for pipes with specified wall thickness ≥ 0.500 in. (12.7 mm):
- Test temperature: minimum design temperature or 32°F (0°C), whichever is lower
- Absorbed energy: ≥ 27 J (full-size transverse) average; ≥ 20 J individual minimum

9.4 Non-Destructive Examination
- Ultrasonic testing (UT) of seamless pipe body: full length
- Radiographic or UT testing of weld seam: full length (ERW, SAW pipes)
- Dimensional inspection: 100% for OD, wall thickness, straightness`,
    },
    {
      heading: '10 Inspection, Certification, and Documentation',
      level: 1, path: ['10'], page: 25,
      content: `10.1 Inspection and Test Certification
The manufacturer shall provide a test report for each heat/lot of pipe conforming to the requirements
of this specification.

10.2 Mill Certificate Requirements:
- Heat number and chemistry
- Mechanical test results (yield, tensile, elongation, Charpy)
- Hydrostatic test pressure
- Non-destructive examination results
- Dimensions (OD, WT, length)

10.3 Acceptance Criteria
Pipe not conforming to this specification may be rejected. Rejected pipe may be repaired and
re-inspected subject to the provisions of Section 13.`,
    },
  ];

  return {
    id: 'API_5L_2018',
    filename: 'API-5L-2018',
    org: 'API',
    discipline: 'pipeline',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'API 5L — Specification for Line Pipe, 46th Edition 2018'),
  };
}

// ── STANDARD 2: ASME B31.4 — Pipeline Transportation Systems for Liquids ────

function buildASMEB314(): SyntheticStandard {
  const sections = [
    {
      heading: 'ASME B31.4 — Pipeline Transportation Systems for Liquids and Slurries, 2019 Edition',
      level: 1, path: [], page: 1,
      content: `This Code prescribes requirements for design, materials, construction, assembly, inspection, testing,
operation, and maintenance of liquid petroleum pipeline systems.

Scope: Applies to piping transporting liquid petroleum products between producers' lease facilities and tank
farms, refineries, pump stations, terminals, breaking tanks, and delivery and receiving points.

This Code is part of ASME B31 Code for Pressure Piping.`,
    },
    {
      heading: '400 General Statements',
      level: 1, path: ['400'], page: 3,
      content: `400.1 Scope of Chapter 4 — Design
Design requirements apply to piping systems operating at hoop stresses greater than 20% SMYS.

400.2 Intent
The intent of this Code is to set forth engineering requirements deemed necessary for safe design,
construction, and operation of liquid petroleum pipelines.`,
    },
    {
      heading: '401 Design Conditions',
      level: 1, path: ['401'], page: 5,
      content: `401.1 Design Pressure
The design pressure is the maximum internal pressure for which the piping is designed.

401.2 Maximum Allowable Operating Pressure (MAOP)
MAOP shall not exceed the design pressure. MAOP may be determined by the lesser of:
(a) The design pressure per 401.3
(b) The pressure established by the most restrictive component limit

401.3 Internal Design Pressure
The internal design pressure determines the minimum required wall thickness:
   t = (P × D) / (2 × S × E × F)
where:
   P = design gauge pressure (psi)
   D = nominal outside diameter (in.)
   S = allowable hoop stress = 0.72 × SMYS for Class 1
   E = longitudinal joint factor (1.0 seamless, 0.85 ERW)
   F = design factor (see Table 403.2.1)`,
    },
    {
      heading: '402 Allowable Stresses and Other Stress Limits',
      level: 1, path: ['402'], page: 8,
      content: `402.1 General
The basic allowable stress for pipe shall not exceed 0.72 SMYS for Class 1 locations
and 0.60 SMYS for Class 2 locations.

402.2 Combined Stresses
The longitudinal stress SL due to pressure, weight, and other sustained loads shall not exceed 0.90 SMYS.

For restrained pipe, the combined equivalent stress:
   SE = √(SH² - SH×SL + SL² + 3τ²) ≤ 0.90 SMYS
where:
   SH = hoop stress
   SL = longitudinal stress
   τ  = torsional shear stress

402.3 Thermal Expansion Stress
For unrestrained pipe:
   SE = √(Sb² + 4St²) ≤ SA
   SA = 0.72 × SMYS × f

where f = stress range reduction factor from Table 402.4.4.`,
    },
    {
      heading: '403 Piping Components — Standards and Materials',
      level: 1, path: ['403'], page: 12,
      content: `403.1 Pipe and Fittings Standards
Pipe materials shall conform to the listed standards (API 5L, ASTM A106, ASTM A335, etc.)

403.2 Design factors F by Class Location (Table 403.2.1):
  Class 1: F = 0.72 (sparsely populated, > 220 m from occupied buildings)
  Class 2: F = 0.60 (moderate population density)
  Class 3: F = 0.50 (suburban, light traffic areas)
  Class 4: F = 0.40 (high-density urban, multi-story buildings)

403.3 Pipe Bends and Elbows
Minimum bend radius ≥ 5 × OD for cold bends. Hot induction bends to ASME B16.49.

403.4 Flanges
Flanges to ASME B16.5 Class 150 through Class 2500 for NPS ≤ 24.
Flanges to ASME B16.47 Series A (MSS SP-44) for NPS ≥ 26.`,
    },
    {
      heading: '419 Cathodic Protection',
      level: 1, path: ['419'], page: 22,
      content: `419.1 External Corrosion Control
All buried or submerged pipelines shall be cathodically protected per NACE SP0169.

419.2 Design Requirements
  - Impressed current or galvanic anode systems
  - Pipe-to-soil potential: ≥ −0.85 V (Cu/CuSO4) or ≥ −0.80 V instant-off
  - Current density: 0.5–5.0 mA/ft² depending on soil resistivity
  - Coating resistance: ≥ 100,000 Ω·ft² for high-quality fusion-bonded epoxy

419.3 Monitoring
Annual surveys required: close-interval survey (CIS) every 3 years minimum.`,
    },
    {
      heading: '437 Hydrostatic Leak Testing',
      level: 1, path: ['437'], page: 28,
      content: `437.1 Required Testing
All new construction shall be hydrostatically tested before placing into service.

437.2 Test Pressure
Minimum test pressure = 1.25 × MAOP for pipelines operating at > 20% SMYS.
Maximum test pressure limited by material test records.

437.3 Test Duration
Minimum test duration: 4 hours (pipelines up to 2 miles).
For cross-country pipelines: 8 hours minimum above minimum test pressure.

437.4 Test Medium
Water is the preferred test medium. Dewatering plan required after test.`,
    },
  ];

  return {
    id: 'ASME_B31.4_2019',
    filename: 'ASME-B31.4-2019',
    org: 'ASME',
    discipline: 'pipeline',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'ASME B31.4 — Pipeline Transportation Systems for Liquids and Slurries, 2019'),
  };
}

// ── STANDARD 3: ASME B31.8 — Gas Transmission and Distribution Piping ───────

function buildASMEB318(): SyntheticStandard {
  const sections = [
    {
      heading: 'ASME B31.8 — Gas Transmission and Distribution Piping Systems, 2020 Edition',
      level: 1, path: [], page: 1,
      content: `This Code covers the design, fabrication, installation, inspection, testing, and safety aspects of operation
and maintenance of gas transmission and distribution piping systems.

Scope: Applies to gas pipelines, compressor stations, metering stations, regulating stations, and distribution
systems including all connected facilities from gas supply or production fields to the point of delivery.`,
    },
    {
      heading: '821 Design Pressure',
      level: 1, path: ['821'], page: 10,
      content: `821.1 General
The design pressure shall be the maximum internal pressure, including surges, for which the piping is designed.

821.2 Maximum Allowable Operating Pressure (MAOP)
MAOP shall not exceed the design pressure established per 821.3.

821.3 Steel Pipelines
MAOP for steel pipelines is determined by:
   P = (2 × S × T) / D × F × E × T_derating
where:
   P = design pressure (psi)
   S = SMYS (psi) per applicable material standard (API 5L, ASTM)
   T = nominal wall thickness (in.)
   D = nominal outside diameter (in.)
   F = design factor per 841.114
   E = longitudinal joint factor per 841.116
   T_derating = temperature derating factor per 841.117`,
    },
    {
      heading: '823 Wall Thickness Design for Steel Pipe',
      level: 1, path: ['823'], page: 12,
      content: `823.1 General
The minimum required wall thickness for steel pipe operating above 20% SMYS:
   t = (P × D) / (2 × S × F × E × T)

823.2 Verification
The calculated wall thickness shall be verified against the minus mill tolerance. Ordered wall
thickness = t_calc / (1 - minus_tolerance/100). For API 5L pipe, minus tolerance = 12.5%.

823.3 Example Calculation for Grade X52:
Given: P = 1000 psi, D = 16 in., SMYS = 52,200 psi, F = 0.72 (Class 1), E = 1.0, T = 1.0
   t = (1000 × 16) / (2 × 52,200 × 0.72 × 1.0 × 1.0) = 0.213 in.
Ordered WT = 0.213 / (1 - 0.125) = 0.244 in. → specify 0.250 in. (6.4 mm)`,
    },
    {
      heading: '841 Design of Pipe Members',
      level: 1, path: ['841'], page: 18,
      content: `841.114 Design Factors F
Class 1 Division 1: F = 0.80 (new construction with testing to 1.25 MAOP or higher)
Class 1 Division 2: F = 0.72 (standard design factor for Class 1)
Class 2:            F = 0.60
Class 3:            F = 0.50
Class 4:            F = 0.40

841.116 Longitudinal Joint Factor E
Seamless pipe (ASTM A106, API 5L seamless): E = 1.00
Electric Resistance Welded (ERW, API 5L): E = 1.00 (post-2008 editions, UT verified)
Submerged Arc Welded (SAW, API 5L DSAW): E = 1.00
Furnace Butt Welded: E = 0.60

841.117 Temperature Derating Factor T
For design temperatures ≤ 250°F (121°C): T = 1.000
250–300°F: T = 0.967
300–350°F: T = 0.933
350–400°F: T = 0.900
Over 450°F: T = 0.867`,
    },
    {
      heading: '845 Plastic Pipe Design',
      level: 1, path: ['845'], page: 25,
      content: `845.1 General
Plastic pipe for gas distribution may use polyethylene (PE) or polyvinyl chloride (PVC) materials.

845.2 Design Pressure for Plastic Pipe
   P = 2 × S × t / (D - t) / DF
where S = hydrostatic design basis (HDB), t = wall thickness, D = OD, DF = design factor.

For PE pipe: HDB per PPI TR-4, DF = 0.50 operating, 0.80 for 1-hour burst test.`,
    },
    {
      heading: 'Appendix A — Flexibility and Stress Intensification Factors',
      level: 1, path: ['A'], page: 50,
      content: `A.1 Thermal Expansion
Flexibility analysis required for gas piping above 250°F or where significant temperature differentials exist.

A.2 Stress Intensification Factors (SIF) for Bends:
For long-radius bends (R/r ≥ 1.5):
   i = 0.9 / h^(2/3),  h = T × R / r²

A.3 Expansion Loops and Offsets
Minimum expansion loop length for carbon steel pipe at ΔT = 100°F:
   L = 1.33 × √(D × ΔT)  (approximate; formal flexibility analysis required)`,
    },
  ];

  return {
    id: 'ASME_B31.8_2020',
    filename: 'ASME-B31.8-2020',
    org: 'ASME',
    discipline: 'pipeline',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'ASME B31.8 — Gas Transmission and Distribution Piping Systems, 2020 Edition'),
  };
}

// ── STANDARD 4: API 1104 — Welding of Pipelines and Related Facilities ───────

function buildAPI1104(): SyntheticStandard {
  const sections = [
    {
      heading: 'API Standard 1104 — Welding of Pipelines and Related Facilities, Twenty-Second Edition 2021',
      level: 1, path: [], page: 1,
      content: `This standard covers the gas and arc welding of butt, fillet, and socket welds in carbon and
low-alloy steel piping used in the compression, pumping, and transmission of crude petroleum,
petroleum products, fuel gases, carbon dioxide, nitrogen, and where applicable, water.

It applies to both new construction and in-service pipelines. Qualification procedures are included
for welding procedures, welders, and welding operators.`,
    },
    {
      heading: '5 Qualification of Welding Procedures',
      level: 1, path: ['5'], page: 10,
      content: `5.1 Procedure Specification
A Welding Procedure Specification (WPS) shall be prepared for all production welds. The WPS
shall address essential and supplemental essential variables.

5.2 Essential Variables
Changes in the following require requalification:
- Base metal P-number group
- Filler metal classification (AWS A5 series)
- Preheat / interpass temperature (decrease > 50°F from qualified)
- PWHT (addition or deletion)
- Shielding gas composition (>5% change)
- Welding process (SMAW, GMAW, FCAW, SAW)

5.3 Test Welds
Each WPS requires test welds meeting the requirements of Section 5.6 (destructive testing):
- Tensile testing (×2 specimens)
- Nick-break testing (×2 specimens minimum)
- Guided bend tests (root, face, side)
- Hardness testing (optional for sour service per NACE MR0175)`,
    },
    {
      heading: '6 Qualification of Welders and Welding Operators',
      level: 1, path: ['6'], page: 20,
      content: `6.1 General
Each welder shall be qualified by testing in the positions and to the base metal groups consistent
with the production welding to be performed.

6.2 Welder Qualification Tests
Required test welds (per 6.4):
- Butt weld in fixed position: 5G (horizontal-vertical) or 6G (inclined) — preferred
- Completed in accordance with a qualified WPS

6.3 Acceptance Criteria for Visual Examination (6.5.1)
- Cracks: none permitted
- Inadequate penetration: none for joints welded from one side
- Undercut: ≤ 1/32 in. (0.8 mm) depth and ≤ 1 in. (25 mm) length per 12 in. (300 mm)
- Surface porosity: none > 1/8 in. (3.2 mm) in longest dimension

6.4 Qualification Period
Qualification expires if the welder has not welded with the specific process for >6 months.
Annual visual re-qualification may substitute for full re-testing (company discretion).`,
    },
    {
      heading: '9 Acceptance Standards for NDT',
      level: 1, path: ['9'], page: 35,
      content: `9.1 General
Non-destructive testing (NDT) shall be performed as required by the applicable code.

9.2 Radiographic Testing — Acceptance Criteria
- Incomplete fusion (IF): not acceptable in any orientation
- Incomplete penetration (IP): ≤ 1 in. (25 mm) in any 12 in. (300 mm) of weld
- Cracks: none permitted
- Burn-through: ≤ 1/4 in. (6.4 mm) maximum individual dimension
- Porosity: per Table 2 (scattered, piping bead, cluster)

9.3 Ultrasonic Testing (UT) Acceptance
Amplitude-based accept/reject:
- Indications ≥ 20% of reference level: record and evaluate
- Indications ≥ 50% of reference level: reject unless length < 25 mm

9.4 Automated Ultrasonic Testing (AUT)
AUT with phased array systems permitted with prior qualification per Annex A.
Time-of-flight diffraction (TOFD) may supplement pulse-echo for sizing.`,
    },
    {
      heading: '11 Repair and Removal of Defects',
      level: 1, path: ['11'], page: 48,
      content: `11.1 Authorization
Repair welding shall be authorized only by the operator's qualified engineer.

11.2 Acceptable Repair Methods
- Grinding or chipping for surface defects accessible from OD (limited to removing ≤ 33% WT)
- Weld deposition for through-wall or deep-body defects after excavation

11.3 Repair WPS Requirements
A separate repair WPS is required. Requalification tests must include the same defect type being repaired.

11.4 Re-inspection After Repair
Full-weld radiographic or UT re-inspection is required after each repair cycle.
Maximum 2 repair attempts; after second failure, cut out and replace the weld.`,
    },
  ];

  return {
    id: 'API_1104_2021',
    filename: 'API-1104-2021',
    org: 'API',
    discipline: 'welding',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'API Standard 1104 — Welding of Pipelines and Related Facilities, 22nd Ed 2021'),
  };
}

// ── STANDARD 5: NACE MR0175 — Sulfide Stress Cracking Resistant Materials ───

function buildNACEMR0175(): SyntheticStandard {
  const sections = [
    {
      heading: 'NACE MR0175 / ISO 15156 — Petroleum and Natural Gas Industries — Materials for Use in H2S-Containing Environments, 2015',
      level: 1, path: [], page: 1,
      content: `This standard gives requirements and recommendations for the selection and qualification of metallic
materials for service in equipment used in oil and gas production and in natural gas treatment plants
in H2S-containing environments, the failure of which could pose a risk to the health and safety of
the public and personnel, or to the environment.

This standard is identical to ISO 15156 Parts 1, 2, and 3. It is widely referenced as NACE MR0175.
Applicable environments: H2S partial pressure ≥ 0.05 psia (0.0003 MPa) in any wet environment.`,
    },
    {
      heading: '4 Fundamental Requirements for SSC Resistance',
      level: 1, path: ['4'], page: 5,
      content: `4.1 Sulfide Stress Cracking (SSC) Mechanism
SSC occurs when susceptible metallic materials are exposed to wet H2S environments under tensile stress.
The combination of: (a) susceptible material, (b) tensile stress ≥ threshold, and (c) H2S in aqueous
solution creates conditions for hydrogen embrittlement and cracking.

4.2 Environmental Limits for Applicability (Region 0/1/2/3)
Region 0 (no SSC risk): pH ≥ 3.5 AND partial pressure H2S < 0.05 psia
Region 1 (mild): pH 3.5–5.5 with H2S 0.05–0.5 psia
Region 2 (moderate): pH 3.5–5.0 with higher H2S, or lower pH
Region 3 (severe): pH < 3.5, any H2S; or H2S > 15 psia

4.3 Carbon Steel Requirements (MR0175/ISO 15156-2)
Acceptable carbon steels shall meet:
- Hardness ≤ 22 HRC (250 HBW) on base metal and HAZ
- Yield strength ≤ 90 ksi (620 MPa) for SMYS-governed pipelines
- CEIIW ≤ 0.42 for pipe steels per ISO 3183 / API 5L`,
    },
    {
      heading: '7 Carbon and Low-Alloy Steels (Part 2)',
      level: 1, path: ['7'], page: 12,
      content: `7.1 General
Carbon and low-alloy steels are acceptable when they satisfy the hardness and strength limits.

7.2 Hardness Limits
Hardness limits apply to base metal, welds, and heat-affected zones (HAZ):
Maximum 22 HRC (Rockwell C) = 250 HBW = 265 HV (Vickers 10 kg)
Measurement locations: base metal (remote from weld), weld metal centerline, HAZ (2 mm from fusion line)

7.3 Carbon Steel Pipe for Sour Service
API 5L pipe acceptable in sour service (per 7.3) if:
- Grade ≤ X65 for PSL 1; ≤ X52 for PSL 2 cold-formed pipe
- Post-weld heat treatment (PWHT) required for wall thickness > 1.0 in. (25.4 mm)
- Hardness tested per ASTM E18 or ASTM E10

7.4 Line Pipe Welds in H2S Service
Girth welds on sour service pipelines must be qualified using an H2S-containing solution:
- 5% NaCl + 0.5% acetic acid (NACE TM0177 Solution A) or
- 0.5% acetic acid only (NACE TM0177 Solution B)
Test duration: 720 hours at ambient temperature, tensile load = 90% SMYS.`,
    },
    {
      heading: '8 Stainless Steels and Nickel Alloys (Part 3)',
      level: 1, path: ['8'], page: 20,
      content: `8.1 Austenitic Stainless Steels
Type 316L acceptable for moderate sour service (Region 1/2) without restrictions on hardness.
Not acceptable in Region 3 (chloride stress corrosion cracking risk).

8.2 Duplex Stainless Steels
22%Cr duplex (UNS S31803, S32205) acceptable for Region 1/2 with PREN ≥ 33.
25%Cr superduplex (UNS S32750) acceptable for all regions with PREN ≥ 40.

8.3 Corrosion-Resistant Alloys (CRA)
Alloy 625 (UNS N06625), Alloy 825 (UNS N08825), and Alloy C-276 (UNS N10276) are
acceptable for severe sour environments (Region 3) with chloride levels up to saturation.`,
    },
    {
      heading: 'Annex D — Laboratory Testing of Metals for Resistance to SSC',
      level: 1, path: ['D'], page: 35,
      content: `D.1 Test Methods
NACE TM0177 standard defines laboratory methods for SSC testing:
- Method A: Tensile test (smooth specimen, 90% SMYS for 720 h)
- Method B: Bent-beam test (bent to ε = 0.2% outer fiber strain)
- Method C: C-ring test (compressive deflection)
- Method D: DCB (double cantilever beam) fracture mechanics

D.2 Test Environments per TM0177
Solution A: 5.0 wt% NaCl + 0.5 wt% glacial acetic acid, pH 2.7, H2S saturated at 1 atm
Solution B: 0.5 wt% glacial acetic acid, pH 2.7, H2S saturated at 1 atm

D.3 Acceptance Criteria
Pass: no SSC failure (cracking, fracture, or >10% load drop) after 720 h.
Borderline materials require duplicate tests; both must pass.`,
    },
  ];

  return {
    id: 'NACE_MR0175_2015',
    filename: 'NACE-MR0175-ISO15156-2015',
    org: 'NACE',
    discipline: 'corrosion',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'NACE MR0175 / ISO 15156 — Materials for H2S-Containing Environments, 2015'),
  };
}

// ── STANDARD 6: NACE SP0169 — Control of External Corrosion on Pipelines ────

function buildNACESP0169(): SyntheticStandard {
  const sections = [
    {
      heading: 'NACE SP0169 — Control of External Corrosion on Underground or Submerged Metallic Piping Systems, 2013',
      level: 1, path: [], page: 1,
      content: `This standard practice covers minimum requirements for control of external corrosion on buried or
submerged metallic piping systems. This standard applies to metallic piping systems buried in soil
or submerged in water, including pipelines, gathering systems, and distribution systems.

The two principal methods of corrosion control: (1) protective coatings and (2) cathodic protection.
ASME B31.4 Section 419 and ASME B31.8 Section 862 require compliance with NACE SP0169.`,
    },
    {
      heading: '4 Criteria for Cathodic Protection',
      level: 1, path: ['4'], page: 5,
      content: `4.1 Criteria for Steel and Cast Iron Piping
Any one of the following criteria is acceptable:

(a) Criterion 1: −0.85 V minimum pipe-to-soil potential (Cu/CuSO4 reference electrode)
    Measured with current applied ("ON" potential), with consideration of IR drop.
    IR drop correction: use instant-off measurement after current interruption.

(b) Criterion 2: −0.85 V minimum pipe-to-soil potential (instant-off, IR-free)
    Preferred criterion; eliminates soil resistance errors.

(c) Criterion 3: Minimum 100 mV cathodic polarization
    Measured as polarized potential shift from free-corrosion potential.
    Applicable where −0.85 V cannot be achieved (high-resistivity soils).

4.2 Alternative Criteria — Overprotection Limits
Maximum potential: −1.2 V (Cu/CuSO4) to avoid hydrogen evolution on high-strength steel.
For coated pipe: −1.5 V maximum to avoid coating disbondment.

4.3 Stainless Steel Criteria
Minimum −0.60 V (Cu/CuSO4) for austenitic stainless steels to prevent chloride SCC.`,
    },
    {
      heading: '5 Cathodic Protection System Design',
      level: 1, path: ['5'], page: 12,
      content: `5.1 Impressed Current Systems
Design parameters:
- Power source: rectifier or solar with current density 0.1–20 mA/ft² (1–200 mA/m²)
- Anode material: high-silicon cast iron (HSCI), platinized titanium, or mixed-metal oxide (MMO)
- Anode bed design: shallow horizontal, deep vertical, or distributed remote
- Typical current density for bare pipe in clay soil: 5–10 mA/ft²

5.2 Galvanic Anode Systems
Used where AC power unavailable or for supplemental protection.
Magnesium anodes: −1.75 V OCP, net driving voltage 0.75–0.90 V in typical soils
Zinc anodes: −1.10 V OCP, used in marine environments
Design life: 5–20 years depending on anode mass and current draw.

5.3 Current Requirements
Minimum current density for cathodic protection depends on:
- Coating quality (bare steel: 2–10 mA/ft²; FBE coated: 0.01–0.1 mA/ft²)
- Soil resistivity (higher ρ → lower current requirement)
- Temperature (current requirement increases ~3% per °C increase)
- Oxygen content (aerobic soil needs more current)`,
    },
    {
      heading: '6 External Coatings',
      level: 1, path: ['6'], page: 20,
      content: `6.1 General Coating Requirements
External coatings shall:
- Be electrically insulating (dielectric strength ≥ 100 MV/m)
- Be chemically resistant to the soil environment
- Adhere strongly to the pipe surface
- Have adequate mechanical strength (impact, gouge resistance)

6.2 Coating Types Approved for Buried Pipelines
- Fusion-bonded epoxy (FBE): primary coating for new construction
  Application temperature: 220–250°C (428–482°F)
  Minimum thickness: 300 µm (12 mils)
- Three-layer polyolefin (3LPE or 3LPP): superior mechanical protection
  FBE primer + adhesive + HDPE/PP topcoat; 2–4 mm total
- Coal tar enamel: legacy systems only; requires FBE supplement for new
- Tape wrap systems: field repairs; not preferred for new construction

6.3 Holiday Detection
All factory-applied coatings shall be holiday-detected before installation:
- FBE and 3LPE: DC spark test at 67.5 V/mil (2.66 kV/mm) of coating thickness
- Acceptable holiday rate: 0 holidays per joint on factory coating`,
    },
    {
      heading: '10 Stray Current Interference Control',
      level: 1, path: ['10'], page: 35,
      content: `10.1 Sources of Stray Currents
- DC traction systems (rail transit, mining)
- Foreign cathodic protection systems
- HVDC power transmission groundings
- Electrochemical industrial processes

10.2 Identification
Pipe-to-soil potentials showing rapid fluctuations (>100 mV peak-to-peak) indicate stray current.
Use synchronous data loggers on multiple structures during peak interference periods.

10.3 Mitigation Methods
- Bond to interfering structure through calibrated resistance bond
- Drainage anode (reverse-current switch) for dynamic stray currents
- Increase coating quality in interference zones
- Reverse current switch to prevent backflow of CP current`,
    },
  ];

  return {
    id: 'NACE_SP0169_2013',
    filename: 'NACE-SP0169-2013',
    org: 'NACE',
    discipline: 'corrosion',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'NACE SP0169 — Control of External Corrosion on Underground Metallic Piping, 2013'),
  };
}

// ── STANDARD 7: GOST 20295 — Welded Steel Pipes for Trunk Pipelines ─────────

function buildGOST20295(): SyntheticStandard {
  const sections = [
    {
      heading: 'ГОСТ 20295-85 — Трубы стальные сварные для магистральных газонефтепроводов',
      level: 1, path: [], page: 1,
      content: `Настоящий стандарт распространяется на электросварные прямошовные и спиральношовные трубы
из углеродистой и низколегированной стали для магистральных газо- и нефтепроводов,
трубопроводов нефтепродуктов и технологических трубопроводов.

Область применения: трубы диаметром от 159 до 1420 мм с рабочим давлением до 9,8 МПа.
Температура эксплуатации от −60°С до +40°С.`,
    },
    {
      heading: '1 Технические требования',
      level: 1, path: ['1'], page: 3,
      content: `1.1 Трубы должны изготавливаться в соответствии с требованиями настоящего стандарта
по технической документации, утверждённой в установленном порядке.

1.2 Классы прочности труб:
К38 — минимальный предел текучести 373 МПа (38 кгс/мм²)
К42 — минимальный предел текучести 412 МПа (42 кгс/мм²)
К48 — минимальный предел текучести 471 МПа (48 кгс/мм²)
К52 — минимальный предел текучести 510 МПа (52 кгс/мм²)
К55 — минимальный предел текучести 539 МПа (55 кгс/мм²)
К60 — минимальный предел текучести 588 МПа (60 кгс/мм²)

1.3 Механические свойства при испытании на разрыв:
К52: предел прочности не менее 530 МПа, относительное удлинение не менее 18%
К60: предел прочности не менее 608 МПа, относительное удлинение не менее 16%`,
    },
    {
      heading: '2 Размеры труб',
      level: 1, path: ['2'], page: 8,
      content: `2.1 Трубы выпускаются наружным диаметром от 159 до 1420 мм.

2.2 Толщина стенки от 4,0 до 20,0 мм (для прямошовных до диаметра 530 мм)
и от 6,0 до 28,0 мм (для труб диаметром 530–1420 мм).

2.3 Предельные отклонения по диаметру:
- Для D ≤ 530 мм: ± 2,0 мм
- Для D > 530 мм: ± 0,1% D, но не более ± 4,0 мм

2.4 Предельные отклонения по толщине стенки:
- По минусу: не более 12,5% от номинальной
- По плюсу: не ограничивается

2.5 Длина труб: мерная длина 10,5–12,5 м (для труб D 114–530 мм)
и 10,5–11,6 м (для труб D 630–1420 мм). Кратная длина по согласованию.`,
    },
    {
      heading: '3 Испытания и методы контроля',
      level: 1, path: ['3'], page: 12,
      content: `3.1 Гидравлическое испытание
Каждая труба подвергается гидравлическому испытанию давлением P (МПа):
   P = 2 × σт × t / D
где σт — нормативное значение предела текучести, t — толщина стенки, D — наружный диаметр.

Продолжительность выдержки под давлением — не менее 5 с.

3.2 Неразрушающий контроль
Автоматический ультразвуковой контроль (АУК) 100% длины шва и концов труб.
Рентгенотелевизионный контроль концов труб не менее чем на длине 200 мм.

3.3 Контроль механических свойств
- По одному испытанию на растяжение из трубы каждой плавки
- Испытание на ударный изгиб при −20°С (для К52 и выше): KCU ≥ 30 Дж/см²
- Испытание на твёрдость по Бринеллю (HBW): не более 220 для всех классов`,
    },
  ];

  return {
    id: 'GOST_20295_1985',
    filename: 'ГОСТ-20295-85',
    org: 'ГОСТ',
    discipline: 'pipeline',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'ГОСТ 20295-85 — Трубы стальные сварные для магистральных газонефтепроводов'),
  };
}

// ── STANDARD 8: ST RK ISO 3183 — Petroleum and Natural Gas Pipeline Pipe ────

function buildSTRKISO3183(): SyntheticStandard {
  const sections = [
    {
      heading: 'СТ РК ISO 3183:2014 — Нефтяная и газовая промышленность. Трубы стальные для трубопроводных систем',
      level: 1, path: [], page: 1,
      content: `Настоящий стандарт является идентичным переводом международного стандарта ISO 3183:2012
«Нефтяная и газовая промышленность. Трубы стальные для трубопроводных систем».

Область применения: устанавливает требования к неразъёмным и сварным стальным трубам
для использования в трубопроводных транспортных системах нефтяной и газовой промышленности.

Классы качества PSL 1 и PSL 2 аналогичны API 5L. Настоящий стандарт гармонизирован с API 5L.`,
    },
    {
      heading: '7 Механические свойства',
      level: 1, path: ['7'], page: 10,
      content: `7.1 Общие требования
Трубы должны соответствовать требованиям к механическим свойствам, указанным в таблицах 4 и 5.

7.2 Требования к пределу текучести (Таблица 4, PSL 1):
Класс прочности L360 (≈ X52): SMYS ≥ 360 МПа, SMTS ≥ 460 МПа
Класс прочности L450 (≈ X65): SMYS ≥ 450 МПа, SMTS ≥ 535 МПа
Класс прочности L555 (≈ X80): SMYS ≥ 555 МПа, SMTS ≥ 625 МПа

7.3 Ударная вязкость (PSL 2)
Испытание на ударный изгиб по Шарпи при температуре испытания T (°C):
Минимальная работа удара при полноразмерном образце: 40 Дж (поперечный)
Для труб DN ≥ 200 (NPS ≥ 8): обязательно при Т ≤ 0°C

7.4 Расчёт минимальной толщины стенки (раздел 7.3):
t_min = P × OD / (2 × SMYS × F × E) + corrosion_allowance
F — коэффициент безопасности по СП 36.13330 (Казахстан: дополнительно П-ВК-001)`,
    },
  ];

  return {
    id: 'ST_RK_ISO_3183_2014',
    filename: 'СТ-РК-ISO-3183-2014',
    org: 'СТ РК',
    discipline: 'pipeline',
    corpus_type: 'normative',
    doc: buildDoc(sections, 'СТ РК ISO 3183:2014 — Трубы стальные для трубопроводных систем'),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildSyntheticCorpus(): SyntheticStandard[] {
  return [
    buildAPI5L(),
    buildASMEB314(),
    buildASMEB318(),
    buildAPI1104(),
    buildNACEMR0175(),
    buildNACESP0169(),
    buildGOST20295(),
    buildSTRKISO3183(),
  ];
}

export const CORPUS_INVENTORY = [
  { id: 'API_5L_2018',        priority: 1, org: 'API',    discipline: 'pipeline',  title: 'API 5L — Specification for Line Pipe (46th Ed., 2018)' },
  { id: 'ASME_B31.4_2019',    priority: 1, org: 'ASME',   discipline: 'pipeline',  title: 'ASME B31.4 — Pipeline Transportation Systems for Liquids (2019)' },
  { id: 'ASME_B31.8_2020',    priority: 1, org: 'ASME',   discipline: 'pipeline',  title: 'ASME B31.8 — Gas Transmission and Distribution Piping (2020)' },
  { id: 'API_1104_2021',      priority: 1, org: 'API',    discipline: 'welding',   title: 'API 1104 — Welding of Pipelines (22nd Ed., 2021)' },
  { id: 'NACE_MR0175_2015',   priority: 1, org: 'NACE',   discipline: 'corrosion', title: 'NACE MR0175 / ISO 15156 — Materials for H2S Environments (2015)' },
  { id: 'NACE_SP0169_2013',   priority: 1, org: 'NACE',   discipline: 'corrosion', title: 'NACE SP0169 — Control of External Corrosion on Underground Pipelines (2013)' },
  { id: 'GOST_20295_1985',    priority: 2, org: 'ГОСТ',   discipline: 'pipeline',  title: 'ГОСТ 20295-85 — Трубы сварные для магистральных газонефтепроводов' },
  { id: 'ST_RK_ISO_3183_2014',priority: 2, org: 'СТ РК',  discipline: 'pipeline',  title: 'СТ РК ISO 3183:2014 — Трубы стальные для трубопроводных систем' },
];
