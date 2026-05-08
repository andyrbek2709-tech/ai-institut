/**
 * Parser unit tests
 * - P0.1: Y-position line reconstruction behaviour
 * - P0.2: Multilingual heading scoring (Latin + Cyrillic)
 */

import { scoreHeading } from '../src/utils/heading-scorer.js';

// ── P0.2: Heading scorer ───────────────────────────────────────────────────

describe('scoreHeading — numbered patterns', () => {
  test('recognises top-level numbered heading', () => {
    const h = scoreHeading('3. General Requirements');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('numbered');
    expect(h.level).toBe(1);
  });

  test('recognises second-level numbered heading', () => {
    const h = scoreHeading('3.4 Wall Thickness');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.level).toBe(2);
  });

  test('recognises third-level numbered heading', () => {
    const h = scoreHeading('3.4.2. Design Conditions');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.level).toBe(3);
  });
});

describe('scoreHeading — Latin keywords', () => {
  test('SECTION heading', () => {
    const h = scoreHeading('SECTION 5 MATERIAL REQUIREMENTS');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_latin');
  });

  test('APPENDIX heading', () => {
    const h = scoreHeading('APPENDIX A Pressure Testing');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_latin');
  });

  test('ANNEX heading', () => {
    const h = scoreHeading('ANNEX B Inspection Criteria');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_latin');
  });

  test('CHAPTER heading', () => {
    const h = scoreHeading('CHAPTER 2 Scope of Application');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_latin');
  });
});

describe('scoreHeading — Cyrillic keywords', () => {
  test('Раздел heading', () => {
    const h = scoreHeading('Раздел 3 Требования к материалам');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
    expect(h.level).toBe(1);
  });

  test('Подраздел heading (level 2)', () => {
    const h = scoreHeading('Подраздел 3.1 Трубы стальные');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
    expect(h.level).toBe(2);
  });

  test('Приложение heading', () => {
    const h = scoreHeading('Приложение А Методы испытаний');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
  });

  test('Часть heading', () => {
    const h = scoreHeading('Часть 1 Общие положения');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
  });

  test('Глава heading', () => {
    const h = scoreHeading('Глава 2 Технические требования');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
  });

  test('Отдел heading', () => {
    const h = scoreHeading('Отдел 5 Контроль качества');
    expect(h.score).toBeGreaterThanOrEqual(40);
    expect(h.type).toBe('keyword_cyrillic');
  });
});

describe('scoreHeading — rejects paragraph text', () => {
  test('long paragraph line is not a heading', () => {
    const h = scoreHeading('Настоящий стандарт распространяется на стальные трубы и соединительные детали трубопроводов, применяемых в нефтяной и газовой промышленности для транспортирования нефти и газа.');
    expect(h.score).toBeLessThan(40);
  });

  test('sentence ending with comma is not a heading', () => {
    const h = scoreHeading('Трубы, применяемые в данном стандарте,');
    expect(h.score).toBeLessThan(40);
  });

  test('short but ambiguous word is handled without crash', () => {
    expect(() => scoreHeading('Hi')).not.toThrow();
  });

  test('empty string returns zero score', () => {
    const h = scoreHeading('');
    expect(h.score).toBe(0);
    expect(h.confidence).toBe(0);
  });
});

describe('scoreHeading — confidence field', () => {
  test('numbered heading has high confidence', () => {
    const h = scoreHeading('1. Introduction');
    expect(h.confidence).toBeGreaterThan(0.6);
  });

  test('confidence is between 0 and 1', () => {
    const cases = [
      '3.4.2. Requirements',
      'SECTION 5',
      'Раздел 3',
      'Some normal sentence text here.',
    ];
    for (const c of cases) {
      const h = scoreHeading(c);
      expect(h.confidence).toBeGreaterThanOrEqual(0);
      expect(h.confidence).toBeLessThanOrEqual(1);
    }
  });
});
