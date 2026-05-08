/**
 * Demo calculations for the Calculations Platform
 * Real working examples for each category
 */

export interface DemoCalculation {
  id: string;
  name: string;
  description: string;
  category: 'thermal' | 'structural' | 'electrical' | 'instrumentation' | 'hvac' | 'general';
  formula?: string;
  inputs: Array<{ label: string; unit: string; defaultValue: number }>;
  outputs: Array<{ label: string; unit: string; formula?: (inputs: Record<string, number>) => number }>;
  methodology?: string;
}

export const DEMO_CALCULATIONS: DemoCalculation[] = [
  // ========================== STRUCTURAL ==========================
  {
    id: 'pipe-wall-thickness',
    name: 'Расчёт толщины стенки трубопровода',
    description: 'Определение необходимой толщины стенки стального трубопровода по внутреннему давлению',
    category: 'structural',
    formula: 't = (p × d) / (2σ × ϕ - p) + c',
    inputs: [
      { label: 'Внутреннее давление', unit: 'МПа', defaultValue: 2.5 },
      { label: 'Наружный диаметр', unit: 'мм', defaultValue: 219 },
      { label: 'Допускаемое напряжение', unit: 'МПа', defaultValue: 160 },
      { label: 'Коэффициент прочности', unit: '-', defaultValue: 0.85 },
      { label: 'Допуск на коррозию', unit: 'мм', defaultValue: 1.5 },
    ],
    outputs: [
      {
        label: 'Толщина стенки',
        unit: 'мм',
        formula: (inp) => {
          const p = inp['Внутреннее давление'];
          const d = inp['Наружный диаметр'];
          const sigma = inp['Допускаемое напряжение'];
          const phi = inp['Коэффициент прочности'];
          const c = inp['Допуск на коррозию'];
          return (p * d) / (2 * sigma * phi - p) + c;
        },
      },
    ],
    methodology: 'ГОСТ 32569 (эквивалент EN 13445-3)',
  },

  {
    id: 'pipe-stress-analysis',
    name: '🔬 Комплексный анализ напряжений в трубопроводе',
    description: 'Полный анализ напряжений включая кольцевые (хооповые) напряжения, толщину стенки и максимальное рабочее давление',
    category: 'structural',
    formula: 'σ_h = (p × d) / (2 × t) ; σ_l = (p × d) / (4 × t) ; t = (p × d) / (2σ × φ - p) + c',
    inputs: [
      { label: 'Рабочее давление', unit: 'МПа', defaultValue: 2.5 },
      { label: 'Наружный диаметр', unit: 'мм', defaultValue: 219 },
      { label: 'Толщина стенки', unit: 'мм', defaultValue: 8 },
      { label: 'Допускаемое напряжение', unit: 'МПа', defaultValue: 160 },
      { label: 'Коэффициент прочности', unit: '-', defaultValue: 0.85 },
      { label: 'Допуск на коррозию', unit: 'мм', defaultValue: 1.5 },
      { label: 'Температура', unit: '°C', defaultValue: 20 },
    ],
    outputs: [
      {
        label: 'Кольцевое напряжение (хооповое)',
        unit: 'МПа',
        formula: (inp) => {
          const p = inp['Рабочее давление'];
          const d = inp['Наружный диаметр'];
          const t = inp['Толщина стенки'];
          return (p * d) / (2 * t);
        },
      },
      {
        label: 'Продольное напряжение',
        unit: 'МПа',
        formula: (inp) => {
          const p = inp['Рабочее давление'];
          const d = inp['Наружный диаметр'];
          const t = inp['Толщина стенки'];
          return (p * d) / (4 * t);
        },
      },
      {
        label: 'Максимальное рабочее давление',
        unit: 'МПа',
        formula: (inp) => {
          const sigma = inp['Допускаемое напряжение'];
          const d = inp['Наружный диаметр'];
          const t = inp['Толщина стенки'];
          const phi = inp['Коэффициент прочности'];
          const c = inp['Допуск на коррозию'];
          const t_eff = t - c;
          return (2 * sigma * phi * t_eff) / d;
        },
      },
      {
        label: 'Требуемая толщина стенки',
        unit: 'мм',
        formula: (inp) => {
          const p = inp['Рабочее давление'];
          const d = inp['Наружный диаметр'];
          const sigma = inp['Допускаемое напряжение'];
          const phi = inp['Коэффициент прочности'];
          const c = inp['Допуск на коррозию'];
          return (p * d) / (2 * sigma * phi - p) + c;
        },
      },
    ],
    methodology: 'ГОСТ 32569 / EN 13445-3. Кольцевое напряжение критично для прочности трубопровода. Продольное напряжение развивается вдоль оси. Требуемая толщина рассчитывается с запасом на коррозию.',
  },

  {
    id: 'pressure-drop',
    name: 'Гидравлические потери в трубопроводе',
    description: 'Расчёт падения давления при течении жидкости через трубопровод',
    category: 'structural',
    formula: 'Δp = λ × (L / d) × (ρ × v²) / 2',
    inputs: [
      { label: 'Коэффициент трения λ', unit: '-', defaultValue: 0.032 },
      { label: 'Длина трубопровода', unit: 'м', defaultValue: 150 },
      { label: 'Диаметр трубопровода', unit: 'мм', defaultValue: 50 },
      { label: 'Плотность жидкости', unit: 'кг/м³', defaultValue: 1000 },
      { label: 'Скорость потока', unit: 'м/с', defaultValue: 2.1 },
    ],
    outputs: [
      {
        label: 'Падение давления',
        unit: 'кПа',
        formula: (inp) => {
          const lambda = inp['Коэффициент трения λ'];
          const L = inp['Длина трубопровода'];
          const d = inp['Диаметр трубопровода'] / 1000; // convert to meters
          const rho = inp['Плотность жидкости'];
          const v = inp['Скорость потока'];
          return (lambda * (L / d) * (rho * v * v) / 2) / 1000; // convert to kPa
        },
      },
    ],
    methodology: 'Формула Дарси-Вейсбаха',
  },

  {
    id: 'cable-sizing',
    name: 'Выбор сечения кабеля',
    description: 'Определение необходимого сечения кабеля по допустимому падению напряжения',
    category: 'electrical',
    formula: 'S = (2 × L × I) / (γ × U%)',
    inputs: [
      { label: 'Длина кабельной линии', unit: 'м', defaultValue: 250 },
      { label: 'Ток нагрузки', unit: 'А', defaultValue: 63 },
      { label: 'Удельная проводимость', unit: 'См/м', defaultValue: 58 },
      { label: 'Допустимое падение напряжения', unit: '%', defaultValue: 3 },
      { label: 'Напряжение сети', unit: 'В', defaultValue: 380 },
    ],
    outputs: [
      {
        label: 'Минимальное сечение кабеля',
        unit: 'мм²',
        formula: (inp) => {
          const L = inp['Длина кабельной линии'];
          const I = inp['Ток нагрузки'];
          const gamma = inp['Удельная проводимость'];
          const U_prc = inp['Допустимое падение напряжения'];
          const U = inp['Напряжение сети'];
          return (2 * L * I) / (gamma * (U * U_prc / 100));
        },
      },
    ],
    methodology: 'ПУЭ 7-е издание',
  },

  // ========================== THERMAL ==========================
  {
    id: 'heat-balance',
    name: 'Тепловой баланс теплообменника',
    description: 'Расчёт теплового потока в противоточном пластинчатом теплообменнике',
    category: 'thermal',
    formula: 'Q = G₁ × c × (t₁" - t₁\')',
    inputs: [
      { label: 'Массовый расход (горячая сторона)', unit: 'кг/с', defaultValue: 5.2 },
      { label: 'Удельная теплоёмкость', unit: 'кДж/(кг·К)', defaultValue: 4.18 },
      { label: 'Температура входа', unit: '°C', defaultValue: 85 },
      { label: 'Температура выхода', unit: '°C', defaultValue: 45 },
    ],
    outputs: [
      {
        label: 'Тепловой поток',
        unit: 'кВт',
        formula: (inp) => {
          const G = inp['Массовый расход (горячая сторона)'];
          const c = inp['Удельная теплоёмкость'];
          const t_in = inp['Температура входа'];
          const t_out = inp['Температура выхода'];
          return (G * c * (t_in - t_out)) / 1000; // convert to kW
        },
      },
    ],
    methodology: 'Метод логарифмического среднего температурного напора',
  },

  {
    id: 'flow-velocity',
    name: 'Расчёт скорости потока в трубе',
    description: 'Определение скорости движения теплоносителя в трубопроводе при известном расходе',
    category: 'thermal',
    formula: 'v = G / (ρ × π × d² / 4)',
    inputs: [
      { label: 'Массовый расход', unit: 'кг/с', defaultValue: 2.5 },
      { label: 'Плотность теплоносителя', unit: 'кг/м³', defaultValue: 980 },
      { label: 'Диаметр трубы', unit: 'мм', defaultValue: 32 },
    ],
    outputs: [
      {
        label: 'Скорость потока',
        unit: 'м/с',
        formula: (inp) => {
          const G = inp['Массовый расход'];
          const rho = inp['Плотность теплоносителя'];
          const d = inp['Диаметр трубы'] / 1000; // convert to meters
          return G / (rho * Math.PI * (d * d) / 4);
        },
      },
    ],
    methodology: 'Уравнение неразрывности потока',
  },

  // ========================== INSTRUMENTATION ==========================
  {
    id: 'orifice-plate-flow',
    name: 'Расчёт расхода по сужающемуся устройству',
    description: 'Определение расхода жидкости при использовании диафрагмы (диаметральная разница)',
    category: 'instrumentation',
    formula: 'q = α × A × √(2 × Δp / ρ)',
    inputs: [
      { label: 'Коэффициент расхода', unit: '-', defaultValue: 0.61 },
      { label: 'Площадь отверстия диафрагмы', unit: 'мм²', defaultValue: 314 },
      { label: 'Перепад давления', unit: 'кПа', defaultValue: 12.5 },
      { label: 'Плотность жидкости', unit: 'кг/м³', defaultValue: 1000 },
    ],
    outputs: [
      {
        label: 'Объёмный расход',
        unit: 'м³/ч',
        formula: (inp) => {
          const alpha = inp['Коэффициент расхода'];
          const A = inp['Площадь отверстия диафрагмы'] / 1e6; // convert to m²
          const dp = inp['Перепад давления'] * 1000; // convert to Pa
          const rho = inp['Плотность жидкости'];
          return (alpha * A * Math.sqrt((2 * dp) / rho)) * 3600; // convert to m³/h
        },
      },
    ],
    methodology: 'ГОСТ 8.378 (расходомеры с узким местом)',
  },

  // ========================== HVAC ==========================
  {
    id: 'ductwork-sizing',
    name: 'Подбор сечения воздуховода',
    description: 'Определение размеров прямоугольного воздуховода по объёмному расходу воздуха',
    category: 'hvac',
    formula: 'A = L / v',
    inputs: [
      { label: 'Объёмный расход воздуха', unit: 'м³/ч', defaultValue: 2400 },
      { label: 'Рекомендуемая скорость воздуха', unit: 'м/с', defaultValue: 5.0 },
    ],
    outputs: [
      {
        label: 'Площадь сечения воздуховода',
        unit: 'м²',
        formula: (inp) => {
          const L = inp['Объёмный расход воздуха'] / 3600; // convert to m³/s
          const v = inp['Рекомендуемая скорость воздуха'];
          return L / v;
        },
      },
    ],
    methodology: 'СП 60.13330 (Отопление, вентиляция и кондиционирование)',
  },

  // ========================== GENERAL ENGINEERING ==========================
  {
    id: 'reynolds-number',
    name: 'Определение режима течения (число Рейнольдса)',
    description: 'Расчёт числа Рейнольдса для определения ламинарности или турбулентности потока',
    category: 'general',
    formula: 'Re = (ρ × v × d) / μ',
    inputs: [
      { label: 'Плотность жидкости', unit: 'кг/м³', defaultValue: 998 },
      { label: 'Скорость потока', unit: 'м/с', defaultValue: 3.5 },
      { label: 'Диаметр трубопровода', unit: 'мм', defaultValue: 25 },
      { label: 'Динамическая вязкость', unit: 'мПа·с', defaultValue: 1.0 },
    ],
    outputs: [
      {
        label: 'Число Рейнольдса',
        unit: '-',
        formula: (inp) => {
          const rho = inp['Плотность жидкости'];
          const v = inp['Скорость потока'];
          const d = inp['Диаметр трубопровода'] / 1000; // convert to meters
          const mu = (inp['Динамическая вязкость'] / 1000) * rho; // convert Pa·s
          return (rho * v * d) / mu;
        },
      },
    ],
    methodology: 'Re < 2300: ламинарный режим, Re > 4000: турбулентный',
  },
];

export const CALCULATION_CATEGORIES = [
  {
    id: 'thermal',
    name: '🔥 Технологические расчёты',
    description: 'Тепловые балансы, потоки энергии, теплообменники',
    color: 'from-orange-500 to-red-600',
    count: 2,
  },
  {
    id: 'structural',
    name: '🏗️ Строительные расчёты',
    description: 'Прочность, толщина стенок, давления, напряжения',
    color: 'from-gray-500 to-slate-700',
    count: 2,
  },
  {
    id: 'electrical',
    name: '⚡ Электротехнические расчёты',
    description: 'Выбор кабелей, токи, падения напряжений',
    color: 'from-yellow-500 to-amber-600',
    count: 1,
  },
  {
    id: 'instrumentation',
    name: '📊 КИПиА',
    description: 'Расходомеры, датчики, точность измерений',
    color: 'from-blue-500 to-cyan-600',
    count: 1,
  },
  {
    id: 'hvac',
    name: '💨 ОВ/ВК',
    description: 'Вентиляция, кондиционирование, теплоснабжение',
    color: 'from-cyan-500 to-blue-600',
    count: 1,
  },
  {
    id: 'general',
    name: '🔧 Общие инженерные расчёты',
    description: 'Универсальные формулы, фундаментальные законы',
    color: 'from-purple-500 to-pink-600',
    count: 1,
  },
];
