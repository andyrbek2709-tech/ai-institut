/**
 * Маппинг дисциплин: RU (assignment_sections.discipline) -> EN (agsk_standards.discipline).
 *
 * RU-коды берутся из parseSections() в routes/assignment.ts (10 категорий ТЗ).
 * EN-коды — из agsk_standards CHECK constraint (миграция 021):
 *   pipeline | structural | mechanical | electrical | welding | corrosion | fire_safety | general
 */

export const RU_TO_EN: Record<string, string> = {
  'ЭС':    'electrical',
  'КИПиА': 'electrical',
  'КР':    'structural',
  'ПБ':    'fire_safety',
  'АКЗ':   'corrosion',
  'ПОС':   'general',
  'ООС':   'general',
  'Смета': 'general',
  'ПромБ': 'general',
  'ОПД':   'general',
};

export const RU_TITLES: Record<string, string> = {
  'ЭС':    'Электроснабжение',
  'КИПиА': 'КИПиА',
  'КР':    'Конструктивные решения',
  'ПБ':    'Пожарная безопасность',
  'АКЗ':   'Антикоррозийная защита',
  'ПОС':   'Организация строительства',
  'ООС':   'Охрана окружающей среды',
  'Смета': 'Сметная документация',
  'ПромБ': 'Промышленная безопасность',
  'ОПД':   'Опасные производственные объекты',
};

export function mapDiscipline(ru: string | null | undefined): string | null {
  if (!ru) return null;
  return RU_TO_EN[ru] ?? null;
}

export function disciplineTitle(ru: string | null | undefined): string {
  if (!ru) return 'Общие / без дисциплины';
  return RU_TITLES[ru] ?? ru;
}
