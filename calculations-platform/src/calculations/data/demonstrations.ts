export interface CalculationInput {
  label: string;
  unit: string;
  defaultValue: number;
}

export interface CalculationOutput {
  label: string;
  unit: string;
  formula?: (inputs: Record<string, number>) => number;
}

export interface DemoCalculation {
  id: string;
  name: string;
  description: string;
  category: string;
  inputs: CalculationInput[];
  outputs: CalculationOutput[];
  formula?: string;
  methodology?: string;
}

export const CALCULATION_CATEGORIES = [
  { id: 'thermal', name: '🔥 Тепловые расчёты' },
  { id: 'structural', name: '🏗️ Конструкционные расчёты' },
  { id: 'electrical', name: '⚡ Электротехнические расчёты' },
  { id: 'hydraulic', name: '💧 Гидравлические расчёты' },
  { id: 'acoustic', name: '🔊 Акустические расчёты' },
  { id: 'ventilation', name: '💨 Вентиляция и кондиционирование' },
];

export const DEMO_CALCULATIONS: DemoCalculation[] = [
  {
    id: 'thermal-load',
    name: 'Тепловая нагрузка здания',
    description: 'Расчёт годовой тепловой нагрузки на отопление по методике СНиП',
    category: 'thermal',
    inputs: [
      { label: 'Площадь здания', unit: 'м²', defaultValue: 1000 },
      { label: 'Разность температур', unit: '°С', defaultValue: 40 },
      { label: 'Коэффициент теплопередачи', unit: 'Вт/(м²·К)', defaultValue: 0.5 },
      { label: 'Кратность воздухообмена', unit: 'ч⁻¹', defaultValue: 0.5 },
    ],
    outputs: [
      {
        label: 'Тепловая нагрузка отопления',
        unit: 'кВт',
        formula: (inputs) => (inputs['Площадь здания'] * inputs['Разность температур'] * inputs['Коэффициент теплопередачи']) / 1000,
      },
      {
        label: 'Тепловая нагрузка вентиляции',
        unit: 'кВт',
        formula: (inputs) =>
          (inputs['Площадь здания'] * inputs['Разность температур'] * inputs['Кратность воздухообмена'] * 0.34) / 1000,
      },
    ],
    formula: 'Q = A × ΔT × U + A × ΔT × n × 0.34',
    methodology: 'Расчёт по методике СНиП 23-101-2004 «Тепловая защита зданий»',
  },
  {
    id: 'structural-beam',
    name: 'Прогиб балки',
    description: 'Расчёт максимального прогиба стальной балки при равномерной нагрузке',
    category: 'structural',
    inputs: [
      { label: 'Длина пролёта', unit: 'м', defaultValue: 6 },
      { label: 'Распределённая нагрузка', unit: 'кН/м', defaultValue: 10 },
      { label: 'Момент инерции', unit: 'см⁴', defaultValue: 5000 },
      { label: 'Модуль Юнга', unit: 'ГПа', defaultValue: 200 },
    ],
    outputs: [
      {
        label: 'Максимальный прогиб',
        unit: 'см',
        formula: (inputs) =>
          (5 * inputs['Распределённая нагрузка'] * Math.pow(inputs['Длина пролёта'], 4)) /
          (384 * inputs['Модуль Юнга'] * 1000 * inputs['Момент инерции']) *
          100,
      },
      {
        label: 'Относительный прогиб',
        unit: '1/x',
        formula: (inputs) => {
          const deflection =
            (5 * inputs['Распределённая нагрузка'] * Math.pow(inputs['Длина пролёта'], 4)) /
            (384 * inputs['Модуль Юнга'] * 1000 * inputs['Момент инерции']) *
            100;
          return Math.round((inputs['Длина пролёта'] * 100) / deflection);
        },
      },
    ],
    formula: 'f = 5qL⁴ / 384EI',
    methodology: 'Расчёт по теории упругости для шарнирно опёртой балки',
  },
  {
    id: 'electrical-cable',
    name: 'Расчёт сечения кабеля',
    description: 'Определение необходимого сечения кабеля по допустимому нагреву',
    category: 'electrical',
    inputs: [
      { label: 'Активная мощность', unit: 'кВт', defaultValue: 10 },
      { label: 'Напряжение', unit: 'В', defaultValue: 380 },
      { label: 'Коэффициент мощности', unit: 'cos φ', defaultValue: 0.95 },
      { label: 'Допустимая плотность тока', unit: 'А/мм²', defaultValue: 4 },
    ],
    outputs: [
      {
        label: 'Ток в кабеле',
        unit: 'А',
        formula: (inputs) => (inputs['Активная мощность'] * 1000) / (inputs['Напряжение'] * inputs['Коэффициент мощности'] * Math.sqrt(3)),
      },
      {
        label: 'Сечение кабеля',
        unit: 'мм²',
        formula: (inputs) => {
          const current = (inputs['Активная мощность'] * 1000) / (inputs['Напряжение'] * inputs['Коэффициент мощности'] * Math.sqrt(3));
          return current / inputs['Допустимая плотность тока'];
        },
      },
    ],
    formula: 'S = I / J, где I = P / (U × cos φ × √3)',
    methodology: 'Расчёт по методике ПУЭ (Правила устройства электроустановок)',
  },
  {
    id: 'hydraulic-pressure',
    name: 'Гидравлические потери в трубопроводе',
    description: 'Расчёт потерь давления в трубопроводе для водоснабжения',
    category: 'hydraulic',
    inputs: [
      { label: 'Расход жидкости', unit: 'м³/ч', defaultValue: 20 },
      { label: 'Диаметр трубопровода', unit: 'мм', defaultValue: 50 },
      { label: 'Длина трубопровода', unit: 'м', defaultValue: 100 },
      { label: 'Коэффициент шероховатости', unit: '-', defaultValue: 0.05 },
    ],
    outputs: [
      {
        label: 'Скорость потока',
        unit: 'м/с',
        formula: (inputs) => (inputs['Расход жидкости'] / 3600) / (Math.PI * Math.pow(inputs['Диаметр трубопровода'] / 1000 / 2, 2)),
      },
      {
        label: 'Потери давления',
        unit: 'кПа',
        formula: (inputs) => {
          const velocity = (inputs['Расход жидкости'] / 3600) / (Math.PI * Math.pow(inputs['Диаметр трубопровода'] / 1000 / 2, 2));
          return (inputs['Коэффициент шероховатости'] * inputs['Длина трубопровода'] * (velocity * velocity)) / (inputs['Диаметр трубопровода'] / 1000) * 500;
        },
      },
    ],
    formula: 'ΔP = λ × (L/d) × (ρv²/2)',
    methodology: 'Расчёт по формуле Дарси-Вейсбаха для турбулентного течения',
  },
  {
    id: 'acoustic-insulation',
    name: 'Индекс звукоизоляции конструкции',
    description: 'Оценка звукоизолирующей способности строительной конструкции',
    category: 'acoustic',
    inputs: [
      { label: 'Частота звука', unit: 'Гц', defaultValue: 1000 },
      { label: 'Толщина конструкции', unit: 'см', defaultValue: 15 },
      { label: 'Плотность материала', unit: 'кг/м³', defaultValue: 2400 },
      { label: 'Модуль упругости', unit: 'ГПа', defaultValue: 30 },
    ],
    outputs: [
      {
        label: 'Критическая частота',
        unit: 'Гц',
        formula: (inputs) => (340 * 340) / (1.9 * Math.PI * inputs['Толщина конструкции'] / 100 * Math.sqrt(inputs['Модуль упругости'] * 1000 / inputs['Плотность материала'])),
      },
      {
        label: 'Индекс звукоизоляции',
        unit: 'дБ',
        formula: (inputs) => {
          const criticalFreq = (340 * 340) / (1.9 * Math.PI * inputs['Толщина конструкции'] / 100 * Math.sqrt(inputs['Модуль упругости'] * 1000 / inputs['Плотность материала']));
          const Rw = 20 * Math.log10(inputs['Частота звука'] * inputs['Толщина конструкции'] * inputs['Плотность материала'] / 1000) - 42;
          return Rw;
        },
      },
    ],
    formula: 'Rw = 20 lg(f × d × ρ / 1000) - 42',
    methodology: 'Расчёт по методике ISO 717-1 для взвешенного индекса звукоизоляции',
  },
  {
    id: 'ventilation-flow',
    name: 'Расчёт воздухообмена в помещении',
    description: 'Определение требуемого расхода воздуха для вентиляции',
    category: 'ventilation',
    inputs: [
      { label: 'Объём помещения', unit: 'м³', defaultValue: 300 },
      { label: 'Кратность воздухообмена', unit: 'ч⁻¹', defaultValue: 3 },
      { label: 'Число людей', unit: 'чел', defaultValue: 10 },
      { label: 'Норма воздуха на человека', unit: 'м³/ч', defaultValue: 30 },
    ],
    outputs: [
      {
        label: 'Воздухообмен по объёму',
        unit: 'м³/ч',
        formula: (inputs) => inputs['Объём помещения'] * inputs['Кратность воздухообмена'],
      },
      {
        label: 'Воздухообмен по числу людей',
        unit: 'м³/ч',
        formula: (inputs) => inputs['Число людей'] * inputs['Норма воздуха на человека'],
      },
      {
        label: 'Требуемый расход',
        unit: 'м³/ч',
        formula: (inputs) => Math.max(inputs['Объём помещения'] * inputs['Кратность воздухообмена'], inputs['Число людей'] * inputs['Норма воздуха на человека']),
      },
    ],
    formula: 'L = max(V × n, N × l)',
    methodology: 'Расчёт по ГОСТ Р 51251-99 и СНиП 41-01-2003',
  },
  {
    id: 'foundation-settlement',
    name: 'Осадка фундамента',
    description: 'Расчёт возможной осадки грунта под фундаментом',
    category: 'structural',
    inputs: [
      { label: 'Нагрузка на фундамент', unit: 'кН', defaultValue: 500 },
      { label: 'Площадь подошвы', unit: 'м²', defaultValue: 10 },
      { label: 'Глубина заложения', unit: 'м', defaultValue: 1.5 },
      { label: 'Модуль деформации грунта', unit: 'МПа', defaultValue: 15 },
    ],
    outputs: [
      {
        label: 'Давление на грунт',
        unit: 'кПа',
        formula: (inputs) => (inputs['Нагрузка на фундамент'] * 1000) / inputs['Площадь подошвы'],
      },
      {
        label: 'Осадка грунта',
        unit: 'мм',
        formula: (inputs) => {
          const pressure = (inputs['Нагрузка на фундамент'] * 1000) / inputs['Площадь подошвы'];
          return (pressure * inputs['Площадь подошвы'] * 0.5) / (inputs['Модуль деформации грунта'] * 1000) * 1000;
        },
      },
    ],
    formula: 's = (p × B × 0.5) / E',
    methodology: 'Расчёт по методике линейно-деформационной модели',
  },
  {
    id: 'fire-resistance',
    name: 'Огнестойкость строительной конструкции',
    description: 'Определение класса огнестойкости на основе характеристик материалов',
    category: 'structural',
    inputs: [
      { label: 'Толщина защитного слоя', unit: 'см', defaultValue: 2.5 },
      { label: 'Теплопроводность защиты', unit: 'Вт/(м·К)', defaultValue: 0.1 },
      { label: 'Плотность защиты', unit: 'кг/м³', defaultValue: 200 },
      { label: 'Температура критическая', unit: '°С', defaultValue: 500 },
    ],
    outputs: [
      {
        label: 'Толщина эквивалентная',
        unit: 'см',
        formula: (inputs) => inputs['Толщина защитного слоя'] * Math.sqrt(inputs['Плотность защиты'] / 1000),
      },
      {
        label: 'Время огнестойкости',
        unit: 'мин',
        formula: (inputs) => {
          const thickness = inputs['Толщина защитного слоя'];
          const conductivity = inputs['Теплопроводность защиты'];
          return (thickness * thickness * 100) / (conductivity * 2) * 1.5;
        },
      },
    ],
    formula: 'τ = (δ² × 100) / (2λ) × k',
    methodology: 'Расчёт по методике определения огнестойкости конструкций',
  },
];
