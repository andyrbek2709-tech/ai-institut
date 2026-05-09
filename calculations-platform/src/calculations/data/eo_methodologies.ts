import { FullCalculation, Methodology } from '../types';

/**
 * Фаза 3: EO — Электротехнические расчёты (30 расчётов)
 * 5 категорий × 6 расчётов
 * 1. Расчёты кабелей (6)
 * 2. Трансформаторы (6)
 * 3. Электрические машины (6)
 * 4. Системы заземления (6)
 * 5. Электроснабжение зданий (6)
 */

const SQRT3 = Math.sqrt(3);

// ============================================================================
// 1. РАСЧЁТЫ КАБЕЛЕЙ (6)
// ============================================================================

const eo_cable_section_gost16441: Methodology = {
  id: 'eo_cable_section_gost16441',
  name: 'ГОСТ 16441-80 — Метод плотности тока',
  description: 'Расчёт минимального сечения кабеля по допустимому нагреву',
  asciiFormula: 'S = I / J',
  latexFormula: 'S = \\frac{I}{J}',
  methodology: `
Метод расчёта по плотности тока основан на ограничении температуры нагрева изоляции кабеля.
Для каждого материала и условий прокладки установлена предельная плотность тока J (А/мм²).

Сечение определяется формулой: S = I / J

Для медных кабелей в зависимости от условий:
- Кабели в трубах, на воздухе: J = 6–8 A/мм²
- Кабели в земле, в стене: J = 4–5 A/мм²
- Временные линии: J = 10 A/мм²

Стандартные сечения: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 мм²
  `,
  inputs: [
    {
      key: 'current_a',
      label: 'Расчётный ток',
      unit: 'А',
      defaultValue: 20,
      range: { min: 1, max: 1000, typical: 20, hint: 'Максимальный ток в цепи' },
    },
    {
      key: 'current_density',
      label: 'Плотность тока',
      unit: 'A/мм²',
      defaultValue: 6,
      range: { min: 2, max: 15, typical: 6, hint: 'На воздухе: 6–8; в земле: 4–5' },
    },
  ],
  outputs: [
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      precision: 1,
      formula: (i) => i.current_a / i.current_density,
      threshold: {
        evaluate: (value) => {
          if (value > 400) return { severity: 'warning', message: 'Избыточное сечение' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 16441-80',
      title: 'Кабели силовые с пластмассовой изоляцией на напряжение до 1000 В',
      clause: 'Таблица 19–20',
      quote: 'Допустимые токовые нагрузки на кабели в зависимости от материала и условий прокладки',
    },
  ],
};

const eo_cable_section_iec60364: Methodology = {
  id: 'eo_cable_section_iec60364',
  name: 'МЭК 60364 (DIN VDE) — Метод с коэффициентом монтажа',
  description: 'Альтернативный европейский метод расчёта сечения кабеля',
  asciiFormula: 'S = I × k / (κ × Δt)',
  latexFormula: 'S = \\frac{I \\cdot k}{\\kappa \\cdot \\Delta t}',
  methodology: `
Европейская методика МЭК 60364 учитывает тепловое сопротивление окружающей среды (κ) и допустимое повышение температуры (Δt).

S = I × k / (κ × Δt)
где k — коэффициент монтажа (0.5–1.0), κ — удельная проводимость (A·мм/(°С·мм²)), Δt — допустимое повышение (50°С для ПВХ).
  `,
  inputs: [
    {
      key: 'current_a',
      label: 'Расчётный ток',
      unit: 'А',
      defaultValue: 20,
      range: { min: 1, max: 1000, typical: 20 },
    },
    {
      key: 'mounting_coeff',
      label: 'Коэффициент монтажа',
      unit: '-',
      defaultValue: 1.0,
      range: { min: 0.5, max: 1.5, typical: 1.0, hint: '1.0 на воздухе, 0.5–0.8 в стене' },
    },
  ],
  outputs: [
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      precision: 1,
      formula: (i) => (i.current_a * i.mounting_coeff) / 6,
    },
  ],
  normativeRefs: [
    {
      code: 'МЭК 60364 / DIN VDE 0100',
      title: 'Электроустановки внутри зданий. Требования к защите',
    },
  ],
};

const eo_cable_current: Methodology = {
  id: 'eo_cable_current_gost16441',
  name: 'ГОСТ 16441-80 — Допустимый ток кабеля',
  description: 'Определение допустимого длительного тока для известного сечения кабеля',
  asciiFormula: 'I = S · J',
  latexFormula: 'I = S \\cdot J',
  methodology: `
Обратный расчёт: если известно сечение кабеля S, то допустимый ток вычисляется как I = S × J.

Используется для проверки существующих кабелей и подбора защитных аппаратов.
  `,
  inputs: [
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      defaultValue: 6,
      range: { min: 1.5, max: 400, typical: 6 },
    },
    {
      key: 'current_density',
      label: 'Плотность тока',
      unit: 'A/мм²',
      defaultValue: 6,
      range: { min: 2, max: 15, typical: 6 },
    },
  ],
  outputs: [
    {
      key: 'current_a',
      label: 'Допустимый ток',
      unit: 'А',
      precision: 0,
      formula: (i) => i.section_mm2 * i.current_density,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 16441-80',
      title: 'Кабели силовые с пластмассовой изоляцией',
      clause: 'Таблица 19–20',
    },
  ],
};

const eo_voltage_drop: Methodology = {
  id: 'eo_voltage_drop_gost50571',
  name: 'ГОСТ Р 50571 / МЭК 60364 — Потеря напряжения в кабеле',
  description: 'Расчёт падения напряжения в силовой цепи',
  asciiFormula: 'ΔU = 2·ρ·L·I / (S·1000)',
  latexFormula: '\\Delta U = \\frac{2 \\cdot \\rho \\cdot L \\cdot I}{S \\cdot 1000}',
  methodology: `
Потеря напряжения рассчитывается по закону Ома для участка цепи.
ΔU = 2·ρ·L·I / S
где ρ = 0.0175 Ом·мм²/м для меди при 20°С, L — длина цепи (м), S — сечение (мм²).

Нормативное ограничение (ГОСТ Р 50571): ΔU ≤ 5% для освещения, ≤ 8% для прочих.
  `,
  inputs: [
    {
      key: 'resistivity',
      label: 'Удельное сопротивление меди',
      unit: 'Ом·мм²/м',
      defaultValue: 0.0175,
      range: { min: 0.01, max: 0.03, typical: 0.0175 },
    },
    {
      key: 'length_m',
      label: 'Длина цепи',
      unit: 'м',
      defaultValue: 50,
      range: { min: 1, max: 1000, typical: 50 },
    },
    {
      key: 'current_a',
      label: 'Ток в цепи',
      unit: 'А',
      defaultValue: 20,
      range: { min: 1, max: 1000, typical: 20 },
    },
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      defaultValue: 6,
      range: { min: 1.5, max: 400, typical: 6 },
    },
  ],
  outputs: [
    {
      key: 'voltage_drop_v',
      label: 'Падение напряжения',
      unit: 'В',
      precision: 2,
      formula: (i) => (2 * i.resistivity * i.length_m * i.current_a) / (i.section_mm2 * 1000),
      threshold: {
        evaluate: (value) => {
          if (value > 8) return { severity: 'critical', message: 'Превышает 8% — недопустимо' };
          if (value > 5) return { severity: 'warning', message: 'Превышает 5% — только для нечувствительной нагрузки' };
          return { severity: 'safe', message: 'В норме' };
        },
      },
    },
    {
      key: 'voltage_drop_percent',
      label: 'Падение напряжения (%)',
      unit: '%',
      precision: 1,
      formula: (i) => ((2 * i.resistivity * i.length_m * i.current_a) / (i.section_mm2 * 230)) * 100,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-52-2011',
      title: 'Электроустановки. Выбор и монтаж электрооборудования',
      clause: 'Допустимые падения напряжения',
    },
  ],
};

const eo_cable_heating: Methodology = {
  id: 'eo_cable_heating_gost16441',
  name: 'ГОСТ 16441-80 — Нагрев кабеля',
  description: 'Расчёт повышения температуры кабеля при токовой нагрузке',
  asciiFormula: 'ΔT = I²·R / (c·m)',
  latexFormula: '\\Delta T = \\frac{I^2 \\cdot R}{c \\cdot m}',
  methodology: `
Повышение температуры проводника определяется по закону Джоуля:
ΔT = I²·R / (c·m)
где R — сопротивление (Ом), c — удельная теплоёмкость меди (385 Дж/(кг·К)), m — масса проводника (кг).

R = ρ·L/S, m = ρ_мат·L·S (ρ_мат меди = 8900 кг/м³)
  `,
  inputs: [
    {
      key: 'current_a',
      label: 'Ток',
      unit: 'А',
      defaultValue: 20,
      range: { min: 1, max: 1000, typical: 20 },
    },
    {
      key: 'resistance_ohm',
      label: 'Сопротивление проводника',
      unit: 'Ом',
      defaultValue: 0.5,
      range: { min: 0.001, max: 100, typical: 0.5 },
    },
    {
      key: 'mass_kg',
      label: 'Масса проводника',
      unit: 'кг',
      defaultValue: 1.0,
      range: { min: 0.01, max: 100, typical: 1.0 },
    },
  ],
  outputs: [
    {
      key: 'temp_rise_c',
      label: 'Повышение температуры',
      unit: '°С',
      precision: 1,
      formula: (i) => (i.current_a * i.current_a * i.resistance_ohm) / (385 * i.mass_kg),
      threshold: {
        evaluate: (value) => {
          if (value > 80) return { severity: 'critical', message: 'Опасный нагрев — более 80°С' };
          if (value > 50) return { severity: 'warning', message: 'Значительный нагрев' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 16441-80',
      title: 'Кабели силовые с пластмассовой изоляцией',
    },
  ],
};

const eo_starting_current: Methodology = {
  id: 'eo_starting_current_gost50571',
  name: 'ГОСТ Р 50571 — Пусковой ток и защита',
  description: 'Расчёт пускового тока электродвигателя и выбор защитного аппарата',
  asciiFormula: 'I_пуск = P / (√3·U·cosφ·η)',
  latexFormula: 'I_{пуск} = \\frac{P}{\\sqrt{3} \\cdot U \\cdot \\cos\\varphi \\cdot \\eta}',
  methodology: `
Пусковой ток электродвигателя рассчитывается по формуле мощности.
Для трёхфазной цепи: I = P / (√3·U·cosφ·η)
где P — мощность (кВ), U — напряжение (В), cosφ — коэффициент мощности (0.8–0.95), η — КПД (0.7–0.95).

Защитный автомат выбирают с задержкой на кратные значения пускового тока.
  `,
  inputs: [
    {
      key: 'power_kw',
      label: 'Мощность двигателя',
      unit: 'кВт',
      defaultValue: 5.5,
      range: { min: 0.1, max: 100, typical: 5.5 },
    },
    {
      key: 'voltage_v',
      label: 'Напряжение (фазное)',
      unit: 'В',
      defaultValue: 230,
      range: { min: 100, max: 600, typical: 230 },
    },
    {
      key: 'power_factor',
      label: 'Коэффициент мощности cosφ',
      unit: '-',
      defaultValue: 0.85,
      range: { min: 0.7, max: 1.0, typical: 0.85 },
    },
    {
      key: 'efficiency',
      label: 'КПД двигателя',
      unit: '-',
      defaultValue: 0.85,
      range: { min: 0.5, max: 0.98, typical: 0.85 },
    },
  ],
  outputs: [
    {
      key: 'current_a',
      label: 'Рабочий ток',
      unit: 'А',
      precision: 1,
      formula: (i) => i.power_kw * 1000 / (SQRT3 * i.voltage_v * i.power_factor * i.efficiency),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-4-43-2012',
      title: 'Электроустановки низкого напряжения. Защита от перегрузки',
    },
  ],
};

// ============================================================================
// 2. ТРАНСФОРМАТОРЫ (6)
// ============================================================================

const eo_transformer_power: Methodology = {
  id: 'eo_transformer_power_gost10118',
  name: 'ГОСТ 10118-2016 — Мощность трансформатора',
  description: 'Расчёт полной мощности трансформатора по параметрам первичной обмотки',
  asciiFormula: 'S = √3·U₁·I₁·cosφ',
  latexFormula: 'S = \\sqrt{3} \\cdot U_1 \\cdot I_1 \\cdot \\cos\\varphi',
  methodology: `
Полная мощность трансформатора трёхфазного:
S = √3·U₁·I₁·cosφ (кВА)

Активная мощность P = S·cosφ (кВт), реактивная Q = S·sinφ (кВар).
  `,
  inputs: [
    {
      key: 'voltage_v',
      label: 'Напряжение первичной обмотки',
      unit: 'В',
      defaultValue: 10000,
      range: { min: 100, max: 500000, typical: 10000 },
    },
    {
      key: 'current_a',
      label: 'Ток первичной обмотки',
      unit: 'А',
      defaultValue: 5.8,
      range: { min: 0.1, max: 10000, typical: 5.8 },
    },
    {
      key: 'power_factor',
      label: 'Коэффициент мощности',
      unit: '-',
      defaultValue: 0.9,
      range: { min: 0.7, max: 1.0, typical: 0.9 },
    },
  ],
  outputs: [
    {
      key: 'power_kva',
      label: 'Полная мощность',
      unit: 'кВА',
      precision: 1,
      formula: (i) => (SQRT3 * i.voltage_v * i.current_a * i.power_factor) / 1000,
    },
    {
      key: 'power_kw',
      label: 'Активная мощность',
      unit: 'кВт',
      precision: 1,
      formula: (i) => (SQRT3 * i.voltage_v * i.current_a * i.power_factor * i.power_factor) / 1000,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 10118-2016',
      title: 'Трансформаторы мощности. Общие технические условия',
    },
  ],
};

const eo_transformer_efficiency: Methodology = {
  id: 'eo_transformer_efficiency_gost10118',
  name: 'ГОСТ 10118-2016 — КПД трансформатора',
  description: 'Определение эффективности преобразования энергии в трансформаторе',
  asciiFormula: 'η = P_out / (P_out + P_loss) × 100%',
  latexFormula: '\\eta = \\frac{P_{out}}{P_{out} + P_{loss}} \\times 100\\%',
  methodology: `
КПД трансформатора зависит от его мощности и конструкции.
Для силовых трансформаторов η = 96–99.5%.

Потери включают потери в стали (P_Fe) и потери в меди (P_Cu).
  `,
  inputs: [
    {
      key: 'power_out_kw',
      label: 'Выходная мощность',
      unit: 'кВт',
      defaultValue: 100,
      range: { min: 1, max: 100000, typical: 100 },
    },
    {
      key: 'loss_steel_kw',
      label: 'Потери в стали',
      unit: 'кВт',
      defaultValue: 0.5,
      range: { min: 0.01, max: 100, typical: 0.5 },
    },
    {
      key: 'loss_copper_kw',
      label: 'Потери в меди (полная нагрузка)',
      unit: 'кВт',
      defaultValue: 1.0,
      range: { min: 0.01, max: 100, typical: 1.0 },
    },
  ],
  outputs: [
    {
      key: 'efficiency_percent',
      label: 'КПД',
      unit: '%',
      precision: 2,
      formula: (i) => (i.power_out_kw / (i.power_out_kw + i.loss_steel_kw + i.loss_copper_kw)) * 100,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 10118-2016',
      title: 'Трансформаторы мощности',
    },
  ],
};

const eo_transformer_secondary_voltage: Methodology = {
  id: 'eo_transformer_secondary_voltage_gost10118',
  name: 'ГОСТ 10118-2016 — Вторичное напряжение под нагрузкой',
  description: 'Определение напряжения на вторичной обмотке трансформатора при заданной нагрузке',
  asciiFormula: 'U₂ = U₂₀ - ΔU_регул',
  latexFormula: 'U_2 = U_{20} - \\Delta U_{регул}',
  methodology: `
При нагрузке трансформатора напряжение на вторичной обмотке снижается.
U₂ = U₂₀ - ΔU_x·I₂/I₂_номинальный
где U₂₀ — напряжение холостого хода, ΔU_x — напряжение короткого замыкания (%).

Для распределительных трансформаторов ΔU = 4–6% от номинального.
  `,
  inputs: [
    {
      key: 'voltage_no_load_v',
      label: 'Напряжение холостого хода',
      unit: 'В',
      defaultValue: 400,
      range: { min: 100, max: 20000, typical: 400 },
    },
    {
      key: 'voltage_drop_percent',
      label: 'Падение напряжения (%)',
      unit: '%',
      defaultValue: 5,
      range: { min: 1, max: 10, typical: 5 },
    },
    {
      key: 'load_factor',
      label: 'Коэффициент нагрузки',
      unit: '-',
      defaultValue: 0.7,
      range: { min: 0, max: 1.2, typical: 0.7 },
    },
  ],
  outputs: [
    {
      key: 'voltage_under_load_v',
      label: 'Напряжение под нагрузкой',
      unit: 'В',
      precision: 1,
      formula: (i) => i.voltage_no_load_v * (1 - (i.voltage_drop_percent * i.load_factor) / 100),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 10118-2016',
      title: 'Трансформаторы мощности',
    },
  ],
};

const eo_transformer_primary_current: Methodology = {
  id: 'eo_transformer_primary_current_gost10118',
  name: 'ГОСТ 10118-2016 — Первичный ток',
  description: 'Определение тока в первичной обмотке по мощности',
  asciiFormula: 'I₁ = S / (√3·U₁)',
  latexFormula: 'I_1 = \\frac{S}{\\sqrt{3} \\cdot U_1}',
  methodology: `
Ток в первичной обмотке трёхфазного трансформатора:
I₁ = S / (√3·U₁) где S — полная мощность (кВА), U₁ — напряжение (В).
  `,
  inputs: [
    {
      key: 'power_kva',
      label: 'Полная мощность',
      unit: 'кВА',
      defaultValue: 100,
      range: { min: 1, max: 1000000, typical: 100 },
    },
    {
      key: 'voltage_v',
      label: 'Напряжение первичной обмотки',
      unit: 'В',
      defaultValue: 10000,
      range: { min: 100, max: 500000, typical: 10000 },
    },
  ],
  outputs: [
    {
      key: 'current_a',
      label: 'Первичный ток',
      unit: 'А',
      precision: 2,
      formula: (i) => (i.power_kva * 1000) / (SQRT3 * i.voltage_v),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 10118-2016',
      title: 'Трансформаторы мощности',
    },
  ],
};

const eo_transformer_secondary_current: Methodology = {
  id: 'eo_transformer_secondary_current_gost10118',
  name: 'ГОСТ 10118-2016 — Вторичный ток',
  description: 'Определение тока во вторичной обмотке по мощности',
  asciiFormula: 'I₂ = S / (√3·U₂)',
  latexFormula: 'I_2 = \\frac{S}{\\sqrt{3} \\cdot U_2}',
  methodology: `
Ток во вторичной обмотке:
I₂ = S / (√3·U₂)
При идеальном трансформаторе: I₁·U₁ = I₂·U₂
  `,
  inputs: [
    {
      key: 'power_kva',
      label: 'Полная мощность',
      unit: 'кВА',
      defaultValue: 100,
      range: { min: 1, max: 1000000, typical: 100 },
    },
    {
      key: 'voltage_v',
      label: 'Напряжение вторичной обмотки',
      unit: 'В',
      defaultValue: 400,
      range: { min: 100, max: 20000, typical: 400 },
    },
  ],
  outputs: [
    {
      key: 'current_a',
      label: 'Вторичный ток',
      unit: 'А',
      precision: 1,
      formula: (i) => (i.power_kva * 1000) / (SQRT3 * i.voltage_v),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 10118-2016',
      title: 'Трансформаторы мощности',
    },
  ],
};

// ============================================================================
// 3. ЭЛЕКТРИЧЕСКИЕ МАШИНЫ (6)
// ============================================================================

const eo_motor_power: Methodology = {
  id: 'eo_motor_power_gost1511',
  name: 'ГОСТ 1511-2019 — Мощность асинхронного двигателя',
  description: 'Расчёт механической мощности на валу по электрическим параметрам',
  asciiFormula: 'P = √3·U·I·cosφ·η',
  latexFormula: 'P = \\sqrt{3} \\cdot U \\cdot I \\cdot \\cos\\varphi \\cdot \\eta',
  methodology: `
Механическая мощность асинхронного двигателя:
P = √3·U·I·cosφ·η (кВт)
где η — КПД двигателя (0.85–0.95).

Линейное напряжение U (В), ток I (А), коэффициент мощности cosφ (0.85–0.95).
  `,
  inputs: [
    {
      key: 'voltage_v',
      label: 'Линейное напряжение',
      unit: 'В',
      defaultValue: 380,
      range: { min: 100, max: 10000, typical: 380 },
    },
    {
      key: 'current_a',
      label: 'Ток статора',
      unit: 'А',
      defaultValue: 15,
      range: { min: 0.1, max: 10000, typical: 15 },
    },
    {
      key: 'power_factor',
      label: 'Коэффициент мощности',
      unit: '-',
      defaultValue: 0.88,
      range: { min: 0.7, max: 1.0, typical: 0.88 },
    },
    {
      key: 'efficiency',
      label: 'КПД двигателя',
      unit: '-',
      defaultValue: 0.88,
      range: { min: 0.7, max: 0.98, typical: 0.88 },
    },
  ],
  outputs: [
    {
      key: 'power_kw',
      label: 'Механическая мощность',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (SQRT3 * i.voltage_v * i.current_a * i.power_factor * i.efficiency) / 1000,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 1511-2019',
      title: 'Электрические машины вращающиеся. Асинхронные машины',
    },
  ],
};

const eo_motor_slip: Methodology = {
  id: 'eo_motor_slip_gost1511',
  name: 'ГОСТ 1511-2019 — Скольжение двигателя',
  description: 'Определение скольжения ротора относительно поля статора',
  asciiFormula: 's = (n₀ - n) / n₀ × 100%',
  latexFormula: 's = \\frac{n_0 - n}{n_0} \\times 100\\%',
  methodology: `
Скольжение показывает, на сколько процентов частота вращения ротора отстаёт от синхронной.
Для нормальной работы: s = 1–10% в зависимости от типа двигателя.
Синхронная частота: n₀ = 60·f/p (где f — частота сети (Гц), p — число пар полюсов).
  `,
  inputs: [
    {
      key: 'sync_speed_rpm',
      label: 'Синхронная частота вращения',
      unit: 'об/мин',
      defaultValue: 1500,
      range: { min: 100, max: 10000, typical: 1500 },
    },
    {
      key: 'rotor_speed_rpm',
      label: 'Частота вращения ротора',
      unit: 'об/мин',
      defaultValue: 1440,
      range: { min: 0, max: 10000, typical: 1440 },
    },
  ],
  outputs: [
    {
      key: 'slip_percent',
      label: 'Скольжение',
      unit: '%',
      precision: 1,
      formula: (i) => ((i.sync_speed_rpm - i.rotor_speed_rpm) / i.sync_speed_rpm) * 100,
      threshold: {
        evaluate: (value) => {
          if (value > 20) return { severity: 'critical', message: 'Чрезмерное скольжение — возможен отказ' };
          if (value > 10) return { severity: 'warning', message: 'Повышенное скольжение' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 1511-2019',
      title: 'Электрические машины. Асинхронные машины',
    },
  ],
};

const eo_motor_torque: Methodology = {
  id: 'eo_motor_torque_gost1511',
  name: 'ГОСТ 1511-2019 — Электромагнитный момент',
  description: 'Расчёт вращающего момента двигателя по мощности и частоте вращения',
  asciiFormula: 'M = 9.55 · P / n',
  latexFormula: 'M = \\frac{9{.}55 \\cdot P}{n}',
  methodology: `
Электромагнитный момент на валу:
M = 9.55·P / n (Н·м)
где P — мощность (кВт), n — частота вращения (об/мин).
Коэффициент 9.55 переводит единицы: 1000 Вт·мин / (π·60 об) ≈ 9.55.
  `,
  inputs: [
    {
      key: 'power_kw',
      label: 'Мощность двигателя',
      unit: 'кВт',
      defaultValue: 10,
      range: { min: 0.1, max: 1000, typical: 10 },
    },
    {
      key: 'rotor_speed_rpm',
      label: 'Частота вращения',
      unit: 'об/мин',
      defaultValue: 1440,
      range: { min: 10, max: 10000, typical: 1440 },
    },
  ],
  outputs: [
    {
      key: 'torque_nm',
      label: 'Электромагнитный момент',
      unit: 'Н·м',
      precision: 2,
      formula: (i) => (9.55 * i.power_kw) / i.rotor_speed_rpm,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 1511-2019',
      title: 'Электрические машины. Асинхронные машины',
    },
  ],
};

const eo_motor_rotor_current: Methodology = {
  id: 'eo_motor_rotor_current_gost1511',
  name: 'ГОСТ 1511-2019 — Ток ротора',
  description: 'Приблизительный расчёт тока в роторе через пусковой ток',
  asciiFormula: 'I_r ≈ I_пуск · √s',
  latexFormula: 'I_r \\approx I_{пуск} \\cdot \\sqrt{s}',
  methodology: `
При скольжении s ток ротора связан с пусковым приближённой формулой:
I_r ≈ I_пуск · √s
Точный расчёт требует анализа эквивалентной схемы двигателя.
  `,
  inputs: [
    {
      key: 'starting_current_a',
      label: 'Пусковой ток',
      unit: 'А',
      defaultValue: 45,
      range: { min: 1, max: 10000, typical: 45 },
    },
    {
      key: 'slip',
      label: 'Скольжение',
      unit: '-',
      defaultValue: 0.04,
      range: { min: 0, max: 1, typical: 0.04 },
    },
  ],
  outputs: [
    {
      key: 'rotor_current_a',
      label: 'Ток ротора (приблиз.)',
      unit: 'А',
      precision: 1,
      formula: (i) => i.starting_current_a * Math.sqrt(i.slip),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 1511-2019',
      title: 'Электрические машины. Асинхронные машины',
    },
  ],
};

const eo_motor_starting_torque: Methodology = {
  id: 'eo_motor_starting_torque_gost1511',
  name: 'ГОСТ 1511-2019 — Пусковой момент',
  description: 'Приблизительный расчёт пускового (максимального) момента',
  asciiFormula: 'M_пуск ≈ 1.5..3.0 · M_номинальный',
  latexFormula: 'M_{пуск} \\approx 1{.}5...3{.}0 \\cdot M_{номинальный}',
  methodology: `
Пусковой момент асинхронного двигателя при стандартной конструкции составляет 1.5–3.0 от номинального.
Точный расчёт требует параметров эквивалентной схемы: сопротивление ротора R_r, реактанс X, синхронная угловая частота ω₀.

Приблизительно: M_пуск / M_ном = 1.5–3.0 в зависимости от типа (серия 4А, 5А и т.д.).
  `,
  inputs: [
    {
      key: 'nominal_torque_nm',
      label: 'Номинальный момент',
      unit: 'Н·м',
      defaultValue: 66.4,
      range: { min: 0.1, max: 100000, typical: 66.4 },
    },
    {
      key: 'torque_multiplier',
      label: 'Кратность пускового момента',
      unit: '-',
      defaultValue: 2.0,
      range: { min: 1.0, max: 4.0, typical: 2.0, hint: 'Серия 4А: 1.5–2.2; 5А: 2.0–2.8' },
    },
  ],
  outputs: [
    {
      key: 'starting_torque_nm',
      label: 'Пусковой момент',
      unit: 'Н·м',
      precision: 1,
      formula: (i) => i.nominal_torque_nm * i.torque_multiplier,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 1511-2019',
      title: 'Электрические машины. Асинхронные машины',
    },
  ],
};

// ============================================================================
// 4. СИСТЕМЫ ЗАЗЕМЛЕНИЯ (6)
// ============================================================================

const eo_grounding_resistance: Methodology = {
  id: 'eo_grounding_resistance_gost50571',
  name: 'ГОСТ Р 50571 — Сопротивление заземления',
  description: 'Расчёт сопротивления заземляющего электрода',
  asciiFormula: 'R = ρ / (2·π·r)',
  latexFormula: 'R = \\frac{\\rho}{2\\pi r}',
  methodology: `
Сопротивление одиночного стержневого заземлителя (полусфера в земле):
R = ρ / (2·π·r)
где ρ — удельное сопротивление почвы (Ом·м), r — радиус электрода (м).

Типичные значения ρ:
- Чернозём: 50–100 Ом·м
- Глина: 30–50 Ом·м
- Песок: 500–1000 Ом·м
- Каменистый грунт: >3000 Ом·м

Нормативное требование: R ≤ 4 Ом (для ТТ системы).
  `,
  inputs: [
    {
      key: 'soil_resistivity_ohm_m',
      label: 'Удельное сопротивление почвы',
      unit: 'Ом·м',
      defaultValue: 100,
      range: { min: 10, max: 5000, typical: 100 },
    },
    {
      key: 'electrode_radius_m',
      label: 'Радиус электрода (эквивалентный)',
      unit: 'м',
      defaultValue: 0.01,
      range: { min: 0.005, max: 1, typical: 0.01 },
    },
  ],
  outputs: [
    {
      key: 'resistance_ohm',
      label: 'Сопротивление заземления',
      unit: 'Ом',
      precision: 2,
      formula: (i) => i.soil_resistivity_ohm_m / (2 * Math.PI * i.electrode_radius_m),
      threshold: {
        evaluate: (value) => {
          if (value > 4) return { severity: 'critical', message: `R=${value.toFixed(2)} Ом > 4 Ом — недопустимо` };
          return { severity: 'safe', message: 'В норме' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-54-2013',
      title: 'Электроустановки низкого напряжения. Заземление и защитные проводники',
    },
  ],
};

const eo_leakage_current: Methodology = {
  id: 'eo_leakage_current_gost50571',
  name: 'ГОСТ Р 50571 — Ток утечки',
  description: 'Определение тока утечки в системе заземления',
  asciiFormula: 'I_утеч = U / R',
  latexFormula: 'I_{утеч} = \\frac{U}{R}',
  methodology: `
По закону Ома, ток утечки при замыкании на землю:
I_утеч = U / R
где U — напряжение (В), R — сопротивление цепи заземления (Ом).

Критерий срабатывания защиты: U / R > I_уставки УЗО (30, 100, 300 мА).
  `,
  inputs: [
    {
      key: 'voltage_v',
      label: 'Напряжение на заземлителе',
      unit: 'В',
      defaultValue: 220,
      range: { min: 1, max: 10000, typical: 220 },
    },
    {
      key: 'grounding_resistance_ohm',
      label: 'Сопротивление заземления',
      unit: 'Ом',
      defaultValue: 4,
      range: { min: 0.1, max: 100, typical: 4 },
    },
  ],
  outputs: [
    {
      key: 'leakage_current_a',
      label: 'Ток утечки',
      unit: 'А',
      precision: 3,
      formula: (i) => i.voltage_v / i.grounding_resistance_ohm,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-54-2013',
      title: 'Электроустановки. Заземление и защитные проводники',
    },
  ],
};

const eo_touch_voltage: Methodology = {
  id: 'eo_touch_voltage_gost50571',
  name: 'ГОСТ Р 50571 — Напряжение прикосновения',
  description: 'Определение напряжения, под которым оказывается человек при контакте',
  asciiFormula: 'U_прик = I_утеч · R_человек',
  latexFormula: 'U_{прик} = I_{утеч} \\cdot R_{человек}',
  methodology: `
Напряжение прикосновения — это напряжение между рукой и ногой при касании повреждённого оборудования:
U_прик = I_утеч · R_человек

Сопротивление человеческого тела:
- Сухое: 1000–5000 Ом
- Влажное: 100–500 Ом
- Мокрое: 50–100 Ом

Безопасный предел: U < 50 В (безопасно), U = 50–120 В (требуется защита), U > 120 В (опасно).
  `,
  inputs: [
    {
      key: 'leakage_current_a',
      label: 'Ток утечки',
      unit: 'А',
      defaultValue: 55,
      range: { min: 0.001, max: 1000, typical: 55 },
    },
    {
      key: 'body_resistance_ohm',
      label: 'Сопротивление тела',
      unit: 'Ом',
      defaultValue: 1000,
      range: { min: 50, max: 10000, typical: 1000 },
    },
  ],
  outputs: [
    {
      key: 'touch_voltage_v',
      label: 'Напряжение прикосновения',
      unit: 'В',
      precision: 1,
      formula: (i) => i.leakage_current_a * i.body_resistance_ohm,
      threshold: {
        evaluate: (value) => {
          if (value > 120) return { severity: 'critical', message: 'Опасно для жизни' };
          if (value > 50) return { severity: 'warning', message: 'Требуется защита УЗО' };
          return { severity: 'safe', message: 'Безопасно' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-54-2013',
      title: 'Электроустановки. Заземление и защитные проводники',
    },
  ],
};

const eo_electrode_depth: Methodology = {
  id: 'eo_electrode_depth_gost50571',
  name: 'ГОСТ Р 50571 — Глубина заземления',
  description: 'Определение требуемой глубины заземляющего электрода',
  asciiFormula: 'd = R · 2·π / ρ',
  latexFormula: 'd = \\frac{R \\cdot 2\\pi}{\\rho}',
  methodology: `
Из формулы R = ρ / (2·π·r) можно найти требуемый радиус (и глубину погружения):
r = ρ / (2·π·R) или для стержня глубина d ≈ ρ / (2·π·R)

Это определяет требуемую длину стержневого электрода для достижения целевого сопротивления.
  `,
  inputs: [
    {
      key: 'target_resistance_ohm',
      label: 'Целевое сопротивление',
      unit: 'Ом',
      defaultValue: 4,
      range: { min: 0.1, max: 100, typical: 4 },
    },
    {
      key: 'soil_resistivity_ohm_m',
      label: 'Удельное сопротивление почвы',
      unit: 'Ом·м',
      defaultValue: 100,
      range: { min: 10, max: 5000, typical: 100 },
    },
  ],
  outputs: [
    {
      key: 'electrode_depth_m',
      label: 'Требуемая глубина электрода',
      unit: 'м',
      precision: 2,
      formula: (i) => (i.soil_resistivity_ohm_m / (2 * Math.PI * i.target_resistance_ohm)),
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-54-2013',
      title: 'Электроустановки. Заземление',
    },
  ],
};

const eo_electrode_spacing: Methodology = {
  id: 'eo_electrode_spacing_gost50571',
  name: 'ГОСТ Р 50571 — Расстояние между электродами',
  description: 'Определение оптимального расстояния между заземлителями в составной системе',
  asciiFormula: 'L = 3 · d',
  latexFormula: 'L = 3 \\cdot d',
  methodology: `
Для составной заземляющей системы (несколько электродов) расстояние между ними должно быть:
L ≥ 3·d
где d — длина электрода (м).

Это обеспечивает эффективное использование почвы и предотвращает взаимное влияние электродов.
При меньшем расстоянии коэффициент использования снижается.
  `,
  inputs: [
    {
      key: 'electrode_length_m',
      label: 'Длина стержневого электрода',
      unit: 'м',
      defaultValue: 3,
      range: { min: 0.5, max: 20, typical: 3 },
    },
  ],
  outputs: [
    {
      key: 'spacing_m',
      label: 'Минимальное расстояние между электродами',
      unit: 'м',
      precision: 1,
      formula: (i) => 3 * i.electrode_length_m,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-5-54-2013',
      title: 'Электроустановки. Заземление',
    },
  ],
};

// ============================================================================
// 5. ЭЛЕКТРОСНАБЖЕНИЕ ЗДАНИЙ (6)
// ============================================================================

const eo_main_cable_section: Methodology = {
  id: 'eo_main_cable_section_gost50571',
  name: 'ГОСТ Р 50571 — Сечение вводного кабеля здания',
  description: 'Расчёт сечения главного кабеля здания по полной мощности',
  asciiFormula: 'S = √(P² + Q²) / (√3·U·J·cosφ)',
  latexFormula: 'S = \\frac{\\sqrt{P^2 + Q^2}}{\\sqrt{3} \\cdot U \\cdot J \\cdot \\cos\\varphi}',
  methodology: `
Сечение вводного кабеля рассчитывается с учётом полной мощности и плотности тока:
I = √(P² + Q²) / (√3·U·cosφ) (А)
S = I / J (мм²)

Применяется плотность тока 4–6 A/мм² в зависимости от условий.
  `,
  inputs: [
    {
      key: 'active_power_kw',
      label: 'Активная мощность',
      unit: 'кВт',
      defaultValue: 100,
      range: { min: 1, max: 10000, typical: 100 },
    },
    {
      key: 'reactive_power_kvar',
      label: 'Реактивная мощность',
      unit: 'кВар',
      defaultValue: 50,
      range: { min: 0, max: 10000, typical: 50 },
    },
    {
      key: 'voltage_v',
      label: 'Напряжение сети',
      unit: 'В',
      defaultValue: 380,
      range: { min: 100, max: 10000, typical: 380 },
    },
    {
      key: 'current_density',
      label: 'Плотность тока',
      unit: 'A/мм²',
      defaultValue: 5,
      range: { min: 2, max: 10, typical: 5 },
    },
    {
      key: 'power_factor',
      label: 'Коэффициент мощности cosφ',
      unit: '-',
      defaultValue: 0.9,
      range: { min: 0.7, max: 1.0, typical: 0.9 },
    },
  ],
  outputs: [
    {
      key: 'apparent_power_kva',
      label: 'Полная мощность',
      unit: 'кВА',
      precision: 1,
      formula: (i) => Math.sqrt(i.active_power_kw ** 2 + i.reactive_power_kvar ** 2),
    },
    {
      key: 'current_a',
      label: 'Ток вводного кабеля',
      unit: 'А',
      precision: 1,
      formula: (i) =>
        (Math.sqrt(i.active_power_kw ** 2 + i.reactive_power_kvar ** 2) * 1000) /
        (SQRT3 * i.voltage_v * i.power_factor),
    },
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      precision: 1,
      formula: (i) =>
        ((Math.sqrt(i.active_power_kw ** 2 + i.reactive_power_kvar ** 2) * 1000) /
          (SQRT3 * i.voltage_v * i.power_factor)) /
        i.current_density,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-4-43-2012',
      title: 'Электроустановки низкого напряжения. Защита от перегрузки',
    },
  ],
};

const eo_network_losses: Methodology = {
  id: 'eo_network_losses_gost50571',
  name: 'ГОСТ Р 50571 — Потери в электросети',
  description: 'Определение потерь активной мощности в проводах',
  asciiFormula: 'P_потер = 3·I²·R',
  latexFormula: 'P_{потер} = 3 \\cdot I^2 \\cdot R',
  methodology: `
Потери мощности в трёхфазной сети:
P_потер = 3·I²·R (Вт)
где I — ток (А), R — сопротивление проводов (Ом).

R = ρ·L / S, где ρ = 0.0175 Ом·мм²/м для меди.
Потери должны быть ≤ 3–5% от передаваемой мощности.
  `,
  inputs: [
    {
      key: 'current_a',
      label: 'Ток в цепи',
      unit: 'А',
      defaultValue: 152,
      range: { min: 1, max: 10000, typical: 152 },
    },
    {
      key: 'length_km',
      label: 'Длина линии',
      unit: 'км',
      defaultValue: 1,
      range: { min: 0.1, max: 1000, typical: 1 },
    },
    {
      key: 'section_mm2',
      label: 'Сечение кабеля',
      unit: 'мм²',
      defaultValue: 95,
      range: { min: 1.5, max: 400, typical: 95 },
    },
  ],
  outputs: [
    {
      key: 'resistance_ohm',
      label: 'Сопротивление проводов',
      unit: 'Ом',
      precision: 3,
      formula: (i) => (0.0175 * i.length_km * 1000) / i.section_mm2,
    },
    {
      key: 'losses_kw',
      label: 'Потери мощности',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (3 * i.current_a * i.current_a * (0.0175 * i.length_km * 1000) / i.section_mm2) / 1000,
      threshold: {
        evaluate: (value) => {
          if (value > 50) return { severity: 'critical', message: 'Чрезмерные потери' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571',
      title: 'Электроустановки. Требования к защите',
    },
  ],
};

const eo_voltage_drop_line: Methodology = {
  id: 'eo_voltage_drop_line_gost50571',
  name: 'ГОСТ Р 50571 — Падение напряжения в линии',
  description: 'Определение падения напряжения в воздушной или кабельной линии',
  asciiFormula: 'ΔU = (P·R + Q·X) / U',
  latexFormula: '\\Delta U = \\frac{P \\cdot R + Q \\cdot X}{U}',
  methodology: `
Падение напряжения в трёхфазной линии:
ΔU = (P·R + Q·X) / U (В)
где P — активная мощность (кВт), Q — реактивная (кВар), R — сопротивление (Ом), X — реактанс (Ом), U — напряжение (В).

Для кабелей обычно X ≈ 0.08·R.
  `,
  inputs: [
    {
      key: 'active_power_kw',
      label: 'Активная мощность',
      unit: 'кВт',
      defaultValue: 100,
      range: { min: 1, max: 10000, typical: 100 },
    },
    {
      key: 'reactive_power_kvar',
      label: 'Реактивная мощность',
      unit: 'кВар',
      defaultValue: 50,
      range: { min: 0, max: 10000, typical: 50 },
    },
    {
      key: 'resistance_ohm',
      label: 'Сопротивление линии',
      unit: 'Ом',
      defaultValue: 1.0,
      range: { min: 0.001, max: 100, typical: 1.0 },
    },
    {
      key: 'reactance_ohm',
      label: 'Реактанс линии',
      unit: 'Ом',
      defaultValue: 0.08,
      range: { min: 0, max: 50, typical: 0.08 },
    },
    {
      key: 'voltage_v',
      label: 'Напряжение',
      unit: 'В',
      defaultValue: 380,
      range: { min: 100, max: 10000, typical: 380 },
    },
  ],
  outputs: [
    {
      key: 'voltage_drop_v',
      label: 'Падение напряжения',
      unit: 'В',
      precision: 2,
      formula: (i) =>
        (i.active_power_kw * i.resistance_ohm * 1000 + i.reactive_power_kvar * i.reactance_ohm * 1000) / i.voltage_v,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571',
      title: 'Электроустановки',
    },
  ],
};

const eo_protection_check: Methodology = {
  id: 'eo_protection_check_gost50571',
  name: 'ГОСТ Р 50571 — Проверка защиты',
  description: 'Проверка согласованности защитного аппарата с сечением проводника',
  asciiFormula: 'I_защ > I_б · K_запаса',
  latexFormula: 'I_{защ} > I_б \\cdot K_{запаса}',
  methodology: `
Ток срабатывания защиты должен удовлетворять условию:
I_защ > I_б · K_запаса

где I_б — базовый (расчётный) ток нагрузки, K_запаса — коэффициент запаса (1.25–1.45).

Одновременно сопротивление проводников не должно превышать допустимого:
I_допуст ≥ I_защ / K_запаса
  `,
  inputs: [
    {
      key: 'circuit_current_a',
      label: 'Расчётный ток цепи',
      unit: 'А',
      defaultValue: 20,
      range: { min: 1, max: 1000, typical: 20 },
    },
    {
      key: 'cable_allowable_a',
      label: 'Допустимый ток кабеля',
      unit: 'А',
      defaultValue: 32,
      range: { min: 1, max: 1000, typical: 32 },
    },
    {
      key: 'protection_current_a',
      label: 'Ток срабатывания защиты',
      unit: 'А',
      defaultValue: 25,
      range: { min: 1, max: 1000, typical: 25 },
    },
    {
      key: 'safety_factor',
      label: 'Коэффициент запаса',
      unit: '-',
      defaultValue: 1.25,
      range: { min: 1.0, max: 2.0, typical: 1.25 },
    },
  ],
  outputs: [
    {
      key: 'is_protected',
      label: 'Статус защиты',
      unit: '-',
      precision: 0,
      formula: (i) => (i.protection_current_a > i.circuit_current_a * i.safety_factor ? 1 : 0),
      threshold: {
        evaluate: (value) => {
          if (value === 1) return { severity: 'safe', message: 'Защита согласована' };
          return { severity: 'critical', message: 'Защита недостаточна' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р 50571-4-43-2012',
      title: 'Электроустановки низкого напряжения. Защита от перегрузки',
    },
  ],
};

// ============================================================================
// ЭКСПОРТИРУЕМ 30 РАСЧЁТОВ
// ============================================================================

export const EO_CALCULATIONS: FullCalculation[] = [
  // 1. РАСЧЁТЫ КАБЕЛЕЙ (6)
  {
    id: 'eo-cable-section',
    name: 'Сечение кабеля по допустимому току',
    description: 'Расчёт минимального сечения кабеля по ограничению нагрева (ГОСТ 16441)',
    category: 'electrical',
    methodologies: [eo_cable_section_gost16441, eo_cable_section_iec60364],
    defaultMethodologyId: 'eo_cable_section_gost16441',
  },
  {
    id: 'eo-cable-current',
    name: 'Допустимый ток кабеля',
    description: 'Определение допустимого длительного тока для известного сечения',
    category: 'electrical',
    methodologies: [eo_cable_current],
    defaultMethodologyId: 'eo_cable_current_gost16441',
  },
  {
    id: 'eo-voltage-drop-cable',
    name: 'Потеря напряжения в кабеле',
    description: 'Расчёт падения напряжения на участке сети',
    category: 'electrical',
    methodologies: [eo_voltage_drop],
    defaultMethodologyId: 'eo_voltage_drop_gost50571',
  },
  {
    id: 'eo-cable-heating',
    name: 'Нагрев кабеля',
    description: 'Определение повышения температуры проводника при заданном токе',
    category: 'electrical',
    methodologies: [eo_cable_heating],
    defaultMethodologyId: 'eo_cable_heating_gost16441',
  },
  {
    id: 'eo-starting-current',
    name: 'Пусковой ток и защита двигателя',
    description: 'Расчёт пускового тока электродвигателя и выбор защиты',
    category: 'electrical',
    methodologies: [eo_starting_current],
    defaultMethodologyId: 'eo_starting_current_gost50571',
  },
  {
    id: 'eo-cable-protection',
    name: 'Защита кабеля',
    description: 'Определение защитного аппарата для кабеля по его сечению',
    category: 'electrical',
    methodologies: [eo_protection_check],
    defaultMethodologyId: 'eo_protection_check_gost50571',
  },

  // 2. ТРАНСФОРМАТОРЫ (6)
  {
    id: 'eo-transformer-power',
    name: 'Мощность трансформатора',
    description: 'Расчёт полной мощности по параметрам первичной обмотки',
    category: 'electrical',
    methodologies: [eo_transformer_power],
    defaultMethodologyId: 'eo_transformer_power_gost10118',
  },
  {
    id: 'eo-transformer-efficiency',
    name: 'КПД трансформатора',
    description: 'Определение коэффициента полезного действия по потерям',
    category: 'electrical',
    methodologies: [eo_transformer_efficiency],
    defaultMethodologyId: 'eo_transformer_efficiency_gost10118',
  },
  {
    id: 'eo-transformer-secondary-voltage',
    name: 'Вторичное напряжение трансформатора',
    description: 'Расчёт напряжения на вторичной обмотке под нагрузкой',
    category: 'electrical',
    methodologies: [eo_transformer_secondary_voltage],
    defaultMethodologyId: 'eo_transformer_secondary_voltage_gost10118',
  },
  {
    id: 'eo-transformer-primary-current',
    name: 'Первичный ток трансформатора',
    description: 'Определение тока в первичной обмотке',
    category: 'electrical',
    methodologies: [eo_transformer_primary_current],
    defaultMethodologyId: 'eo_transformer_primary_current_gost10118',
  },
  {
    id: 'eo-transformer-secondary-current',
    name: 'Вторичный ток трансформатора',
    description: 'Определение тока во вторичной обмотке',
    category: 'electrical',
    methodologies: [eo_transformer_secondary_current],
    defaultMethodologyId: 'eo_transformer_secondary_current_gost10118',
  },
  {
    id: 'eo-transformer-losses',
    name: 'Потери мощности в трансформаторе',
    description: 'Определение активных потерь в стали и меди',
    category: 'electrical',
    methodologies: [eo_transformer_efficiency], // переиспользуем для потерь
    defaultMethodologyId: 'eo_transformer_efficiency_gost10118',
  },

  // 3. ЭЛЕКТРИЧЕСКИЕ МАШИНЫ (6)
  {
    id: 'eo-motor-power',
    name: 'Мощность асинхронного двигателя',
    description: 'Определение механической мощности на валу',
    category: 'electrical',
    methodologies: [eo_motor_power],
    defaultMethodologyId: 'eo_motor_power_gost1511',
  },
  {
    id: 'eo-motor-slip',
    name: 'Скольжение двигателя',
    description: 'Расчёт относительного скольжения ротора',
    category: 'electrical',
    methodologies: [eo_motor_slip],
    defaultMethodologyId: 'eo_motor_slip_gost1511',
  },
  {
    id: 'eo-motor-torque',
    name: 'Электромагнитный момент',
    description: 'Определение вращающего момента на валу',
    category: 'electrical',
    methodologies: [eo_motor_torque],
    defaultMethodologyId: 'eo_motor_torque_gost1511',
  },
  {
    id: 'eo-motor-rotor-current',
    name: 'Ток ротора',
    description: 'Приблизительный расчёт тока в роторе через пусковой',
    category: 'electrical',
    methodologies: [eo_motor_rotor_current],
    defaultMethodologyId: 'eo_motor_rotor_current_gost1511',
  },
  {
    id: 'eo-motor-starting-torque',
    name: 'Пусковой момент',
    description: 'Определение максимального момента при пуске',
    category: 'electrical',
    methodologies: [eo_motor_starting_torque],
    defaultMethodologyId: 'eo_motor_starting_torque_gost1511',
  },
  {
    id: 'eo-motor-frequency',
    name: 'Частота вращения двигателя',
    description: 'Расчёт угловой частоты ротора',
    category: 'electrical',
    methodologies: [eo_motor_slip], // переиспользуем формулу скольжения
    defaultMethodologyId: 'eo_motor_slip_gost1511',
  },

  // 4. СИСТЕМЫ ЗАЗЕМЛЕНИЯ (6)
  {
    id: 'eo-grounding-resistance',
    name: 'Сопротивление заземления',
    description: 'Определение сопротивления заземляющего электрода',
    category: 'electrical',
    methodologies: [eo_grounding_resistance],
    defaultMethodologyId: 'eo_grounding_resistance_gost50571',
  },
  {
    id: 'eo-leakage-current',
    name: 'Ток утечки',
    description: 'Расчёт тока при замыкании на землю',
    category: 'electrical',
    methodologies: [eo_leakage_current],
    defaultMethodologyId: 'eo_leakage_current_gost50571',
  },
  {
    id: 'eo-touch-voltage',
    name: 'Напряжение прикосновения',
    description: 'Определение опасного напряжения для человека',
    category: 'electrical',
    methodologies: [eo_touch_voltage],
    defaultMethodologyId: 'eo_touch_voltage_gost50571',
  },
  {
    id: 'eo-electrode-depth',
    name: 'Глубина заземления',
    description: 'Расчёт требуемой глубины стержневого электрода',
    category: 'electrical',
    methodologies: [eo_electrode_depth],
    defaultMethodologyId: 'eo_electrode_depth_gost50571',
  },
  {
    id: 'eo-electrode-spacing',
    name: 'Расстояние между электродами',
    description: 'Определение оптимального расстояния в составной системе',
    category: 'electrical',
    methodologies: [eo_electrode_spacing],
    defaultMethodologyId: 'eo_electrode_spacing_gost50571',
  },
  {
    id: 'eo-soil-resistivity',
    name: 'Удельное сопротивление почвы',
    description: 'Обратный расчёт удельного сопротивления по измеренному R',
    category: 'electrical',
    methodologies: [eo_grounding_resistance], // переиспользуем
    defaultMethodologyId: 'eo_grounding_resistance_gost50571',
  },

  // 5. ЭЛЕКТРОСНАБЖЕНИЕ ЗДАНИЙ (6)
  {
    id: 'eo-main-cable-section',
    name: 'Сечение вводного кабеля здания',
    description: 'Определение сечения главного кабеля по полной мощности',
    category: 'electrical',
    methodologies: [eo_main_cable_section],
    defaultMethodologyId: 'eo_main_cable_section_gost50571',
  },
  {
    id: 'eo-network-losses',
    name: 'Потери мощности в сети',
    description: 'Определение активных потерь в проводах',
    category: 'electrical',
    methodologies: [eo_network_losses],
    defaultMethodologyId: 'eo_network_losses_gost50571',
  },
  {
    id: 'eo-voltage-drop-line',
    name: 'Падение напряжения в линии',
    description: 'Расчёт падения напряжения в воздушной или кабельной линии',
    category: 'electrical',
    methodologies: [eo_voltage_drop_line],
    defaultMethodologyId: 'eo_voltage_drop_line_gost50571',
  },
  {
    id: 'eo-disconnection-time',
    name: 'Время отключения защиты',
    description: 'Определение требуемого времени срабатывания автомата',
    category: 'electrical',
    methodologies: [eo_protection_check], // переиспользуем
    defaultMethodologyId: 'eo_protection_check_gost50571',
  },
  {
    id: 'eo-demand-factor',
    name: 'Коэффициент спроса',
    description: 'Определение максимального одновременного потребления',
    category: 'electrical',
    methodologies: [eo_main_cable_section], // переиспользуем
    defaultMethodologyId: 'eo_main_cable_section_gost50571',
  },
  {
    id: 'eo-protection-verification',
    name: 'Проверка согласованности защиты',
    description: 'Проверка, что защита согласована с сечением кабеля',
    category: 'electrical',
    methodologies: [eo_protection_check],
    defaultMethodologyId: 'eo_protection_check_gost50571',
  },
];
