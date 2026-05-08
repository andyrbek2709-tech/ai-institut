/**
 * Multilingual heading scorer — pure function, no external dependencies.
 * Used by pdf-parser and independently testable.
 *
 * Scoring model:
 *   ≥ 40   → treat as heading
 *   0-39   → treat as body text
 *
 * Factors: numbered pattern, keyword (Latin/Cyrillic), line length, uppercase ratio.
 */

const NUMBERED_PATTERN  = /^(\d+(?:\.\d+){0,3})\.?\s+\S/;
const LATIN_KEYWORD_PAT = /^(SECTION|CHAPTER|APPENDIX|ANNEX|PART)\s+[\dA-Z]/i;
const CYR_KEYWORD_PAT   = /^(Раздел|Подраздел|Часть|Приложение|Отдел|Глава|Пункт)\s+[\dА-ЯЁA-Z]/;

export const HEADING_MIN_SCORE = 40;

export interface HeadingScore {
  text:       string;
  score:      number;      // 0–100
  confidence: number;      // 0.0–1.0
  level:      number;      // 1 | 2 | 3
  type:       'numbered' | 'keyword_latin' | 'keyword_cyrillic' | 'uppercase' | 'paragraph';
}

export function scoreHeading(line: string): HeadingScore {
  const text = line.trim();
  let score  = 0;
  let type: HeadingScore['type'] = 'paragraph';
  let level  = 1;

  if (!text || text.length < 2)  return { text, score: 0, confidence: 0, level: 0, type: 'paragraph' };
  if (text.length > 200)         return { text, score: 0, confidence: 0, level: 0, type: 'paragraph' };

  if (text.length < 80)  score += 15;
  if (text.length < 40)  score += 10;
  if (text.length > 120) score -= 20;

  if (/[,;]$/.test(text))                     score -= 20;
  if (/\.$/.test(text) && text.length > 60)   score -= 10;

  const numMatch = NUMBERED_PATTERN.exec(text);
  if (numMatch) {
    score += 60;
    type   = 'numbered';
    level  = numMatch[1].split('.').length;
  }

  if (LATIN_KEYWORD_PAT.test(text)) {
    score += 50;
    type   = 'keyword_latin';
    level  = 1;
  }

  const cyrMatch = CYR_KEYWORD_PAT.exec(text);
  if (cyrMatch) {
    score += 50;
    type   = 'keyword_cyrillic';
    const kw = cyrMatch[1].toLowerCase();
    level  = (kw === 'подраздел' || kw === 'пункт') ? 2 : 1;
  }

  const letters = text.replace(/[^A-Za-zА-ЯЁа-яё]/g, '');
  if (letters.length >= 4) {
    const upperCount = text.replace(/[^A-ZА-ЯЁ]/g, '').length;
    const upperRatio = upperCount / letters.length;
    if (upperRatio > 0.8) {
      score += 20;
      if (type === 'paragraph') type = 'uppercase';
    }
    if (upperRatio === 1.0 && letters.length >= 5) score += 10;
  }

  if (text.length < 80 && !/[.!?]/.test(text)) score += 8;

  const confidence = Math.max(0, Math.min(1, score / 100));
  return { text, score, confidence, level, type };
}
