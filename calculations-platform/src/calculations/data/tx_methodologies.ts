import { FullCalculation, Methodology } from '../types';

/**
 * Фаза 1: TX — Тепловые системы (2 расчёта)
 * - tx_heat_balance: Тепловая мощность (нагрев/охлаждение)
 * - tt_pressure_drop: Потери давления (Дарси-Вейсбах)
 */

// ===== РАСЧЁТ 1: ТЕПЛОВАЯ МОЩНОСТЬ (НАГРЕВ/ОХЛАЖДЕНИЕ) =====

const tx_heat_balance_methodology_gost: Methodology = {
  id: 'tx_heat_balance_gost32569',
  name: 'ГОСТ 32569-2022 (упрощённая методика)',
  description: 'Метод расчёта по приведённому коэффициенту теплопередачи для быстрой оценки установленной мощности',
  asciiFormula: 'Q = A · ΔT · U + V · n · ΔT · 0.34 / 1000',
  latexFormula: 'Q = \\frac{A \\cdot \\Delta T \\cdot U + V \\cdot n \\cdot \\Delta T \\cdot 0{.}34}{1000}',
  methodology: `
Расчёт состоит из двух компонентов:
1) Трансмиссионные потери: Q_тр = A × ΔT × U
   где A — отапливаемая площадь (м²), ΔT — расчётная разность температур (°С), U — приведённый коэффициент теплопередачи (Вт/(м²·К))
2) Затраты на вентиляцию: Q_вент = V × n × ΔT × 0.34 / 1000
   где V — объём помещения (м³), n — кратность воздухообмена (ч⁻¹), 0.34 — теплоёмкость воздуха (кВт·ч/(м³·°С))

Итоговая мощность: Q = Q_тр + Q_вент (кВт)

Метод ГОСТ 32569 предназначен для первичной оценки и проектирования систем отопления жилых и общественных зданий.
  `,
  inputs: [
    {
      key: 'area',
      label: 'Отапливаемая площадь',
      unit: 'м²',
      defaultValue: 1000,
      range: {
        min: 10,
        max: 100000,
        typical: 1000,
        hint: 'Сумма площадей отапливаемых помещений по внутреннему обмеру',
        warningBelow: 30,
      },
    },
    {
      key: 'deltaT',
      label: 'Расчётная разность температур',
      unit: '°С',
      defaultValue: 40,
      range: {
        min: 10,
        max: 70,
        typical: 40,
        hint: 'tв − tн.р. (внутр. +20 °С минус расчётная наружная для региона)',
        warningBelow: 20,
        warningAbove: 60,
      },
    },
    {
      key: 'uValue',
      label: 'Приведённый коэффициент теплопередачи',
      unit: 'Вт/(м²·К)',
      defaultValue: 0.5,
      range: {
        min: 0.1,
        max: 3.0,
        typical: 0.4,
        hint: 'Для современных энергоэффективных зданий 0.2–0.4; для старого фонда 1.0–2.0',
        warningAbove: 1.5,
      },
    },
    {
      key: 'volume',
      label: 'Отапливаемый объём',
      unit: 'м³',
      defaultValue: 3000,
      range: {
        min: 30,
        max: 500000,
        typical: 3000,
        hint: 'Произведение площади на среднюю высоту этажей',
      },
    },
    {
      key: 'airChanges',
      label: 'Кратность воздухообмена',
      unit: 'ч⁻¹',
      defaultValue: 0.5,
      range: {
        min: 0.1,
        max: 5,
        typical: 0.7,
        hint: 'Жильё: 0.5–1.0; офис: 1.0–2.0; общественные: 2.0–4.0',
        warningAbove: 3,
      },
    },
  ],
  outputs: [
    {
      key: 'transmission',
      label: 'Трансмиссионные теплопотери',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.area * i.deltaT * i.uValue) / 1000,
      description: 'Потери через стены, кровлю, окна, перекрытия',
    },
    {
      key: 'ventilation',
      label: 'Затраты на нагрев вентиляции',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.volume * i.airChanges * i.deltaT * 0.34) / 1000,
      description: 'Тепло на нагрев приточного и инфильтрационного воздуха',
    },
    {
      key: 'total',
      label: 'Установленная тепловая мощность',
      unit: 'кВт',
      precision: 2,
      formula: (i) =>
        (i.area * i.deltaT * i.uValue + i.volume * i.airChanges * i.deltaT * 0.34) / 1000,
      threshold: {
        evaluate: (value, i) => {
          const specific = (value * 1000) / i.area;
          if (specific > 150)
            return {
              severity: 'critical',
              message: `Удельная нагрузка ${specific.toFixed(0)} Вт/м² — выше норматива для современных зданий (≤100 Вт/м²)`,
            };
          if (specific > 100)
            return {
              severity: 'warning',
              message: `Удельная нагрузка ${specific.toFixed(0)} Вт/м² — характерно для старого фонда`,
            };
          return {
            severity: 'safe',
            message: `Удельная нагрузка ${specific.toFixed(0)} Вт/м² — в норме для современного здания`,
          };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 32569-2022',
      title: 'Трубопроводы стальные теплоэнергетические. Общие технические условия',
      clause: 'Приложение А',
      quote: 'Методика расчёта установленной мощности отопления по приведённому коэффициенту теплопередачи',
    },
    {
      code: 'СП 50.13330.2012',
      title: 'Тепловая защита зданий (актуализация СНиП 23-02-2003)',
      clause: 'п. 5.1',
      quote: 'Нормируемые значения сопротивления теплопередаче ограждающих конструкций',
    },
  ],
};

const tx_heat_balance_methodology_sp: Methodology = {
  id: 'tx_heat_balance_sp60',
  name: 'СП 60.13330.2020 (детальная методика)',
  description: 'Метод расчёта по отдельным ограждающим конструкциям с учётом их площадей и коэффициентов теплопередачи',
  asciiFormula: 'Q = Σ(Ai × Ui × ΔT) + (V × n × ρ × c × ΔT)',
  latexFormula: 'Q = \\sum (A_i \\cdot U_i \\cdot \\Delta T) + (V \\cdot n \\cdot \\rho \\cdot c \\cdot \\Delta T)',
  methodology: `
Детальный расчёт по отдельным конструкциям:
1) Трансмиссионные потери рассчитываются для каждой ограждающей конструкции отдельно:
   Q_тр = Σ(Ai × Ui × ΔT) + Σ(Pj × Ψj × ΔT)
   где Ai — площадь i-ой конструкции (м²), Ui — коэффициент теплопередачи (Вт/(м²·К)),
   Pj — длина j-ого теплового моста (м), Ψj — линейный коэффициент теплопередачи (Вт/(м·К))

2) Потери на вентиляцию:
   Q_вент = V × n × ρ × c × ΔT / 3600
   где ρ — плотность воздуха (~1.2 кг/м³), c — удельная теплоёмкость (~1000 Дж/(кг·К))

Метод СП используется при разработке проектов и требует более полной информации об ограждающих конструкциях.
  `,
  inputs: [
    {
      key: 'walls_area',
      label: 'Площадь наружных стен',
      unit: 'м²',
      defaultValue: 400,
      range: {
        min: 10,
        max: 10000,
        typical: 400,
        hint: 'Площадь наружных стен по внешним размерам',
      },
    },
    {
      key: 'walls_u',
      label: 'Коэффициент теплопередачи стен',
      unit: 'Вт/(м²·К)',
      defaultValue: 0.25,
      range: {
        min: 0.1,
        max: 1.0,
        typical: 0.25,
        hint: 'Для современной теплоизоляции: 0.15–0.30 Вт/(м²·К)',
      },
    },
    {
      key: 'windows_area',
      label: 'Площадь окон',
      unit: 'м²',
      defaultValue: 150,
      range: {
        min: 10,
        max: 2000,
        typical: 150,
        hint: 'Общая площадь оконных проёмов',
      },
    },
    {
      key: 'windows_u',
      label: 'Коэффициент теплопередачи окон',
      unit: 'Вт/(м²·К)',
      defaultValue: 1.2,
      range: {
        min: 0.8,
        max: 3.0,
        typical: 1.2,
        hint: 'Двойное остекление: 1.1–1.5; тройное: 0.7–1.0 Вт/(м²·К)',
      },
    },
    {
      key: 'roof_area',
      label: 'Площадь кровли (потолка верхнего этажа)',
      unit: 'м²',
      defaultValue: 250,
      range: {
        min: 10,
        max: 5000,
        typical: 250,
        hint: 'Площадь кровельного перекрытия',
      },
    },
    {
      key: 'roof_u',
      label: 'Коэффициент теплопередачи кровли',
      unit: 'Вт/(м²·К)',
      defaultValue: 0.18,
      range: {
        min: 0.1,
        max: 0.8,
        typical: 0.18,
        hint: 'Современная кровля с теплоизоляцией: 0.15–0.25 Вт/(м²·К)',
      },
    },
    {
      key: 'floor_area',
      label: 'Площадь пола на земле / над неотапливаемым подвалом',
      unit: 'м²',
      defaultValue: 250,
      range: {
        min: 0,
        max: 5000,
        typical: 250,
        hint: 'Если здание на сваях или утеплённом фундаменте, используйте 0',
      },
    },
    {
      key: 'floor_u',
      label: 'Коэффициент теплопередачи пола',
      unit: 'Вт/(м²·К)',
      defaultValue: 0.4,
      range: {
        min: 0.2,
        max: 2.0,
        typical: 0.4,
        hint: 'По земле: 0.3–0.5; над неотапливаемым подвалом: 0.5–1.0 Вт/(м²·К)',
      },
    },
    {
      key: 'deltaT',
      label: 'Расчётная разность температур',
      unit: '°С',
      defaultValue: 40,
      range: {
        min: 10,
        max: 70,
        typical: 40,
        hint: 'Внутренняя (+20 °С) минус расчётная наружная',
      },
    },
    {
      key: 'volume',
      label: 'Отапливаемый объём',
      unit: 'м³',
      defaultValue: 3000,
      range: {
        min: 100,
        max: 500000,
        typical: 3000,
        hint: 'Общий объём отапливаемых помещений',
      },
    },
    {
      key: 'airChanges',
      label: 'Кратность воздухообмена',
      unit: 'ч⁻¹',
      defaultValue: 0.7,
      range: {
        min: 0.3,
        max: 3,
        typical: 0.7,
        hint: 'Инфильтрация и естественная вентиляция',
      },
    },
  ],
  outputs: [
    {
      key: 'walls_loss',
      label: 'Потери через стены',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.walls_area * i.walls_u * i.deltaT) / 1000,
    },
    {
      key: 'windows_loss',
      label: 'Потери через окна',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.windows_area * i.windows_u * i.deltaT) / 1000,
    },
    {
      key: 'roof_loss',
      label: 'Потери через кровлю',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.roof_area * i.roof_u * i.deltaT) / 1000,
    },
    {
      key: 'floor_loss',
      label: 'Потери через пол',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.floor_area * i.floor_u * i.deltaT) / 1000,
    },
    {
      key: 'transmission_total',
      label: 'Всего трансмиссионных потерь',
      unit: 'кВт',
      precision: 2,
      formula: (i) =>
        ((i.walls_area * i.walls_u +
          i.windows_area * i.windows_u +
          i.roof_area * i.roof_u +
          i.floor_area * i.floor_u) *
          i.deltaT) /
        1000,
    },
    {
      key: 'ventilation',
      label: 'Потери на вентиляцию',
      unit: 'кВт',
      precision: 2,
      formula: (i) => (i.volume * i.airChanges * i.deltaT * 0.34) / 1000,
    },
    {
      key: 'total',
      label: 'Установленная мощность отопления',
      unit: 'кВт',
      precision: 2,
      formula: (i) =>
        ((i.walls_area * i.walls_u +
          i.windows_area * i.windows_u +
          i.roof_area * i.roof_u +
          i.floor_area * i.floor_u) *
          i.deltaT +
          i.volume * i.airChanges * i.deltaT * 0.34) /
        1000,
    },
  ],
  normativeRefs: [
    {
      code: 'СП 60.13330.2020',
      title: 'Отопление, вентиляция и кондиционирование воздуха. Актуализированная редакция СНиП 41-01-2003',
      clause: 'п. 6.2.1–6.2.3',
      quote: 'Расчёт потерь тепла через отдельные ограждающие конструкции',
    },
    {
      code: 'СП 50.13330.2012',
      title: 'Тепловая защита зданий',
      clause: 'п. 4.2–4.4',
      quote: 'Требуемые коэффициенты теплопередачи ограждающих конструкций по регионам',
    },
  ],
};

export const TX_HEAT_BALANCE: FullCalculation = {
  id: 'tx_heat_balance',
  name: '🔥 Тепловая мощность (Нагрев/Охлаждение)',
  description: 'Определение установленной тепловой мощности системы отопления на основе теплопотерь здания',
  category: 'thermal',
  methodologies: [tx_heat_balance_methodology_gost, tx_heat_balance_methodology_sp],
  defaultMethodologyId: 'tx_heat_balance_gost32569',
  warnings: [
    'Расчёт является приблизительным и предназначен для первичной оценки',
    'Для точного определения требуется энергетический паспорт здания',
    'Не учитывает внутренние источники тепла (люди, оборудование)',
  ],
  keywords: ['отопление', 'охлаждение', 'тепловая мощность', 'теплопотери', 'энергетика'],
};

// ===== РАСЧЁТ 2: ПОТЕРИ ДАВЛЕНИЯ (ДАРСИ-ВЕЙСБАХ) =====

const tt_pressure_drop_methodology_darcy: Methodology = {
  id: 'tt_pressure_drop_darcy',
  name: 'Дарси–Вейсбах (универсальная методика)',
  description: 'Расчёт потерь давления в трубопроводе на основе формулы Дарси-Вейсбах для произвольных условий потока',
  asciiFormula: 'ΔP = λ · (L/D) · (ρ · v²) / 2',
  latexFormula: '\\Delta P = \\lambda \\cdot \\frac{L}{D} \\cdot \\frac{\\rho \\cdot v^2}{2}',
  methodology: `
Формула Дарси-Вейсбах рассчитывает потери давления на трение в трубе:
ΔP = λ × (L/D) × (ρ × v²) / 2

Параметры:
- λ (lambda) — коэффициент трения (зависит от режима потока и шероховатости)
- L — длина трубопровода (м)
- D — диаметр трубы (м)
- ρ — плотность жидкости (кг/м³)
- v — скорость потока (м/с)

Режим потока определяется по числу Рейнольдса:
Re = (v × D × ρ) / μ
где μ — динамическая вязкость (Па·с)

Режимы:
- Re < 2300: ламинарный (λ = 64 / Re)
- 2300 < Re < 4000: переходной (интерполяция)
- Re > 4000: турбулентный (формула Блазиуса, Халанда или Мигрель)

Для турбулентного режима используется диаграмма Муди (зависит от относительной шероховатости).

Метод применим для любых жидкостей и газов при условии известных физических свойств.
  `,
  inputs: [
    {
      key: 'diameter_mm',
      label: 'Внутренний диаметр трубы',
      unit: 'мм',
      defaultValue: 50,
      range: {
        min: 5,
        max: 1000,
        typical: 50,
        hint: 'Номинальный диаметр или фактический внутренний диаметр',
      },
    },
    {
      key: 'length_m',
      label: 'Длина участка трубопровода',
      unit: 'м',
      defaultValue: 100,
      range: {
        min: 1,
        max: 10000,
        typical: 100,
        hint: 'Расстояние по оси трубы',
      },
    },
    {
      key: 'velocity_ms',
      label: 'Скорость потока',
      unit: 'м/с',
      defaultValue: 1.5,
      range: {
        min: 0.1,
        max: 10,
        typical: 1.5,
        hint: 'Рекомендуемые скорости: вода 0.6–2.0 м/с, пар 20–50 м/с',
        warningBelow: 0.3,
        warningAbove: 5,
      },
    },
    {
      key: 'density_kgm3',
      label: 'Плотность жидкости',
      unit: 'кг/м³',
      defaultValue: 1000,
      range: {
        min: 100,
        max: 10000,
        typical: 1000,
        hint: 'Вода ~1000, масло ~900, пар ~20 кг/м³ (при 100 °С и 1 атм)',
      },
    },
    {
      key: 'roughness_mm',
      label: 'Абсолютная шероховатость материала',
      unit: 'мм',
      defaultValue: 0.045,
      range: {
        min: 0.001,
        max: 1.0,
        typical: 0.045,
        hint: 'Сталь коммерч. 0.045–0.09; медь 0.0015; пластик 0.001–0.003 мм',
      },
    },
    {
      key: 'viscosity_pa_s',
      label: 'Динамическая вязкость',
      unit: 'Па·с',
      defaultValue: 0.001,
      range: {
        min: 0.0000001,
        max: 1,
        typical: 0.001,
        hint: 'Вода 20 °С: 0.001 Па·с; масло: 0.01–0.1 Па·с; пар: ~0.000015 Па·с',
      },
    },
  ],
  outputs: [
    {
      key: 'reynolds',
      label: 'Число Рейнольдса',
      unit: 'безразмерно',
      precision: 0,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        return (i.velocity_ms * d_m * i.density_kgm3) / i.viscosity_pa_s;
      },
    },
    {
      key: 'regime',
      label: 'Режим потока',
      unit: 'текст',
      precision: 0,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const re = (i.velocity_ms * d_m * i.density_kgm3) / i.viscosity_pa_s;
        if (re < 2300) return 0; // ламинарный
        if (re < 4000) return 1; // переходной
        return 2; // турбулентный
      },
      description: '0=ламинарный, 1=переходной, 2=турбулентный',
    },
    {
      key: 'friction_coeff',
      label: 'Коэффициент трения λ',
      unit: 'безразмерно',
      precision: 4,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const re = (i.velocity_ms * d_m * i.density_kgm3) / i.viscosity_pa_s;

        if (re < 2300) {
          // Ламинарный: λ = 64 / Re
          return 64 / re;
        } else if (re < 4000) {
          // Переходной: интерполяция
          const lambda_lam = 64 / 2300;
          const lambda_turb = 0.316 / Math.pow(re, 0.25); // Блазиус
          const factor = (re - 2300) / (4000 - 2300);
          return lambda_lam + (lambda_turb - lambda_lam) * factor;
        } else {
          // Турбулентный: Блазиус λ = 0.316 / Re^0.25
          return 0.316 / Math.pow(re, 0.25);
        }
      },
    },
    {
      key: 'pressure_drop_pa',
      label: 'Потери давления (абсолютные)',
      unit: 'Па',
      precision: 1,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const re = (i.velocity_ms * d_m * i.density_kgm3) / i.viscosity_pa_s;
        let lambda;

        if (re < 2300) {
          lambda = 64 / re;
        } else if (re < 4000) {
          const lambda_lam = 64 / 2300;
          const lambda_turb = 0.316 / Math.pow(re, 0.25);
          const factor = (re - 2300) / (4000 - 2300);
          lambda = lambda_lam + (lambda_turb - lambda_lam) * factor;
        } else {
          lambda = 0.316 / Math.pow(re, 0.25);
        }

        return (lambda * (i.length_m / d_m) * (i.density_kgm3 * Math.pow(i.velocity_ms, 2))) / 2;
      },
    },
    {
      key: 'pressure_drop_bar',
      label: 'Потери давления',
      unit: 'бар',
      precision: 2,
      formula: (i) => {
        const d_m = i.diameter_mm / 1000;
        const re = (i.velocity_ms * d_m * i.density_kgm3) / i.viscosity_pa_s;
        let lambda;

        if (re < 2300) {
          lambda = 64 / re;
        } else if (re < 4000) {
          const lambda_lam = 64 / 2300;
          const lambda_turb = 0.316 / Math.pow(re, 0.25);
          const factor = (re - 2300) / (4000 - 2300);
          lambda = lambda_lam + (lambda_turb - lambda_lam) * factor;
        } else {
          lambda = 0.316 / Math.pow(re, 0.25);
        }

        const dp_pa = (lambda * (i.length_m / d_m) * (i.density_kgm3 * Math.pow(i.velocity_ms, 2))) / 2;
        return dp_pa / 100000; // Па → бар
      },
      threshold: {
        evaluate: (value) => {
          if (value > 10)
            return {
              severity: 'critical',
              message: `Потери ${value.toFixed(2)} бар — значительны, требуется увеличить диаметр трубы`,
            };
          if (value > 1)
            return {
              severity: 'warning',
              message: `Потери ${value.toFixed(2)} бар — заметны, рассмотрите увеличение диаметра`,
            };
          return {
            severity: 'safe',
            message: `Потери ${value.toFixed(2)} бар — в норме`,
          };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 32957-2015',
      title: 'Трубопроводы из стали с защитными покрытиями для транспорта жидкостей. Технические требования',
      clause: 'Приложение В',
      quote: 'Расчёт потерь давления в трубопроводах на трение',
    },
    {
      code: 'СНиП 2.04.01-85',
      title: 'Внутренний водопровод и канализация зданий',
      clause: 'п. 3.6',
      quote: 'Определение потерь напора при движении воды в трубах',
    },
    {
      code: 'ISO 5241',
      title: 'Fluid power systems and components — Pressure drop–Flow relationships in circular conduits',
      clause: 'Раздел 5',
    },
  ],
};

export const TT_PRESSURE_DROP: FullCalculation = {
  id: 'tt_pressure_drop',
  name: '⚙️ Потери давления (Дарси–Вейсбах)',
  description: 'Расчёт потерь давления в трубопроводе при ламинарном и турбулентном течении жидкостей и газов',
  category: 'thermal',
  methodologies: [tt_pressure_drop_methodology_darcy],
  defaultMethodologyId: 'tt_pressure_drop_darcy',
  warnings: [
    'Формула учитывает только потери на трение, не включает местные потери (в фитингах, коленах)',
    'Коэффициент трения зависит от шероховатости трубы, которая растёт с возрастом',
    'Для точных расчётов используйте диаграмму Муди вместо формулы Блазиуса',
  ],
  keywords: ['гидравлика', 'потери давления', 'трубопровод', 'дарси', 'число Рейнольдса'],
};

/**
 * Экспортируем расчёты TX для использования в demonstrations.ts
 */
export const TX_CALCULATIONS = [TX_HEAT_BALANCE, TT_PRESSURE_DROP];
