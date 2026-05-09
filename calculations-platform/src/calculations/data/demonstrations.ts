import { FullCalculation } from '../types';
import { TX_CALCULATIONS } from './tx_methodologies';
import { TH_CALCULATIONS } from './th_methodologies';
import { EO_CALCULATIONS } from './eo_methodologies';
import { VK_CALCULATIONS } from './vk_methodologies';
import { G_CALCULATIONS } from './g_methodologies';
import { PB_CALCULATIONS } from './pb_methodologies';

export const CALCULATION_CATEGORIES = [
  // Фаза 1: Тепловые системы
  { id: 'thermal', name: '🔥 TX — Тепловые системы' },

  // Фаза 2: Теплотехнические расчёты
  { id: 'thermotechnical', name: '🔥 TH — Теплотехнические расчёты' },

  // Фаза 3: Электротехнические
  { id: 'electrical', name: '⚡ EO — Электротехнические расчёты' },

  // Фаза 4: Водоснабжение и канализация
  { id: 'water', name: '💧 VK — Водоснабжение и канализация' },

  // Фаза 5: Геодезия и геометрия
  { id: 'geodesy', name: '📐 G — Геодезия и геометрия' },

  // Фаза 6: Промышленная безопасность
  { id: 'safety', name: '🛡️ PB — Промышленная безопасность' },

  // Legacy категории (для совместимости)
  { id: 'structural', name: '🏗️ Конструкционные расчёты' },
  { id: 'hydraulic', name: '💧 Гидравлические расчёты' },
  { id: 'acoustic', name: '🔊 Акустические расчёты' },
  { id: 'ventilation', name: '💨 Вентиляция и кондиционирование' },
];

const STANDARD_CABLE_CROSS_SECTIONS = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400,
];

const roundUpToStandard = (value: number, ladder: number[]): number => {
  for (const step of ladder) {
    if (value <= step) return step;
  }
  return ladder[ladder.length - 1];
};

export const DEMO_CALCULATIONS: FullCalculation[] = [
  {
    id: 'thermal-load',
    name: 'Тепловая нагрузка здания',
    description: 'Расчёт тепловой мощности на отопление и вентиляцию для жилых и общественных зданий',
    category: 'thermal',
    asciiFormula: 'Q = A · ΔT · U + V · n · ΔT · 0.34 / 1000',
    latexFormula: 'Q = \\frac{A \\cdot \\Delta T \\cdot U + V \\cdot n \\cdot \\Delta T \\cdot 0{.}34}{1000}',
    methodology:
      'Расчёт по упрощённой методике для оценки установленной тепловой мощности. Состоит из двух слагаемых: трансмиссионные потери через ограждающие конструкции (Q_тр = A·ΔT·U) и затраты на нагрев инфильтрационного/вентиляционного воздуха (Q_вент = V·n·ΔT·c·ρ, где c·ρ ≈ 0.34 Вт·ч/(м³·К)).',
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
          hint: 'tв − tн.р. (внутр. + 20 °С минус расчётная наружная для региона)',
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
          hint: 'Площадь × высота этажей. Для типового жилья ~3 м³ на 1 м² площади',
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
        code: 'СП 50.13330.2012',
        title: 'Тепловая защита зданий (актуализация СНиП 23-02-2003)',
        clause: 'п. 5.1, табл. 3',
        quote: 'Нормируемые значения сопротивления теплопередаче ограждающих конструкций',
      },
      {
        code: 'СП 60.13330.2020',
        title: 'Отопление, вентиляция и кондиционирование воздуха',
        clause: 'п. 7.2',
      },
    ],
    keywords: ['тепло', 'теплопотери', 'отопление', 'теплоснабжение', 'нагрузка', 'здание', 'теплозащита'],
  },
  {
    id: 'structural-beam',
    name: 'Прогиб стальной балки',
    description: 'Расчёт максимального прогиба шарнирно-опёртой балки при равномерно распределённой нагрузке',
    category: 'structural',
    asciiFormula: 'f = 5·q·L⁴ / (384·E·I)',
    latexFormula: 'f = \\frac{5 \\cdot q \\cdot L^4}{384 \\cdot E \\cdot I}',
    methodology:
      'Классическое решение для однопролётной балки на двух шарнирных опорах с равномерно распределённой нагрузкой по всей длине пролёта (теория упругости, гипотеза плоских сечений).',
    inputs: [
      {
        key: 'span',
        label: 'Длина пролёта',
        unit: 'м',
        defaultValue: 6,
        range: {
          min: 0.5,
          max: 30,
          typical: 6,
          hint: 'Расстояние между осями опор',
          warningAbove: 18,
        },
      },
      {
        key: 'load',
        label: 'Распределённая нагрузка',
        unit: 'кН/м',
        defaultValue: 10,
        range: {
          min: 0.1,
          max: 200,
          typical: 10,
          hint: 'Полная расчётная нагрузка (постоянная + временная)',
        },
      },
      {
        key: 'inertia',
        label: 'Момент инерции сечения',
        unit: 'см⁴',
        defaultValue: 5000,
        range: {
          min: 50,
          max: 500000,
          typical: 5000,
          hint: 'Из сортамента: I20 ≈ 1840, I30 ≈ 7080, I40 ≈ 19062 см⁴',
        },
      },
      {
        key: 'modulus',
        label: 'Модуль упругости (Юнга)',
        unit: 'ГПа',
        defaultValue: 206,
        range: {
          min: 50,
          max: 250,
          typical: 206,
          hint: 'Сталь 200–210 ГПа; алюминий 70 ГПа; железобетон 27–35 ГПа',
        },
      },
    ],
    outputs: [
      {
        key: 'deflection',
        label: 'Максимальный прогиб',
        unit: 'мм',
        precision: 2,
        formula: (i) =>
          ((5 * i.load * Math.pow(i.span, 4)) / (384 * i.modulus * 1e9 * i.inertia * 1e-8)) * 1000,
      },
      {
        key: 'relative',
        label: 'Относительный прогиб',
        unit: '1/n',
        precision: 0,
        chartable: false,
        formula: (i) => {
          const f =
            ((5 * i.load * Math.pow(i.span, 4)) / (384 * i.modulus * 1e9 * i.inertia * 1e-8)) *
            1000;
          if (f <= 0) return Infinity;
          return Math.round((i.span * 1000) / f);
        },
        threshold: {
          evaluate: (n) => {
            if (!isFinite(n) || n >= 400)
              return {
                severity: 'safe',
                message: `Прогиб 1/${isFinite(n) ? n : '∞'} — в пределах L/400 (норма для прогонов под штукатурку)`,
              };
            if (n >= 250)
              return {
                severity: 'safe',
                message: `Прогиб 1/${n} — в пределах L/250 (норма для перекрытий)`,
              };
            if (n >= 200)
              return {
                severity: 'warning',
                message: `Прогиб 1/${n} — на границе L/200, проверить требования к конкретному применению`,
              };
            return {
              severity: 'critical',
              message: `Прогиб 1/${n} — превышает предельно допустимый L/200 по СП 20.13330.2016`,
            };
          },
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 20.13330.2016',
        title: 'Нагрузки и воздействия (актуализация СНиП 2.01.07-85*)',
        clause: 'Приложение Д, табл. Д.1',
        quote:
          'Предельные прогибы: L/200 — балки рабочих площадок; L/250 — перекрытия; L/400 — прогоны под жёсткую штукатурку',
      },
      {
        code: 'СП 16.13330.2017',
        title: 'Стальные конструкции (актуализация СНиП II-23-81*)',
        clause: 'п. 14.2',
      },
    ],
    keywords: ['балка', 'прогиб', 'изгиб', 'сталь', 'балки', 'конструкция', 'пролёт', 'ферма'],
  },
  {
    id: 'electrical-cable',
    name: 'Сечение силового кабеля',
    description: 'Расчёт минимального сечения кабеля по току нагрузки и выбор стандартного сечения',
    category: 'electrical',
    asciiFormula: 'I = P·1000 / (√3·U·cos φ); S = I / J',
    latexFormula:
      'I = \\frac{P \\cdot 1000}{\\sqrt{3} \\cdot U \\cdot \\cos\\varphi}, \\quad S = \\frac{I}{J}',
    methodology:
      'Расчёт по допустимой плотности тока (по нагреву) для трёхфазной сети с известным cos φ. Требует дополнительной проверки по потере напряжения и току короткого замыкания (не входит в данный расчёт).',
    inputs: [
      {
        key: 'power',
        label: 'Активная мощность нагрузки',
        unit: 'кВт',
        defaultValue: 10,
        range: { min: 0.1, max: 5000, typical: 10, hint: 'Суммарная активная мощность потребителя' },
      },
      {
        key: 'voltage',
        label: 'Линейное напряжение',
        unit: 'В',
        defaultValue: 380,
        range: {
          min: 220,
          max: 35000,
          typical: 380,
          hint: '230/400 В для бытовых, 6/10 кВ для распределительных сетей',
        },
      },
      {
        key: 'cosPhi',
        label: 'Коэффициент мощности cos φ',
        unit: '—',
        defaultValue: 0.95,
        range: {
          min: 0.5,
          max: 1.0,
          typical: 0.92,
          hint: 'Освещение/отопление: 0.95–1.0; двигатели: 0.7–0.9',
          warningBelow: 0.7,
        },
      },
      {
        key: 'currentDensity',
        label: 'Допустимая плотность тока',
        unit: 'А/мм²',
        defaultValue: 4,
        range: {
          min: 1,
          max: 8,
          typical: 4,
          hint: 'Cu в воздухе: 4–6; Cu в земле: 3–4; Al в воздухе: 2.5–3.5',
        },
      },
    ],
    outputs: [
      {
        key: 'current',
        label: 'Расчётный ток',
        unit: 'А',
        precision: 2,
        chartable: false,
        formula: (i) => (i.power * 1000) / (Math.sqrt(3) * i.voltage * i.cosPhi),
      },
      {
        key: 'crossSection',
        label: 'Расчётное сечение',
        unit: 'мм²',
        precision: 2,
        formula: (i) => {
          const current = (i.power * 1000) / (Math.sqrt(3) * i.voltage * i.cosPhi);
          return current / i.currentDensity;
        },
      },
      {
        key: 'standardCrossSection',
        label: 'Стандартное сечение (округление вверх)',
        unit: 'мм²',
        precision: 1,
        formula: (i) => {
          const current = (i.power * 1000) / (Math.sqrt(3) * i.voltage * i.cosPhi);
          const calc = current / i.currentDensity;
          return roundUpToStandard(calc, STANDARD_CABLE_CROSS_SECTIONS);
        },
        threshold: {
          evaluate: (s) => {
            if (s >= 240)
              return {
                severity: 'warning',
                message: `Сечение ${s} мм² — рассмотреть параллельную прокладку нескольких кабелей`,
              };
            if (s >= 1.5)
              return {
                severity: 'safe',
                message: `Сечение ${s} мм² — стандартное по ГОСТ 22483-2012`,
              };
            return {
              severity: 'critical',
              message: 'Сечение ниже минимально допустимого 1.5 мм² по ПУЭ',
            };
          },
        },
      },
    ],
    normativeRefs: [
      {
        code: 'ПУЭ 7-е изд.',
        title: 'Правила устройства электроустановок',
        clause: 'гл. 1.3, табл. 1.3.4–1.3.31',
        quote: 'Длительно допустимые токи для проводов и кабелей с резиновой и ПВХ изоляцией',
      },
      {
        code: 'ГОСТ 22483-2012',
        title: 'Жилы токопроводящие для кабелей, проводов и шнуров',
        clause: 'табл. 1',
      },
    ],
    keywords: ['кабель', 'провод', 'ток', 'сечение', 'проводник', 'электрика', 'мощность', 'нагрузка', 'кабеля', 'кабелей'],
    warnings: [
      'Расчёт не учитывает потерю напряжения по длине линии — для длинных трасс выполнять отдельно',
      'Не учтены поправки на температуру и условия прокладки (k1, k2 по ПУЭ 1.3.10–1.3.12)',
    ],
  },
  {
    id: 'hydraulic-pressure',
    name: 'Гидравлические потери в трубопроводе',
    description: 'Расчёт потерь давления по длине трубопровода для воды (формула Дарси–Вейсбаха)',
    category: 'hydraulic',
    asciiFormula: 'ΔP = λ·(L/d)·(ρ·v²/2)',
    latexFormula: '\\Delta P = \\lambda \\cdot \\frac{L}{d} \\cdot \\frac{\\rho \\cdot v^2}{2}',
    methodology:
      'Потери на трение для напорного течения. Применима для турбулентного режима (Re > 2300). Для местных сопротивлений добавляется ΣΔP_м = Σξ·(ρ·v²/2).',
    inputs: [
      {
        key: 'flow',
        label: 'Объёмный расход',
        unit: 'м³/ч',
        defaultValue: 20,
        range: { min: 0.1, max: 10000, typical: 20, hint: 'Часовой расход жидкости через сечение' },
      },
      {
        key: 'diameter',
        label: 'Внутренний диаметр',
        unit: 'мм',
        defaultValue: 50,
        range: { min: 10, max: 1500, typical: 50, hint: 'Внутренний диаметр трубопровода (DN)' },
      },
      {
        key: 'length',
        label: 'Длина участка',
        unit: 'м',
        defaultValue: 100,
        range: { min: 1, max: 10000, typical: 100, hint: 'Длина прямого участка по оси' },
      },
      {
        key: 'frictionFactor',
        label: 'Коэффициент гидравлического трения λ',
        unit: '—',
        defaultValue: 0.03,
        range: {
          min: 0.01,
          max: 0.1,
          typical: 0.03,
          hint: 'Сталь новая 0.02; сталь б/у 0.03–0.04; ПЭ/ПП 0.015–0.02',
        },
      },
      {
        key: 'density',
        label: 'Плотность среды',
        unit: 'кг/м³',
        defaultValue: 1000,
        range: { min: 700, max: 1200, typical: 1000, hint: 'Вода 1000; масло 850–900' },
      },
    ],
    outputs: [
      {
        key: 'velocity',
        label: 'Скорость потока',
        unit: 'м/с',
        precision: 2,
        formula: (i) => {
          const dM = i.diameter / 1000;
          const flowM3s = i.flow / 3600;
          return flowM3s / (Math.PI * Math.pow(dM / 2, 2));
        },
        threshold: {
          evaluate: (v) => {
            if (v > 3)
              return {
                severity: 'critical',
                message: `Скорость ${v.toFixed(2)} м/с — превышает рекомендуемую 3 м/с (повышенный шум, эрозия)`,
              };
            if (v > 2)
              return {
                severity: 'warning',
                message: `Скорость ${v.toFixed(2)} м/с — на верхнем пределе для бытовой системы`,
              };
            if (v < 0.3)
              return {
                severity: 'warning',
                message: `Скорость ${v.toFixed(2)} м/с — низкая, возможно завышен диаметр`,
              };
            return {
              severity: 'safe',
              message: `Скорость ${v.toFixed(2)} м/с — в рекомендуемом диапазоне 0.5–2 м/с`,
            };
          },
        },
      },
      {
        key: 'pressureLoss',
        label: 'Потери давления',
        unit: 'кПа',
        precision: 2,
        formula: (i) => {
          const dM = i.diameter / 1000;
          const flowM3s = i.flow / 3600;
          const v = flowM3s / (Math.PI * Math.pow(dM / 2, 2));
          return (i.frictionFactor * (i.length / dM) * (i.density * v * v)) / 2 / 1000;
        },
      },
      {
        key: 'pressureLossM',
        label: 'Потери в метрах столба',
        unit: 'м.вод.ст.',
        precision: 2,
        formula: (i) => {
          const dM = i.diameter / 1000;
          const flowM3s = i.flow / 3600;
          const v = flowM3s / (Math.PI * Math.pow(dM / 2, 2));
          const pa = (i.frictionFactor * (i.length / dM) * (i.density * v * v)) / 2;
          return pa / (i.density * 9.81);
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 30.13330.2020',
        title: 'Внутренний водопровод и канализация зданий',
        clause: 'п. 5.4',
      },
      {
        code: 'СП 73.13330.2016',
        title: 'Внутренние санитарно-технические системы зданий',
      },
    ],
    keywords: ['труба', 'трубопровод', 'давление', 'вода', 'гидравлика', 'насос', 'поток', 'расход'],
    warnings: ['Не учтены местные сопротивления (отводы, тройники, арматура)'],
  },
  {
    id: 'acoustic-insulation',
    name: 'Индекс изоляции воздушного шума',
    description: 'Оценка взвешенного индекса звукоизоляции одностенной массивной перегородки',
    category: 'acoustic',
    asciiFormula: 'Rw ≈ 20·lg(m) − 47',
    latexFormula: 'R_w \\approx 20 \\cdot \\lg(m) - 47',
    methodology:
      'Эмпирическая формула «закона массы» для однослойных конструкций в области средних и высоких частот, где m = ρ·δ — поверхностная плотность (кг/м²). Точность ±3 дБ. Не применима для лёгких многослойных конструкций.',
    inputs: [
      {
        key: 'thickness',
        label: 'Толщина конструкции',
        unit: 'см',
        defaultValue: 15,
        range: { min: 1, max: 100, typical: 15, hint: 'Кирпич 12/25/38 см; ЖБ 10/16/20 см' },
      },
      {
        key: 'density',
        label: 'Плотность материала',
        unit: 'кг/м³',
        defaultValue: 2400,
        range: {
          min: 100,
          max: 8000,
          typical: 2400,
          hint: 'ЖБ 2400; кирпич 1800; гипсокартон 800; сталь 7850',
        },
      },
    ],
    outputs: [
      {
        key: 'surfaceDensity',
        label: 'Поверхностная плотность',
        unit: 'кг/м²',
        precision: 1,
        chartable: false,
        formula: (i) => (i.thickness / 100) * i.density,
      },
      {
        key: 'rw',
        label: 'Индекс звукоизоляции Rw',
        unit: 'дБ',
        precision: 1,
        formula: (i) => {
          const m = (i.thickness / 100) * i.density;
          if (m <= 0) return 0;
          return 20 * Math.log10(m) - 47;
        },
        threshold: {
          evaluate: (rw) => {
            if (rw < 43)
              return {
                severity: 'critical',
                message: `Rw=${rw.toFixed(1)} дБ — ниже норматива для межквартирных стен (≥52 дБ)`,
              };
            if (rw < 52)
              return {
                severity: 'warning',
                message: `Rw=${rw.toFixed(1)} дБ — пригодно для межкомнатных, недостаточно для межквартирных`,
              };
            return {
              severity: 'safe',
              message: `Rw=${rw.toFixed(1)} дБ — соответствует требованиям к межквартирным стенам`,
            };
          },
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 51.13330.2011',
        title: 'Защита от шума (актуализация СНиП 23-03-2003)',
        clause: 'п. 9, табл. 2',
        quote: 'Нормативные значения изоляции воздушного шума ограждающими конструкциями',
      },
      {
        code: 'ГОСТ 27296-2012',
        title: 'Здания и сооружения. Методы измерения звукоизоляции ограждающих конструкций',
      },
    ],
    keywords: ['звук', 'шум', 'изоляция', 'акустика', 'перегородка', 'стена', 'звукоизоляция', 'дб', 'децибел'],
    warnings: [
      'Эмпирическая формула, точность ±3 дБ — для финального проекта обязательны лабораторные измерения',
    ],
  },
  {
    id: 'ventilation-flow',
    name: 'Расчётный воздухообмен помещения',
    description: 'Определение требуемого расхода приточного воздуха по объёму и числу людей (берётся максимум)',
    category: 'ventilation',
    asciiFormula: 'L = max(V·n; N·l)',
    latexFormula: 'L = \\max(V \\cdot n,\\ N \\cdot \\ell)',
    methodology:
      'Расход подбирается по большему из двух критериев: кратность воздухообмена для помещения и санитарная норма на одного человека. Для расчёта по теплоизбыткам/влаговыделениям применяется отдельная методика.',
    inputs: [
      {
        key: 'volume',
        label: 'Объём помещения',
        unit: 'м³',
        defaultValue: 300,
        range: { min: 10, max: 100000, typical: 300, hint: 'Площадь × высота помещения' },
      },
      {
        key: 'airChanges',
        label: 'Нормируемая кратность',
        unit: 'ч⁻¹',
        defaultValue: 3,
        range: {
          min: 0.5,
          max: 20,
          typical: 3,
          hint: 'Жильё 1; кухня 6–10; санузел 25 м³/ч; офис 2–4; кафе 8–10',
        },
      },
      {
        key: 'people',
        label: 'Расчётное число людей',
        unit: 'чел',
        defaultValue: 10,
        range: { min: 0, max: 5000, typical: 10, hint: 'Максимальное число одновременно находящихся' },
      },
      {
        key: 'perPerson',
        label: 'Норма на человека',
        unit: 'м³/(ч·чел)',
        defaultValue: 30,
        range: {
          min: 15,
          max: 80,
          typical: 30,
          hint: 'Жильё 30; офис 40; курительная 60; зал кафе 30',
        },
      },
    ],
    outputs: [
      {
        key: 'byVolume',
        label: 'Воздухообмен по объёму',
        unit: 'м³/ч',
        precision: 0,
        formula: (i) => i.volume * i.airChanges,
      },
      {
        key: 'byPeople',
        label: 'Воздухообмен по числу людей',
        unit: 'м³/ч',
        precision: 0,
        formula: (i) => i.people * i.perPerson,
      },
      {
        key: 'required',
        label: 'Требуемый расход',
        unit: 'м³/ч',
        precision: 0,
        formula: (i) => Math.max(i.volume * i.airChanges, i.people * i.perPerson),
        threshold: {
          evaluate: (_l, i) => {
            const byVol = i.volume * i.airChanges;
            const byPpl = i.people * i.perPerson;
            const driver = byPpl >= byVol ? 'санитарная норма на людей' : 'кратность воздухообмена';
            return {
              severity: 'safe',
              message: `Определяющий критерий: ${driver}`,
            };
          },
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 60.13330.2020',
        title: 'Отопление, вентиляция и кондиционирование воздуха',
        clause: 'п. 7.1, табл. 7.1',
      },
      {
        code: 'ГОСТ 30494-2011',
        title: 'Здания жилые и общественные. Параметры микроклимата в помещениях',
      },
    ],
    keywords: ['вентиляция', 'воздух', 'приток', 'кондиционирование', 'воздухообмен', 'кратность', 'приточный'],
  },
  {
    id: 'foundation-settlement',
    name: 'Осадка ленточного фундамента',
    description: 'Упрощённая оценка осадки фундамента в линейно-деформируемой среде',
    category: 'structural',
    asciiFormula: 's = β·p·b / E',
    latexFormula: 's = \\frac{\\beta \\cdot p \\cdot b}{E}',
    methodology:
      'Метод послойного суммирования заменён упрощённой формулой для предварительной оценки. β — коэффициент формы (≈0.8 для ленточного, 1.0 для квадратного). Точный расчёт по СП 22.13330.2016 учитывает многослойность грунта.',
    inputs: [
      {
        key: 'load',
        label: 'Нагрузка на фундамент',
        unit: 'кН',
        defaultValue: 500,
        range: { min: 10, max: 100000, typical: 500, hint: 'Полная вертикальная нагрузка от здания' },
      },
      {
        key: 'area',
        label: 'Площадь подошвы',
        unit: 'м²',
        defaultValue: 10,
        range: { min: 0.5, max: 1000, typical: 10, hint: 'Площадь контакта подошвы с грунтом' },
      },
      {
        key: 'width',
        label: 'Ширина подошвы',
        unit: 'м',
        defaultValue: 1.5,
        range: { min: 0.3, max: 30, typical: 1.5, hint: 'Меньшая сторона прямоугольной подошвы' },
      },
      {
        key: 'modulus',
        label: 'Модуль деформации грунта',
        unit: 'МПа',
        defaultValue: 15,
        range: {
          min: 1,
          max: 100,
          typical: 15,
          hint: 'Глина мягкая 5–10; суглинок 15–25; песок 25–40; гравий 50–80',
          warningBelow: 5,
        },
      },
      {
        key: 'shapeCoeff',
        label: 'Коэффициент формы β',
        unit: '—',
        defaultValue: 0.8,
        range: {
          min: 0.5,
          max: 1.5,
          typical: 0.8,
          hint: 'Лента 0.8; квадрат 0.95; круг 0.79',
        },
      },
    ],
    outputs: [
      {
        key: 'pressure',
        label: 'Среднее давление под подошвой',
        unit: 'кПа',
        precision: 1,
        formula: (i) => i.load / i.area,
      },
      {
        key: 'settlement',
        label: 'Расчётная осадка',
        unit: 'мм',
        precision: 1,
        formula: (i) => {
          const p = i.load / i.area;
          return ((i.shapeCoeff * p * i.width) / (i.modulus * 1000)) * 1000;
        },
        threshold: {
          evaluate: (s) => {
            if (s > 150)
              return {
                severity: 'critical',
                message: `Осадка ${s.toFixed(1)} мм — превышает предельную 150 мм для жилых зданий по СП 22.13330.2016`,
              };
            if (s > 100)
              return {
                severity: 'warning',
                message: `Осадка ${s.toFixed(1)} мм — близка к предельной, проверить дифференциальную осадку`,
              };
            return {
              severity: 'safe',
              message: `Осадка ${s.toFixed(1)} мм — в пределах допустимой по СП 22.13330.2016`,
            };
          },
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 22.13330.2016',
        title: 'Основания зданий и сооружений (актуализация СНиП 2.02.01-83*)',
        clause: 'Приложение Д, табл. Д.1',
        quote:
          'Предельные деформации оснований: жилые/общественные здания s_u ≤ 150 мм',
      },
    ],
    keywords: ['фундамент', 'осадка', 'грунт', 'основание', 'деформация', 'почва', 'фундаменты'],
    warnings: [
      'Упрощённая оценка — для проектирования обязателен расчёт методом послойного суммирования по СП 22.13330.2016',
    ],
  },
  {
    id: 'fire-resistance',
    name: 'Предел огнестойкости защищённой конструкции',
    description: 'Оценка времени прогрева конструкции до критической температуры через слой огнезащиты',
    category: 'structural',
    asciiFormula: 'τ ≈ k · δ² / λ',
    latexFormula: '\\tau \\approx k \\cdot \\frac{\\delta^2}{\\lambda}',
    methodology:
      'Эмпирическая зависимость для оценки REI на основе теплопроводности слоя огнезащиты и его толщины. Коэффициент k подбирается экспериментально (для напыляемых составов ≈75 мин·Вт/(м·К·см²)).',
    inputs: [
      {
        key: 'thickness',
        label: 'Толщина огнезащитного слоя',
        unit: 'см',
        defaultValue: 2.5,
        range: { min: 0.1, max: 10, typical: 2.5, hint: 'По проекту/паспорту огнезащитного состава' },
      },
      {
        key: 'conductivity',
        label: 'Теплопроводность огнезащиты',
        unit: 'Вт/(м·К)',
        defaultValue: 0.1,
        range: {
          min: 0.03,
          max: 1.0,
          typical: 0.1,
          hint: 'Минвата 0.04; вспучивающийся состав 0.1–0.2; цементная штукатурка 0.5–1.0',
        },
      },
      {
        key: 'k',
        label: 'Эмпирический коэффициент k',
        unit: 'мин·Вт/(м·К·см²)',
        defaultValue: 75,
        range: {
          min: 30,
          max: 150,
          typical: 75,
          hint: 'Калибруется по протоколу испытаний на стандартный пожар',
        },
      },
    ],
    outputs: [
      {
        key: 'limitMin',
        label: 'Расчётный предел огнестойкости',
        unit: 'мин',
        precision: 0,
        formula: (i) => (i.k * i.thickness * i.thickness) / i.conductivity,
        threshold: {
          evaluate: (t) => {
            if (t >= 240)
              return {
                severity: 'safe',
                message: `${Math.round(t)} мин — REI 240 (сверхвысокий)`,
              };
            if (t >= 120)
              return {
                severity: 'safe',
                message: `${Math.round(t)} мин — соответствует REI 120 (несущие основные)`,
              };
            if (t >= 60)
              return {
                severity: 'safe',
                message: `${Math.round(t)} мин — REI 60 (типовое для перекрытий I/II степени)`,
              };
            if (t >= 30)
              return {
                severity: 'warning',
                message: `${Math.round(t)} мин — только REI 30, недостаточно для большинства несущих`,
              };
            return {
              severity: 'critical',
              message: `${Math.round(t)} мин — ниже минимально требуемого REI 30`,
            };
          },
        },
      },
      {
        key: 'reiClass',
        label: 'Класс REI (округление вниз)',
        unit: 'мин',
        precision: 0,
        chartable: false,
        formula: (i) => {
          const t = (i.k * i.thickness * i.thickness) / i.conductivity;
          const grades = [240, 180, 120, 90, 60, 45, 30, 15];
          for (const g of grades) {
            if (t >= g) return g;
          }
          return 0;
        },
      },
    ],
    normativeRefs: [
      {
        code: 'СП 2.13130.2020',
        title: 'Системы противопожарной защиты. Обеспечение огнестойкости объектов',
        clause: 'п. 5.4, табл. 21',
      },
      {
        code: 'ГОСТ 30247.0-94',
        title: 'Конструкции строительные. Методы испытаний на огнестойкость',
      },
    ],
    keywords: ['огонь', 'пожар', 'огнестойкость', 'защита', 'горение', 'rei', 'огнезащита'],
    warnings: [
      'Оценочная формула — фактический предел подтверждается только огневыми испытаниями по ГОСТ 30247',
    ],
  },
  // Фаза 1: TX — Тепловые системы
  ...TX_CALCULATIONS,

  // Фаза 2: TH — Теплотехнические расчёты
  ...TH_CALCULATIONS,

  // Фаза 3: EO — Электротехнические расчёты
  ...EO_CALCULATIONS,

  // Фаза 4: VK — Водоснабжение и канализация
  ...VK_CALCULATIONS,

  // Фаза 5: G — Геодезия и геометрия
  ...G_CALCULATIONS,

  // Фаза 6: PB — Промышленная безопасность
  ...PB_CALCULATIONS,
];
