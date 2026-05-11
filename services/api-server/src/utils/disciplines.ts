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
  '—':     'general',
};

export function mapDiscipline(ruDisc: string | null): string | null {
  if (!ruDisc) return null;
  return RU_TO_EN[ruDisc] ?? 'general';
}
