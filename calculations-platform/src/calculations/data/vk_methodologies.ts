import { FullCalculation, Methodology } from '../types';

/**
 * Фаза 4: VK — Водоснабжение и канализация (10 расчётов)
 * 2 категории × 5 расчётов
 * 1. Внутренний водопровод (5)
 * 2. Канализация (5)
 */

const PI = Math.PI;

// ============================================================================
// 1. ВНУТРЕННИЙ ВОДОПРОВОД (5)
// ============================================================================

const vk_diameter_snip_2_04_01: Methodology = {
  id: 'vk_diameter_snip_2_04_01',
  name: 'СНиП 2.04.01-85 — Диаметр по расходу и скорости',
  description: 'Определение диаметра трубопровода по расходу воды и допустимой скорости',
  asciiFormula: 'd = √(4·Q / (π·v))',
  latexFormula: 'd = \\sqrt{\\frac{4 \\cdot Q}{\\pi \\cdot v}}',
  methodology: `
Расчёт диаметра трубопровода по формуле непрерывности потока.
Для каждого типа трубопровода установлены допустимые скорости потока:
- Стояки холодного водоснабжения: 0.5–1.5 м/с (оптимально 0.8–1.2 м/с)
- Разводящие трубы: 0.3–0.7 м/с
- Подводки к приборам: 0.3–1.0 м/с

Формула: d = √(4·Q / (π·v))

где Q — объёмный расход (м³/ч), v — скорость потока (м/с), d — диаметр трубы (м).

Полученный диаметр округляется до стандартного значения.
  `,
  inputs: [
    {
      key: 'flow_rate_m3h',
      label: 'Расход воды',
      unit: 'м³/ч',
      defaultValue: 0.5,
      range: { min: 0.01, max: 100, typical: 0.5, hint: 'Объёмный расход в м³/ч' },
    },
    {
      key: 'flow_velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      defaultValue: 1.0,
      range: { min: 0.2, max: 2.0, typical: 1.0, hint: 'Обычно 0.5–1.5 м/с, оптимум 0.8–1.2' },
    },
  ],
  outputs: [
    {
      key: 'diameter_mm',
      label: 'Диаметр трубопровода',
      unit: 'мм',
      precision: 1,
      formula: (i) => {
        // Переводим м³/ч в м³/с: Q_m3s = Q / 3600
        const q_m3s = i.flow_rate_m3h / 3600;
        // d = √(4·Q / (π·v))
        const d_m = Math.sqrt((4 * q_m3s) / (PI * i.flow_velocity_ms));
        return d_m * 1000; // в мм
      },
      threshold: {
        evaluate: (_, inputs) => {
          if (inputs.flow_velocity_ms < 0.3) return { severity: 'warning', message: 'Скорость слишком низкая (риск осадков)' };
          if (inputs.flow_velocity_ms > 2.0) return { severity: 'warning', message: 'Скорость слишком высокая (шум, износ)' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
      clause: 'Раздел 3, Таблица 3',
      quote: 'Допустимые скорости потока в трубопроводах холодного водоснабжения',
    },
  ],
};

const vk_velocity_snip: Methodology = {
  id: 'vk_velocity_snip',
  name: 'СНиП 2.04.01-85 — Скорость потока в трубе',
  description: 'Определение скорости потока при известных расходе и диаметре',
  asciiFormula: 'v = 4·Q / (π·d²)',
  latexFormula: 'v = \\frac{4 \\cdot Q}{\\pi \\cdot d^2}',
  methodology: `
Обратный расчёт скорости потока в трубопроводе.
v = 4·Q / (π·d²)

где Q — расход (м³/с), d — диаметр (м), v — скорость (м/с).

Скорость потока является важным параметром: слишком низкая скорость приводит к
застаиванию и осадкам, слишком высокая — к шуму, износу и потерям давления.
  `,
  inputs: [
    {
      key: 'flow_rate_m3s',
      label: 'Расход воды',
      unit: 'м³/с',
      defaultValue: 0.0001,
      range: { min: 0.000001, max: 0.05, typical: 0.0001 },
    },
    {
      key: 'diameter_m',
      label: 'Диаметр трубы',
      unit: 'м',
      defaultValue: 0.02,
      range: { min: 0.005, max: 1.0, typical: 0.02 },
    },
  ],
  outputs: [
    {
      key: 'velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      precision: 2,
      formula: (i) => (4 * i.flow_rate_m3s) / (PI * i.diameter_m * i.diameter_m),
      threshold: {
        evaluate: (value) => {
          if (value < 0.3) return { severity: 'warning', message: 'Скорость слишком низкая — риск осадков' };
          if (value > 1.5) return { severity: 'warning', message: 'Скорость слишком высокая — шум и износ' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
      clause: 'Таблица 4',
    },
  ],
};

const vk_pressure_loss_darcy: Methodology = {
  id: 'vk_pressure_loss_darcy',
  name: 'СНиП 2.04.01 (Дарси-Вейсбах) — Потеря давления',
  description: 'Расчёт потери давления в трубопроводе по формуле Дарси-Вейсбаха',
  asciiFormula: 'ΔP = λ·(L/d)·(ρ·v²/2)',
  latexFormula: '\\Delta P = \\lambda \\cdot \\frac{L}{d} \\cdot \\frac{\\rho \\cdot v^2}{2}',
  methodology: `
Потеря давления в трубопроводе при ламинарном и турбулентном потоках.
ΔP = λ·(L/d)·(ρ·v²/2)

где λ — коэффициент трения Дарси, L — длина (м), d — диаметр (м),
ρ — плотность воды (1000 кг/м³), v — скорость (м/с).

Для стальных труб в воде при турбулентном течении: λ ≈ 0.02–0.03.
Для ПВХ/пластика: λ ≈ 0.015–0.025 (меньше из-за гладкости).

В простом случае используется усреднённое значение λ = 0.025–0.030.
  `,
  inputs: [
    {
      key: 'lambda',
      label: 'Коэффициент трения Дарси',
      unit: '-',
      defaultValue: 0.025,
      range: { min: 0.015, max: 0.04, typical: 0.025, hint: 'Сталь: 0.025–0.03; пластик: 0.015–0.025' },
    },
    {
      key: 'length_m',
      label: 'Длина трубопровода',
      unit: 'м',
      defaultValue: 50,
      range: { min: 1, max: 1000, typical: 50 },
    },
    {
      key: 'diameter_m',
      label: 'Диаметр трубы',
      unit: 'м',
      defaultValue: 0.02,
      range: { min: 0.005, max: 1.0, typical: 0.02 },
    },
    {
      key: 'velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      defaultValue: 1.0,
      range: { min: 0.1, max: 3.0, typical: 1.0 },
    },
  ],
  outputs: [
    {
      key: 'pressure_loss_pa',
      label: 'Потеря давления',
      unit: 'Па',
      precision: 0,
      formula: (i) => {
        const rho = 1000; // плотность воды кг/м³
        return i.lambda * (i.length_m / i.diameter_m) * (rho * i.velocity_ms * i.velocity_ms) / 2;
      },
    },
    {
      key: 'pressure_loss_bar',
      label: 'Потеря давления',
      unit: 'бар',
      precision: 2,
      formula: (i) => {
        const rho = 1000;
        const pa = i.lambda * (i.length_m / i.diameter_m) * (rho * i.velocity_ms * i.velocity_ms) / 2;
        return pa / 100000;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
      clause: 'Приложение К',
      quote: 'Потери давления в трубопроводах',
    },
  ],
};

const vk_end_pressure: Methodology = {
  id: 'vk_end_pressure',
  name: 'СНиП 2.04.01-85 — Давление в конечной точке',
  description: 'Определение давления в конце трубопровода с учётом потерь и подъёма',
  asciiFormula: 'P_конец = P_начало - ΔP - ρ·g·h',
  latexFormula: 'P_{конец} = P_{начало} - \\Delta P - \\rho \\cdot g \\cdot h',
  methodology: `
Давление в конечной точке трубопровода определяется с учётом:
1. Потерь давления на трение ΔP
2. Гидростатического давления при подъёме h

P_конец = P_начало - ΔP - ρ·g·h

где ρ = 1000 кг/м³, g = 9.81 м/с², h — высота подъёма (м).

Для холодного водопровода минимальное давление в точке потребления: 1–2 бара.
  `,
  inputs: [
    {
      key: 'pressure_start_pa',
      label: 'Давление в начале',
      unit: 'Па',
      defaultValue: 300000,
      range: { min: 100000, max: 1000000, typical: 300000, hint: '3 бара = 300 000 Па' },
    },
    {
      key: 'pressure_loss_pa',
      label: 'Потеря давления на трение',
      unit: 'Па',
      defaultValue: 50000,
      range: { min: 0, max: 200000, typical: 50000 },
    },
    {
      key: 'height_m',
      label: 'Высота подъёма',
      unit: 'м',
      defaultValue: 10,
      range: { min: 0, max: 100, typical: 10 },
    },
  ],
  outputs: [
    {
      key: 'pressure_end_pa',
      label: 'Давление в конце',
      unit: 'Па',
      precision: 0,
      formula: (i) => {
        const rho = 1000;
        const g = 9.81;
        return i.pressure_start_pa - i.pressure_loss_pa - rho * g * i.height_m;
      },
      threshold: {
        evaluate: (value) => {
          if (value < 100000) return { severity: 'critical', message: 'Давление недостаточно для водоснабжения' };
          if (value < 150000) return { severity: 'warning', message: 'Давление на нижнем пределе нормы' };
          return null;
        },
      },
    },
    {
      key: 'pressure_end_bar',
      label: 'Давление в конце',
      unit: 'бар',
      precision: 2,
      formula: (i) => {
        const rho = 1000;
        const g = 9.81;
        const pa = i.pressure_start_pa - i.pressure_loss_pa - rho * g * i.height_m;
        return pa / 100000;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
      clause: 'Раздел 3.5',
      quote: 'Обеспечение давления в точке потребления минимум 1–2 бара',
    },
  ],
};

const vk_diameter_fixed_velocity: Methodology = {
  id: 'vk_diameter_fixed_velocity',
  name: 'СНиП — Диаметр при заданной скорости',
  description: 'Обратный расчёт диаметра при известных расходе и желаемой скорости',
  asciiFormula: 'd = ∜(4·Q / (π·v))',
  latexFormula: 'd = \\sqrt{\\frac{4 \\cdot Q}{\\pi \\cdot v}}',
  methodology: `
Практическое применение стандартной формулы для подбора наиболее экономичного диаметра.
Задаётся желаемая скорость (обычно оптимальное значение 0.8–1.2 м/с) и рассчитывается
требуемый диаметр трубы.
  `,
  inputs: [
    {
      key: 'flow_rate_m3h',
      label: 'Расход воды',
      unit: 'м³/ч',
      defaultValue: 0.5,
      range: { min: 0.01, max: 100, typical: 0.5 },
    },
    {
      key: 'desired_velocity_ms',
      label: 'Желаемая скорость',
      unit: 'м/с',
      defaultValue: 1.0,
      range: { min: 0.3, max: 1.5, typical: 1.0, hint: 'Оптимум: 0.8–1.2 м/с' },
    },
  ],
  outputs: [
    {
      key: 'diameter_mm',
      label: 'Требуемый диаметр',
      unit: 'мм',
      precision: 1,
      formula: (i) => {
        const q_m3s = i.flow_rate_m3h / 3600;
        const d_m = Math.sqrt((4 * q_m3s) / (PI * i.desired_velocity_ms));
        return d_m * 1000;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
    },
  ],
};

// ============================================================================
// 2. КАНАЛИЗАЦИЯ (5)
// ============================================================================

const vk_sewer_diameter_manning: Methodology = {
  id: 'vk_sewer_diameter_manning',
  name: 'СНиП 2.04.03 (Маннинг) — Диаметр при заданном уклоне',
  description: 'Расчёт диаметра самотечного канализационного трубопровода по формуле Маннинга',
  asciiFormula: 'd = ∛(Q·n / (π/4·√i))',
  latexFormula: 'd = \\sqrt[3]{\\frac{Q \\cdot n}{\\frac{\\pi}{4} \\cdot \\sqrt{i}}}',
  methodology: `
Для самотечной канализации используется формула Маннинга (Шези):
v = (1/n)·R^(2/3)·√i

где n — коэффициент шероховатости, R — гидравлический радиус, i — уклон.

Для круглой трубы диаметром d, заполненной на h:
R ≈ d/4 при полном заполнении.

Упрощённая формула для практики:
d ≈ ∛(Q·n / (k·√i))

где k — коэффициент пропускной способности, n = 0.012–0.015 для бетонных труб.

Минимальный уклон: i_мин = 0.003 (0.3%), максимальный: i_макс = 0.15 (15%).
Оптимальный уклон: 0.005–0.01.
  `,
  inputs: [
    {
      key: 'flow_rate_m3s',
      label: 'Расход сточных вод',
      unit: 'м³/с',
      defaultValue: 0.01,
      range: { min: 0.001, max: 1.0, typical: 0.01 },
    },
    {
      key: 'manning_n',
      label: 'Коэффициент Маннинга',
      unit: '-',
      defaultValue: 0.013,
      range: { min: 0.010, max: 0.020, typical: 0.013, hint: 'Бетон: 0.012–0.015; пластик: 0.010–0.013' },
    },
    {
      key: 'slope',
      label: 'Уклон трубопровода',
      unit: '-',
      defaultValue: 0.005,
      range: { min: 0.003, max: 0.15, typical: 0.005, hint: '0.5% = 0.005; 1% = 0.01' },
    },
  ],
  outputs: [
    {
      key: 'diameter_mm',
      label: 'Диаметр трубы',
      unit: 'мм',
      precision: 0,
      formula: (i) => {
        // Упрощённая формула: d = ∛(Q·n / (k·√i)), где k ≈ 0.312
        const d_m = Math.cbrt((i.flow_rate_m3s * i.manning_n) / (0.312 * Math.sqrt(i.slope)));
        return d_m * 1000;
      },
      threshold: {
        evaluate: (_, inputs) => {
          if (inputs.slope < 0.003) return { severity: 'warning', message: 'Уклон ниже минимума — риск застаивания' };
          if (inputs.slope > 0.15) return { severity: 'warning', message: 'Слишком крутой уклон — эрозия' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.03-85',
      title: 'Наружные сети и сооружения водоснабжения и канализации',
      clause: 'Раздел 6.2',
      quote: 'Расчёт пропускной способности самотечных трубопроводов',
    },
  ],
};

const vk_sewer_slope: Methodology = {
  id: 'vk_sewer_slope',
  name: 'СНиП 2.04.03 — Требуемый уклон',
  description: 'Определение минимального уклона для обеспечения гравитационного стока',
  asciiFormula: 'i = (Q·n)² / (d^5·K²)',
  latexFormula: 'i = \\frac{(Q \\cdot n)^2}{d^5 \\cdot K^2}',
  methodology: `
Расчёт минимального уклона, обеспечивающего скорость потока не менее 0.3 м/с
и предотвращающего отложение осадков.

СНиП устанавливает:
- Минимальный уклон для бытовой канализации: 0.003 (0.3%)
- Минимальный уклон для стояков: 0.01 (1%)
- Для диаметра > 150 мм: минимум 0.002

Практически используются стандартные уклоны: 0.5%, 1%, 1.5%, 2%.
  `,
  inputs: [
    {
      key: 'flow_rate_m3s',
      label: 'Расход',
      unit: 'м³/с',
      defaultValue: 0.01,
      range: { min: 0.001, max: 1.0, typical: 0.01 },
    },
    {
      key: 'diameter_mm',
      label: 'Диаметр трубы',
      unit: 'мм',
      defaultValue: 150,
      range: { min: 50, max: 600, typical: 150 },
    },
  ],
  outputs: [
    {
      key: 'slope',
      label: 'Требуемый уклон',
      unit: '-',
      precision: 5,
      formula: (i) => {
        const n = 0.013; // коэффициент Маннинга
        const K = 0.312; // пропускная способность
        const d_m = i.diameter_mm / 1000;
        return (i.flow_rate_m3s * n * i.flow_rate_m3s * n) / (Math.pow(d_m, 5) * K * K);
      },
    },
    {
      key: 'slope_percent',
      label: 'Уклон',
      unit: '%',
      precision: 2,
      formula: (i) => {
        const n = 0.013;
        const K = 0.312;
        const d_m = i.diameter_mm / 1000;
        const slope = (i.flow_rate_m3s * n * i.flow_rate_m3s * n) / (Math.pow(d_m, 5) * K * K);
        return slope * 100;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.03-85',
      title: 'Наружные сети и сооружения водоснабжения и канализации',
      clause: 'Раздел 6.3',
    },
  ],
};

const vk_sewer_velocity: Methodology = {
  id: 'vk_sewer_velocity',
  name: 'СНиП 2.04.03 — Скорость в канализационной трубе',
  description: 'Расчёт скорости потока в самотечном трубопроводе по формуле Маннинга',
  asciiFormula: 'v = (1/n)·(d/4)^(2/3)·√i',
  latexFormula: 'v = \\frac{1}{n} \\cdot \\left(\\frac{d}{4}\\right)^{2/3} \\cdot \\sqrt{i}',
  methodology: `
Формула Маннинга для определения скорости потока в круглом трубопроводе:
v = (1/n)·R^(2/3)·√i

где R = d/4 — гидравлический радиус для полного заполнения.

Требования СНиП:
- Минимальная скорость: 0.3 м/с (предотвращение осадков)
- Максимальная скорость: 3.0–4.0 м/с (предотвращение эрозии)
  `,
  inputs: [
    {
      key: 'diameter_mm',
      label: 'Диаметр трубы',
      unit: 'мм',
      defaultValue: 150,
      range: { min: 50, max: 600, typical: 150 },
    },
    {
      key: 'slope',
      label: 'Уклон',
      unit: '-',
      defaultValue: 0.005,
      range: { min: 0.002, max: 0.15, typical: 0.005 },
    },
    {
      key: 'manning_n',
      label: 'Коэффициент Маннинга',
      unit: '-',
      defaultValue: 0.013,
      range: { min: 0.010, max: 0.020, typical: 0.013 },
    },
  ],
  outputs: [
    {
      key: 'velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      precision: 2,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const R = d_m / 4;
        return (1 / i.manning_n) * Math.pow(R, 2 / 3) * Math.sqrt(i.slope);
      },
      threshold: {
        evaluate: (value) => {
          if (value < 0.3) return { severity: 'warning', message: 'Слишком низкая скорость — риск осадков' };
          if (value > 3.0) return { severity: 'warning', message: 'Слишком высокая скорость — эрозия' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.03-85',
      title: 'Наружные сети и сооружения водоснабжения и канализации',
      clause: 'Таблица 5',
    },
  ],
};

const vk_filling_time: Methodology = {
  id: 'vk_filling_time',
  name: 'СНиП — Время заполнения резервуара',
  description: 'Расчёт времени заполнения ёмкости при известном расходе',
  asciiFormula: 't = V / Q',
  latexFormula: 't = \\frac{V}{Q}',
  methodology: `
Простой расчёт времени заполнения ёмкости (резервуара, отстойника):
t = V / Q

где V — объём (м³), Q — расход (м³/ч или м³/с), t — время (ч или с).

Используется при проектировании накопительных ёмкостей и регулирующих резервуаров.
  `,
  inputs: [
    {
      key: 'volume_m3',
      label: 'Объём ёмкости',
      unit: 'м³',
      defaultValue: 10,
      range: { min: 0.1, max: 10000, typical: 10 },
    },
    {
      key: 'flow_rate_m3h',
      label: 'Расход',
      unit: 'м³/ч',
      defaultValue: 2,
      range: { min: 0.01, max: 1000, typical: 2 },
    },
  ],
  outputs: [
    {
      key: 'filling_time_h',
      label: 'Время заполнения',
      unit: 'ч',
      precision: 2,
      formula: (i) => i.volume_m3 / i.flow_rate_m3h,
    },
    {
      key: 'filling_time_min',
      label: 'Время заполнения',
      unit: 'мин',
      precision: 1,
      formula: (i) => (i.volume_m3 / i.flow_rate_m3h) * 60,
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.03-85',
      title: 'Наружные сети и сооружения водоснабжения и канализации',
      clause: 'Раздел 6.7',
    },
  ],
};

const vk_discharge_capacity: Methodology = {
  id: 'vk_discharge_capacity',
  name: 'СНиП — Пропускная способность трубы',
  description: 'Расчёт максимального расхода при известных диаметре, уклоне и скорости',
  asciiFormula: 'Q = v·(π·d²/4)',
  latexFormula: 'Q = v \\cdot \\frac{\\pi \\cdot d^2}{4}',
  methodology: `
Пропускная способность трубопровода определяется по формуле непрерывности потока:
Q = v·A = v·(π·d²/4)

где v — скорость потока (м/с), d — диаметр (м), Q — расход (м³/с).

Для полного использования пропускной способности скорость должна быть в пределах 0.3–3.0 м/с.

Также используется формула Маннинга:
Q_макс = (π/4)·d^(8/3)·(1/n)·√i / d^(2/3)
  `,
  inputs: [
    {
      key: 'diameter_mm',
      label: 'Диаметр трубы',
      unit: 'мм',
      defaultValue: 150,
      range: { min: 50, max: 600, typical: 150 },
    },
    {
      key: 'velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      defaultValue: 0.8,
      range: { min: 0.1, max: 4.0, typical: 0.8 },
    },
  ],
  outputs: [
    {
      key: 'discharge_m3s',
      label: 'Пропускная способность',
      unit: 'м³/с',
      precision: 4,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        return i.velocity_ms * (PI * d_m * d_m) / 4;
      },
    },
    {
      key: 'discharge_m3h',
      label: 'Пропускная способность',
      unit: 'м³/ч',
      precision: 2,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const q_m3s = i.velocity_ms * (PI * d_m * d_m) / 4;
        return q_m3s * 3600;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.04.03-85',
      title: 'Наружные сети и сооружения водоснабжения и канализации',
      clause: 'Раздел 6.2',
    },
  ],
};

// ============================================================================
// ЭКСПОРТ РАСЧЁТОВ VK
// ============================================================================

export const VK_CALCULATIONS: FullCalculation[] = [
  // 1. ВНУТРЕННИЙ ВОДОПРОВОД (5)
  {
    id: 'vk-internal-diameter',
    name: 'Диаметр внутреннего водопровода',
    description: 'Определение диаметра трубопровода по расходу и допустимой скорости',
    category: 'water_supply',
    methodologies: [vk_diameter_snip_2_04_01],
    defaultMethodologyId: 'vk_diameter_snip_2_04_01',
  },
  {
    id: 'vk-flow-velocity',
    name: 'Скорость потока в трубе',
    description: 'Расчёт скорости потока при известных расходе и диаметре',
    category: 'water_supply',
    methodologies: [vk_velocity_snip],
    defaultMethodologyId: 'vk_velocity_snip',
  },
  {
    id: 'vk-pressure-loss',
    name: 'Потеря давления в трубопроводе',
    description: 'Расчёт потерь давления по формуле Дарси-Вейсбаха',
    category: 'water_supply',
    methodologies: [vk_pressure_loss_darcy],
    defaultMethodologyId: 'vk_pressure_loss_darcy',
  },
  {
    id: 'vk-end-pressure',
    name: 'Давление в конечной точке',
    description: 'Определение давления с учётом потерь и подъёма',
    category: 'water_supply',
    methodologies: [vk_end_pressure],
    defaultMethodologyId: 'vk_end_pressure',
  },
  {
    id: 'vk-diameter-optimized',
    name: 'Диаметр при оптимальной скорости',
    description: 'Подбор диаметра для минимизации потерь и шума',
    category: 'water_supply',
    methodologies: [vk_diameter_fixed_velocity],
    defaultMethodologyId: 'vk_diameter_fixed_velocity',
  },

  // 2. КАНАЛИЗАЦИЯ (5)
  {
    id: 'vk-sewer-diameter',
    name: 'Диаметр самотечного трубопровода',
    description: 'Расчёт диаметра канализационной трубы по формуле Маннинга',
    category: 'sewerage',
    methodologies: [vk_sewer_diameter_manning],
    defaultMethodologyId: 'vk_sewer_diameter_manning',
  },
  {
    id: 'vk-sewer-slope',
    name: 'Требуемый уклон канализации',
    description: 'Определение минимального уклона для гравитационного стока',
    category: 'sewerage',
    methodologies: [vk_sewer_slope],
    defaultMethodologyId: 'vk_sewer_slope',
  },
  {
    id: 'vk-sewer-velocity',
    name: 'Скорость в канализационной трубе',
    description: 'Расчёт скорости потока в самотечном трубопроводе',
    category: 'sewerage',
    methodologies: [vk_sewer_velocity],
    defaultMethodologyId: 'vk_sewer_velocity',
  },
  {
    id: 'vk-filling-time',
    name: 'Время заполнения ёмкости',
    description: 'Расчёт времени заполнения резервуара при известном расходе',
    category: 'sewerage',
    methodologies: [vk_filling_time],
    defaultMethodologyId: 'vk_filling_time',
  },
  {
    id: 'vk-discharge-capacity',
    name: 'Пропускная способность трубы',
    description: 'Определение максимального расхода при известных параметрах',
    category: 'sewerage',
    methodologies: [vk_discharge_capacity],
    defaultMethodologyId: 'vk_discharge_capacity',
  },
];
