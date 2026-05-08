/**
 * Metadata extractor — derives standard_code, version, discipline, etc.
 * from document content and filename. All heuristic.
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
  [/API\s*5L/i,                    'API',   'pipeline'],
  [/API\s*1104/i,                  'API',   'welding'],
  [/ASME\s*B31\.4/i,               'ASME',  'pipeline'],
  [/ASME\s*B31\.8/i,               'ASME',  'pipeline'],
  [/ASME\s*B31\.3/i,               'ASME',  'pipeline'],
  [/ASME\s*Section\s*V/i,          'ASME',  'mechanical'],
  [/ASME\s*Section\s*VIII/i,       'ASME',  'mechanical'],
  [/ASME\s*Section\s*IX/i,         'ASME',  'welding'],
  [/ISO\s*1219/i,                  'ISO',   'mechanical'],
  [/ISO\s*3183/i,                  'ISO',   'pipeline'],
  [/NACE\s*MR0175/i,               'NACE',  'corrosion'],
  [/NACE\s*RP0169/i,               'NACE',  'corrosion'],
  [/NACE\s*SP0208/i,               'NACE',  'corrosion'],
  [/NACE\s*SP0294/i,               'NACE',  'corrosion'],
  [/AWS\s*D1\.1/i,                 'AWS',   'welding'],
  [/ACI\s*318/i,                   'ACI',   'structural'],
  [/AISC\s*360/i,                  'AISC',  'structural'],
  [/DNV[\s-]*(?:GL)?/i,            'DNV',   'structural'],
  [/BS\s*7910/i,                   'BSI',   'structural'],
  [/OSHA/i,                        'OSHA',  'general'],
  [/GOST\s*\d+/i,                  'GOST',  'general'],
  [/IEC\s*\d+/i,                   'IEC',   'electrical'],
  [/IEEEs?\s*\d+/i,                'IEEE',  'electrical'],
  [/NFPA\s*\d+/i,                  'NFPA',  'fire_safety'],
];

const YEAR_REGEX    = /\b(19[89]\d|20[0-3]\d)\b/;
const VERSION_REGEX = /(?:Edition|Rev\.?|Version|Ed\.)\s*([A-Z0-9.]+)|(\d{4})\s*Edition/i;

function detectFromText(text: string): Partial<ExtractedMetadata> {
  const result: Partial<ExtractedMetadata> = {};
  const sample = text.slice(0, 2000);  // only look in first 2000 chars

  for (const [pattern, org, discipline] of STANDARD_PATTERNS) {
    if (pattern.test(sample)) {
      result.organization = org;
      result.discipline   = discipline;
      // Extract the matched code
      const m = pattern.exec(sample);
      if (m) result.standard_code = m[0].replace(/\s+/g, ' ').toUpperCase();
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
  const sample = text.slice(0, 5000);
  const keywords = new Set<string>();

  // Extract capitalised technical terms (likely standard references / technical nouns)
  const termRegex = /\b[A-Z][A-Za-z-]{3,}\b/g;
  let m: RegExpExecArray | null;
  while ((m = termRegex.exec(sample)) !== null) {
    const term = m[0];
    // Skip common stop words
    if (!['This', 'That', 'With', 'From', 'Have', 'When', 'Where', 'Which'].includes(term)) {
      keywords.add(term);
    }
    if (keywords.size >= 30) break;
  }

  return [...keywords].slice(0, 20);
}

export function extractMetadata(
  text: string,
  filename: string,
  pdfMeta: { title?: string; subject?: string } = {},
): ExtractedMetadata {
  const fromText  = detectFromText(text);
  const keywords  = extractKeywords(text);

  // Derive title: prefer PDF meta, then first non-empty line of text
  const firstLine = text.split('\n').find(l => l.trim().length > 10)?.trim() ?? filename;
  const title     = pdfMeta.title || firstLine.slice(0, 200);

  // Derive standard_code: prefer detected from text, else from filename
  const codeFromFile = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').toUpperCase();
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
