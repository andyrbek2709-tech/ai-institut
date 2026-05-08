/**
 * Metadata extractor — derives standard_code, version, discipline, etc.
 * from document content and filename. All heuristic.
 *
 * Week 3 additions (M1/M2):
 *   M1 — Kazakh (СТ РК), Russian (ГОСТ Р, СП, СНиП, РД, ВРД, ТУ) standard patterns
 *   M2 — Cyrillic technical keyword extraction
 */

export interface ExtractedMetadata {
  standard_code: string;
  title:         string;
  version?:      string;
  year?:         number;
  discipline?:   string;
  organization?: string;
  keywords:      string[];
}

// Known standards patterns: [regex, organization, discipline]
const STANDARD_PATTERNS: Array<[RegExp, string, string]> = [
  // ── International / US ────────────────────────────────────────────────
  [/API\s*5L/i,                     'API',    'pipeline'],
  [/API\s*1104/i,                   'API',    'welding'],
  [/ASME\s*B31\.4/i,                'ASME',   'pipeline'],
  [/ASME\s*B31\.8/i,                'ASME',   'pipeline'],
  [/ASME\s*B31\.3/i,                'ASME',   'pipeline'],
  [/ASME\s*Section\s*V/i,           'ASME',   'mechanical'],
  [/ASME\s*Section\s*VIII/i,        'ASME',   'mechanical'],
  [/ASME\s*Section\s*IX/i,          'ASME',   'welding'],
  [/ISO\s*1219/i,                   'ISO',    'mechanical'],
  [/ISO\s*3183/i,                   'ISO',    'pipeline'],
  [/NACE\s*MR0175/i,                'NACE',   'corrosion'],
  [/NACE\s*RP0169/i,                'NACE',   'corrosion'],
  [/NACE\s*SP0208/i,                'NACE',   'corrosion'],
  [/NACE\s*SP0294/i,                'NACE',   'corrosion'],
  [/AWS\s*D1\.1/i,                  'AWS',    'welding'],
  [/ACI\s*318/i,                    'ACI',    'structural'],
  [/AISC\s*360/i,                   'AISC',   'structural'],
  [/DNV[\s-]*(?:GL)?/i,             'DNV',    'structural'],
  [/BS\s*7910/i,                    'BSI',    'structural'],
  [/OSHA/i,                         'OSHA',   'general'],
  [/IEC\s*\d+/i,                    'IEC',    'electrical'],
  [/IEEE\s*\d+/i,                   'IEEE',   'electrical'],
  [/NFPA\s*\d+/i,                   'NFPA',   'fire_safety'],

  // ── M1: Kazakh national standards ─────────────────────────────────────
  [/СТ\s*РК\s*(?:ISO|ИСО|EN|IEC|МЭК)?\s*[\d\-]+/i,  'СТ РК', 'general'],
  [/ГОСТ\s*Р\s*(?:ИСО|ISO|МЭК|IEC|EN|ASTM)?\s*[\d\-]+/i, 'ГОСТ Р', 'general'],

  // ── M1: Russian / CIS standards ───────────────────────────────────────
  [/ГОСТ\s+[\d\-]+/i,               'ГОСТ',   'general'],
  [/СП\s+\d+\.\d+/i,                'Минстрой', 'construction'],
  [/СНиП\s+[\d\-\.]+/i,             'Госстрой', 'construction'],
  [/СН\s+\d+/i,                     'Госстрой', 'construction'],
  [/РД\s+[\d\-\.]+/i,               'РД',     'general'],
  [/ВРД\s+[\d\-\.]+/i,              'ВРД',    'pipeline'],
  [/ТУ\s+[\d\-\.]+/i,               'ТУ',     'general'],
  [/ПБ\s+\d+/i,                     'Ростехнадзор', 'general'],
  [/ОСТ\s+\d+/i,                    'ОСТ',    'general'],
];

const YEAR_REGEX    = /\b(19[89]\d|20[0-3]\d)\b/;
const VERSION_REGEX = /(?:Edition|Rev\.?|Version|Ed\.)\s*([A-Z0-9.]+)|(\d{4})\s*Edition/i;

// M2: Cyrillic technical term patterns (capitalized or all-caps Cyrillic nouns)
const CYR_TERM_REGEX = /\b([А-ЯЁ][а-яёА-ЯЁ]{3,}(?:-[А-ЯЁа-яё]+)?)\b/g;
const CYR_STOP_WORDS = new Set([
  'Данный', 'Данная', 'Данное', 'Этот', 'Этому', 'Этого', 'Этой',
  'Который', 'Которая', 'Которое', 'Которые', 'Всего', 'Также',
  'Должен', 'Должна', 'Должно', 'Должны', 'Может', 'Могут',
  'Между', 'После', 'Перед', 'Через', 'Более', 'Менее',
]);

function detectFromText(text: string): Partial<ExtractedMetadata> {
  const result: Partial<ExtractedMetadata> = {};
  const sample = text.slice(0, 3000); // first 3000 chars (extended from 2000 for CIS docs)

  for (const [pattern, org, discipline] of STANDARD_PATTERNS) {
    if (pattern.test(sample)) {
      result.organization = org;
      result.discipline   = discipline;
      const m = pattern.exec(sample);
      if (m) result.standard_code = m[0].replace(/\s+/g, ' ').toUpperCase().trim();
      break;
    }
  }

  const yearMatch = YEAR_REGEX.exec(sample);
  if (yearMatch) result.year = parseInt(yearMatch[1], 10);

  const verMatch = VERSION_REGEX.exec(sample);
  if (verMatch) result.version = (verMatch[1] || verMatch[2]).trim();

  return result;
}

function extractKeywords(text: string): string[] {
  const sample   = text.slice(0, 5000);
  const keywords = new Set<string>();

  // Latin capitalised technical terms
  const latinRegex = /\b[A-Z][A-Za-z-]{3,}\b/g;
  const latinStop  = new Set(['This', 'That', 'With', 'From', 'Have', 'When', 'Where', 'Which']);
  let m: RegExpExecArray | null;
  while ((m = latinRegex.exec(sample)) !== null) {
    if (!latinStop.has(m[0])) keywords.add(m[0]);
    if (keywords.size >= 20) break;
  }

  // M2: Cyrillic technical terms
  const cyrSample = text.slice(0, 8000);
  CYR_TERM_REGEX.lastIndex = 0;
  while ((m = CYR_TERM_REGEX.exec(cyrSample)) !== null) {
    const term = m[1];
    if (!CYR_STOP_WORDS.has(term) && term.length >= 4) {
      keywords.add(term);
    }
    if (keywords.size >= 40) break;
  }

  return [...keywords].slice(0, 30);
}

export function extractMetadata(
  text: string,
  filename: string,
  pdfMeta: { title?: string; subject?: string } = {},
): ExtractedMetadata {
  const fromText  = detectFromText(text);
  const keywords  = extractKeywords(text);

  const firstLine = text.split('\n').find(l => l.trim().length > 10)?.trim() ?? filename;
  const title     = pdfMeta.title || firstLine.slice(0, 200);

  const codeFromFile  = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').toUpperCase();
  const standard_code = fromText.standard_code || codeFromFile;

  return {
    standard_code,
    title,
    version:      fromText.version,
    year:         fromText.year,
    discipline:   fromText.discipline as ExtractedMetadata['discipline'],
    organization: fromText.organization,
    keywords,
  };
}
