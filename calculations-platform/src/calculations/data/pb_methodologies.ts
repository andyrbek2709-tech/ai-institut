import { FullCalculation, Methodology } from '../types';

/**
 * Фаза 6: PB — Промышленная безопасность (10 расчётов)
 * Категория 1 (5): Оценка рисков и безопасность
 * Категория 2 (5): Защита и инженерные меры
 */

// ===== КАТЕГОРИЯ 1: ОЦЕНКА РИСКОВ И БЕЗОПАСНОСТЬ =====

// ===== РАСЧЁТ 1: ОЦЕНКА РИСКА (МАТРИЦА ВЕРОЯТНОСТЬ × ПОСЛЕДСТВИЯ) =====

const pb_risk_assessment_methodology_gost: Methodology = {
  id: 'pb_risk_assessment_gost12_0_002',
  name: 'ГОСТ 12.0.002-2014 (Матрица рисков)',
  description: 'Оценка риска по матричному методу на основе вероятности и тяжести последствий',
  asciiFormula: 'Risk = Probability × Severity',
  latexFormula: 'Risk = P \\times S',
  methodology: `
Матричный метод оценки профессиональных рисков:

Вероятность (P): шкала 1–5
  1 = Крайне маловероятно (< 1%)
  2 = Маловероятно (1–5%)
  3 = Средняя вероятность (5–20%)
  4 = Высокая вероятность (20–50%)
  5 = Крайне вероятно (> 50%)

Тяжесть последствий (S): шкала 1–5
  1 = Микротравма (не требует лечения)
  2 = Лёгкая травма (1–3 дня нетрудоспособности)
  3 = Средняя травма (4–30 дней)
  4 = Тяжёлая травма (> 30 дней, инвалидность)
  5 = Смертельный исход

Риск = P × S, диапазон 1–25

Оценка результата:
  1–5 = Приемлемый (зелёная зона)
  6–12 = Требует контроля (жёлтая зона)
  13–20 = Критический (оранжевая зона)
  21–25 = Недопустимый (красная зона)
  `,
  inputs: [
    {
      key: 'probability',
      label: 'Вероятность события',
      unit: 'баллы (1–5)',
      defaultValue: 2,
      range: {
        min: 1,
        max: 5,
        typical: 2,
        hint: '1=крайне редко, 5=очень часто',
      },
    },
    {
      key: 'severity',
      label: 'Тяжесть последствий',
      unit: 'баллы (1–5)',
      defaultValue: 3,
      range: {
        min: 1,
        max: 5,
        typical: 3,
        hint: '1=микротравма, 5=смерть',
      },
    },
  ],
  outputs: [
    {
      key: 'riskScore',
      label: 'Оценка риска',
      unit: 'баллы (1–25)',
      precision: 0,
      formula: (i) => i.probability * i.severity,
      threshold: {
        evaluate: (value) => {
          if (value >= 21)
            return { severity: 'critical', message: 'Недопустимый риск — требует немедленных мер' };
          if (value >= 13)
            return { severity: 'warning', message: 'Критический риск — требует уменьшения' };
          if (value >= 6)
            return { severity: 'warning', message: 'Требует контроля и мониторинга' };
          return { severity: 'safe', message: 'Приемлемый риск' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 12.0.002-2014',
      title: 'Система стандартов безопасности труда. Термины и определения',
      clause: 'п. 3.2–3.5',
      quote: 'Методология оценки профессиональных рисков',
    },
    {
      code: 'ГОСТ 12.0.230-2007',
      title: 'Система управления охраной труда и безопасностью производства',
      clause: 'п. 7',
    },
  ],
};

// ===== РАСЧЁТ 2: ВРЕМЯ ЭВАКУАЦИИ ИЗ ПОМЕЩЕНИЯ =====

const pb_evacuation_time_methodology_snip: Methodology = {
  id: 'pb_evacuation_time_snip2_01_51',
  name: 'СНиП 2.01.51-90 (Время эвакуации)',
  description: 'Расчёт времени полной эвакуации людей из помещения в нормальных и аварийных условиях',
  asciiFormula: 't = L / v + t₀',
  latexFormula: 't = \\frac{L}{v} + t_0',
  methodology: `
Время эвакуации складывается из:

1. Время до начала движения (задержка реакции): t₀ = 0,5–2 мин
   - В нормальных условиях: 0,5–1 мин
   - В аварийных условиях: 1–2 мин

2. Время движения: t_движ = L / v
   где L — расстояние до выхода (м)
       v — скорость движения (м/мин)

   Типовые скорости движения:
   - В коридорах: 60–100 м/мин
   - В проёмах дверей: 1–2 чел/сек на 1 м ширины
   - На лестницах: 30–50 м/мин (вниз), 20–30 м/мин (вверх)

Общее время эвакуации: t_э = t₀ + t_движ + t_заторов

Эвакуация считается безопасной, если t_э ≤ t_допустимое (рассчитано на основе опасных факторов пожара).
  `,
  inputs: [
    {
      key: 'distance',
      label: 'Расстояние до эвакуационного выхода',
      unit: 'м',
      defaultValue: 30,
      range: {
        min: 5,
        max: 100,
        typical: 30,
        hint: 'Из самой дальней точки помещения',
      },
    },
    {
      key: 'movementSpeed',
      label: 'Скорость движения людей',
      unit: 'м/мин',
      defaultValue: 80,
      range: {
        min: 20,
        max: 120,
        typical: 80,
        hint: '60–100 м/мин в коридорах, 30–50 на лестницах',
        warningBelow: 30,
      },
    },
    {
      key: 'initialDelay',
      label: 'Начальная задержка (осознание опасности)',
      unit: 'мин',
      defaultValue: 1,
      range: {
        min: 0.5,
        max: 2,
        typical: 1,
        hint: '0,5–1 мин в норме, 1–2 мин в аварийных условиях',
      },
    },
    {
      key: 'bottleneckFactor',
      label: 'Коэффициент затора (на проёмах дверей)',
      unit: '1',
      defaultValue: 1.2,
      range: {
        min: 1,
        max: 2,
        typical: 1.2,
        hint: '1 = без заторов, 1,5–2 = при скоплении людей',
      },
    },
  ],
  outputs: [
    {
      key: 'movementTime',
      label: 'Время движения до выхода',
      unit: 'мин',
      precision: 2,
      formula: (i) => i.distance / i.movementSpeed,
    },
    {
      key: 'totalTime',
      label: 'Полное время эвакуации',
      unit: 'мин',
      precision: 2,
      formula: (i) => (i.distance / i.movementSpeed) * i.bottleneckFactor + i.initialDelay,
      threshold: {
        evaluate: (value) => {
          if (value <= 5)
            return { severity: 'safe', message: 'Время эвакуации в норме' };
          if (value <= 10)
            return { severity: 'warning', message: 'Приемлемо для производственных объектов' };
          return { severity: 'warning', message: 'Требует улучшения маршрутов эвакуации' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 2.01.51-90',
      title: 'Защита от опасных геологических процессов',
      clause: 'разд. 6',
      quote: 'Системы оповещения и эвакуации',
    },
    {
      code: 'ГОСТ 12.2.032-78',
      title: 'Производственное оборудование. Знаки безопасности',
      clause: 'п. 2',
    },
  ],
};

// ===== РАСЧЁТ 3: БЕЗОПАСНОЕ РАССТОЯНИЕ ОТ ИСТОЧНИКА ОПАСНОСТИ =====

const pb_safe_distance_methodology: Methodology = {
  id: 'pb_safe_distance_rd03_418',
  name: 'РД 03-418-01 (Безопасное расстояние)',
  description: 'Расчёт минимального безопасного расстояния от источника опасности (взрыв, токсичное вещество)',
  asciiFormula: 'd = √(E / (4π·P_доп))',
  latexFormula: 'd = \\sqrt{\\frac{E}{4\\pi \\cdot P_{доп}}}',
  methodology: `
Минимальное безопасное расстояние рассчитывается на основе энергии выброса и допустимого давления:

d = √(E / (4π × P_доп))

где E — энергия выброса (Дж)
    P_доп — допустимое избыточное давление на расстоянии d (Па)

Типовые значения P_доп:
  - Для людей (внутри зданий): 5 кПа (окна разбиваются, нарушается целостность)
  - Для людей (на открытой местности): 20 кПа (поражающий фактор)
  - Для конструкций (полная разрушимость): 50+ кПа
  - Для конструкций (повреждение): 10–20 кПа

Алтернативный упрощённый метод (для взрывов):
d = 10 × ∛(m_взр)
где m_взр — масса взрывчатого вещества (кг)
результат в метрах
  `,
  inputs: [
    {
      key: 'blastEnergy',
      label: 'Энергия взрыва / выброса',
      unit: 'кДж',
      defaultValue: 1000,
      range: {
        min: 100,
        max: 100000,
        typical: 1000,
        hint: 'Энергия в килоджоулях',
      },
    },
    {
      key: 'allowablePressure',
      label: 'Допустимое избыточное давление',
      unit: 'кПа',
      defaultValue: 5,
      range: {
        min: 1,
        max: 50,
        typical: 5,
        hint: '5 кПа — для людей, 20 кПа — поражающий фактор',
      },
    },
  ],
  outputs: [
    {
      key: 'safeDistance',
      label: 'Минимальное безопасное расстояние',
      unit: 'м',
      precision: 2,
      formula: (i) => Math.sqrt((i.blastEnergy * 1000) / (4 * Math.PI * i.allowablePressure * 1000)),
      description: 'Расстояние, на котором давление волны снижается до допустимого уровня',
      threshold: {
        evaluate: (value) => {
          if (value > 100)
            return { severity: 'warning', message: `Значительное расстояние (${value.toFixed(0)} м) — требует проверки площади отчуждения` };
          return { severity: 'warning', message: `Безопасная зона установлена на ${value.toFixed(0)} м` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'РД 03-418-01',
      title: 'Методические рекомендации по оценке степени риска аварий на опасных производственных объектах',
      clause: 'разд. 4',
      quote: 'Расчёт зон поражения при взрывах и выбросах',
    },
    {
      code: 'ГОСТ 12.0.003-2015',
      title: 'Опасные и вредные производственные факторы. Классификация',
      clause: 'п. 4.2',
    },
  ],
};

// ===== РАСЧЁТ 4: УРОВЕНЬ ЦЕЛОСТНОСТИ БЕЗОПАСНОСТИ (SIL) =====

const pb_sil_methodology_iso61508: Methodology = {
  id: 'pb_sil_iso61508',
  name: 'ГОСТ Р ИСО/МЭК 61508 (SIL calculation)',
  description: 'Расчёт требуемого уровня целостности безопасности (Safety Integrity Level) системы',
  asciiFormula: 'SIL = f(ASIL, PFD, MTTRrepair)',
  latexFormula: 'SIL = f(ASIL, PFD, MTTR_{repair})',
  methodology: `
Уровень целостности безопасности (SIL) определяет требования к надёжности и готовности систем защиты.

Четыре уровня SIL (от 1 к 4):

SIL 1: Средняя степень управления риском
  - ASIL B–C (вероятность отказа 10⁻³ до 10⁻⁴)
  - Базовые системы контроля, стандартные компоненты

SIL 2: Выше средней степени управления
  - ASIL C–D (вероятность отказа 10⁻⁴ до 10⁻⁵)
  - Диагностирование неисправностей, резервирование

SIL 3: Высокая степень управления
  - ASIL D (вероятность отказа 10⁻⁵ до 10⁻⁶)
  - Полное диагностирование, избыточные каналы, тестирование

SIL 4: Самая высокая степень управления
  - ASIL D+ (вероятность отказа < 10⁻⁶)
  - Максимальное резервирование, непрерывное мониторирование, высокая квалификация персонала

Расчёт на основе Automotive SIL (ASIL):
  ASIL = Severity × Exposure × Controllability

Требуемый SIL выбирается на основе ASIL и стоимости/сложности реализации.
  `,
  inputs: [
    {
      key: 'severity',
      label: 'Степень тяжести отказа',
      unit: 'баллы (1–4)',
      defaultValue: 3,
      range: {
        min: 1,
        max: 4,
        typical: 3,
        hint: '1=повреждение, 4=смерть',
      },
    },
    {
      key: 'exposure',
      label: 'Вероятность опасной ситуации',
      unit: 'баллы (1–4)',
      defaultValue: 2,
      range: {
        min: 1,
        max: 4,
        typical: 2,
        hint: '1=редко, 4=постоянно',
      },
    },
    {
      key: 'controllability',
      label: 'Возможность избежать опасности',
      unit: 'баллы (1–3)',
      defaultValue: 2,
      range: {
        min: 1,
        max: 3,
        typical: 2,
        hint: '1=легко, 3=невозможно',
      },
    },
  ],
  outputs: [
    {
      key: 'asil',
      label: 'ASIL (Automotive Safety Integrity Level)',
      unit: 'баллы',
      precision: 0,
      formula: (i) => i.severity * i.exposure * i.controllability,
      description: 'Оценка риска по методу ASIL',
    },
    {
      key: 'recommendedSIL',
      label: 'Рекомендуемый SIL',
      unit: 'уровень (1–4)',
      precision: 0,
      formula: (i) => {
        const asil = i.severity * i.exposure * i.controllability;
        if (asil <= 4) return 1;
        if (asil <= 8) return 2;
        if (asil <= 12) return 3;
        return 4;
      },
      threshold: {
        evaluate: (value) => {
          const labels = ['SIL 1 (средний контроль)', 'SIL 2 (выше среднего)', 'SIL 3 (высокий)', 'SIL 4 (максимальный)'];
          return { severity: 'warning', message: `${labels[value - 1] || 'SIL 4+'}` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р ИСО/МЭК 61508-1:2019',
      title: 'Функциональная безопасность электрических/электронных/программируемых систем',
      clause: 'п. 7.3',
      quote: 'Определение уровней целостности безопасности',
    },
    {
      code: 'ISO 26262:2018',
      title: 'Road vehicles. Functional safety',
      clause: 'Part 3, п. 8.3',
    },
  ],
};

// ===== РАСЧЁТ 5: ОЦЕНКА ВЗРЫВООПАСНОСТИ (ИНДЕКС BLEVE) =====

const pb_bleve_assessment_methodology: Methodology = {
  id: 'pb_bleve_assessment_rd03_418',
  name: 'РД 03-418-01 (BLEVE индекс)',
  description: 'Оценка вероятности и энергии взрыва с вскипанием жидкости (BLEVE) в резервуаре',
  asciiFormula: 'I_BLEVE = V × P_превышение × (T_кип − T_окруж) / 100',
  latexFormula: 'I_{BLEVE} = V \\times P_{превышение} \\times \\frac{T_{кип} - T_{окруж}}{100}',
  methodology: `
BLEVE (Boiling Liquid Expanding Vapor Explosion) — взрыв с вскипанием сжиженного газа.

Индекс BLEVE рассчитывается на основе:

I_BLEVE = V × ΔP × ΔT / K

где V — объём жидкости в резервуаре (м³)
    ΔP — избыточное давление в резервуаре (МПа)
    ΔT — разница между температурой кипения и окружающей средой (°С)
    K — коэффициент материала стенки (100 для углеродистой стали)

Интерпретация индекса:
  I < 10 → Риск BLEVE низкий
  10 ≤ I < 50 → Риск BLEVE средний (требуется контроль)
  50 ≤ I < 100 → Риск BLEVE высокий (требуются защитные меры)
  I ≥ 100 → Риск BLEVE очень высокий (необходимо переоборудование)

Энергия BLEVE: E ≈ m × λ_испарения × 1,5–3 (Дж)
где m — масса жидкости (кг)
    λ_испарения — скрытая теплота испарения (кДж/кг)
Коэффициент 1,5–3 зависит от степени вскипания
  `,
  inputs: [
    {
      key: 'vesselVolume',
      label: 'Объём резервуара',
      unit: 'м³',
      defaultValue: 10,
      range: {
        min: 0.1,
        max: 1000,
        typical: 10,
        hint: 'Общий объём резервуара',
      },
    },
    {
      key: 'excessPressure',
      label: 'Избыточное давление в резервуаре',
      unit: 'МПа',
      defaultValue: 1.5,
      range: {
        min: 0.1,
        max: 5,
        typical: 1.5,
        hint: 'Давление выше атмосферного',
        warningAbove: 3,
      },
    },
    {
      key: 'boilingPoint',
      label: 'Температура кипения жидкости',
      unit: '°С',
      defaultValue: -20,
      range: {
        min: -50,
        max: 100,
        typical: -20,
        hint: 'Для пропана: -42°С, для аммиака: -33°С',
      },
    },
    {
      key: 'ambientTemp',
      label: 'Температура окружающей среды',
      unit: '°С',
      defaultValue: 25,
      range: {
        min: -40,
        max: 50,
        typical: 25,
      },
    },
  ],
  outputs: [
    {
      key: 'tempDifference',
      label: 'Разница температур (перегрев)',
      unit: '°С',
      precision: 1,
      formula: (i) => i.ambientTemp - i.boilingPoint,
      description: 'Температура, на которую перегрета жидкость над точкой кипения',
    },
    {
      key: 'bleveIndex',
      label: 'Индекс BLEVE',
      unit: 'баллы',
      precision: 1,
      formula: (i) => (i.vesselVolume * i.excessPressure * (i.ambientTemp - i.boilingPoint)) / 100,
      threshold: {
        evaluate: (value) => {
          if (value >= 100)
            return { severity: 'critical', message: 'Очень высокий риск BLEVE — требуется немедленное переоборудование' };
          if (value >= 50)
            return { severity: 'warning', message: 'Высокий риск BLEVE — требуются защитные меры (предохранительные клапаны, охлаждение)' };
          if (value >= 10)
            return { severity: 'warning', message: 'Средний риск BLEVE — требуется мониторинг и техническое обслуживание' };
          return { severity: 'safe', message: 'Низкий риск BLEVE' };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'РД 03-418-01',
      title: 'Методические рекомендации по оценке степени риска аварий',
      clause: 'разд. 5.2',
      quote: 'Оценка BLEVE для сжиженных газов',
    },
    {
      code: 'ГОСТ Р 50856',
      title: 'Резервуары стальные горизонтальные цилиндрические для хранения сжиженного углеводородного газа',
      clause: 'п. 5.4',
    },
  ],
};

// ===== КАТЕГОРИЯ 2: ЗАЩИТА И ИНЖЕНЕРНЫЕ МЕРЫ =====

// ===== РАСЧЁТ 6: ВЕНТИЛЯЦИЯ ДЛЯ ОПАСНЫХ ВЕЩЕСТВ =====

const pb_ventilation_methodology_snip: Methodology = {
  id: 'pb_ventilation_snip31_110',
  name: 'СНиП 31-110-2003 (Вентиляция для опасных веществ)',
  description: 'Расчёт необходимого воздухообмена для нейтрализации опасного вещества или газа',
  asciiFormula: 'L = G / (C_доп − C_фон) × 3600',
  latexFormula: 'L = \\frac{G}{(C_{доп} - C_{фон})} \\times 3600',
  methodology: `
Требуемый воздухообмен (объёмный расход вентиляции) рассчитывается на основе выделения опасного вещества:

L = G / (C_доп − C_фон) × 3600

где L — требуемый воздухообмен (м³/ч)
    G — выделение вещества (г/с или мг/с)
    C_доп — допустимая концентрация в рабочей зоне (мг/м³, по ПДК)
    C_фон — фоновая концентрация (мг/м³, обычно 0)

Стандартные ПДК для опасных веществ (мг/м³):
  - Формальдегид: 0,5
  - Ацетон: 50
  - Бензол: 5
  - Хлор: 1
  - Сероводород: 10
  - Аммиак: 20
  - Оксид углерода: 20
  - Тетрахлорметан: 5

После расчёта L:
1. Выбирается воздухопровод и вентилятор по каталогу
2. Рассчитывается потеря давления
3. Устанавливается кратность воздухообмена (n = L / V_комнаты, обычно 4–6)
4. При необходимости добавляются фильтры и очистители
  `,
  inputs: [
    {
      key: 'substanceGeneration',
      label: 'Выделение вещества',
      unit: 'г/ч',
      defaultValue: 50,
      range: {
        min: 1,
        max: 10000,
        typical: 50,
        hint: 'Массовое выделение опасного вещества в час',
      },
    },
    {
      key: 'allowableConc',
      label: 'Допустимая концентрация (ПДК)',
      unit: 'мг/м³',
      defaultValue: 5,
      range: {
        min: 0.1,
        max: 100,
        typical: 5,
        hint: 'ПДК для вещества в рабочей зоне',
      },
    },
    {
      key: 'backgroundConc',
      label: 'Фоновая концентрация',
      unit: 'мг/м³',
      defaultValue: 0,
      range: {
        min: 0,
        max: 10,
        typical: 0,
        hint: 'Исходная концентрация перед вентиляцией',
      },
    },
    {
      key: 'roomVolume',
      label: 'Объём помещения',
      unit: 'м³',
      defaultValue: 100,
      range: {
        min: 10,
        max: 10000,
        typical: 100,
        hint: 'Общий объём помещения',
      },
    },
  ],
  outputs: [
    {
      key: 'requiredAirflow',
      label: 'Требуемый воздухообмен',
      unit: 'м³/ч',
      precision: 2,
      formula: (i) => (i.substanceGeneration / (i.allowableConc - i.backgroundConc)) * 3.6,
      description: 'Необходимая производительность вентиляции',
    },
    {
      key: 'aircChangeRate',
      label: 'Кратность воздухообмена',
      unit: 'ч⁻¹',
      precision: 1,
      formula: (i) => ((i.substanceGeneration / (i.allowableConc - i.backgroundConc)) * 3.6) / i.roomVolume,
      threshold: {
        evaluate: (value) => {
          if (value >= 6)
            return { severity: 'warning', message: `Кратность ${value.toFixed(1)} ч⁻¹ — очень высокая, проверьте расчёты` };
          if (value >= 4)
            return { severity: 'warning', message: `Кратность ${value.toFixed(1)} ч⁻¹ — норма для производств с опасными веществами` };
          return { severity: 'warning', message: `Кратность ${value.toFixed(1)} ч⁻¹ — обеспечивает необходимый уровень защиты` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СНиП 31-110-2003',
      title: 'Проектирование и строительство производственных зданий с опасными веществами',
      clause: 'разд. 5.3',
      quote: 'Системы вентиляции и обработки воздуха',
    },
    {
      code: 'ГОСТ 12.1.005',
      title: 'Воздух рабочей зоны. Общие санитарно-гигиенические требования',
      clause: 'табл. 1',
    },
  ],
};

// ===== РАСЧЁТ 7: РАЗМЕР ПРЕДОХРАНИТЕЛЬНОГО КЛАПАНА =====

const pb_relief_valve_methodology_gost: Methodology = {
  id: 'pb_relief_valve_gost12_2_060',
  name: 'ГОСТ 12.2.060-81 (Размер клапана)',
  description: 'Расчёт производительности предохранительного клапана по давлению и расходу',
  asciiFormula: 'Q = √(ΔP / (ρ · C²d · A²))',
  latexFormula: 'Q = \\sqrt{\\frac{\\Delta P}{\\rho \\cdot C_d^2 \\cdot A^2}}',
  methodology: `
Производительность предохранительного клапана рассчитывается на основе избыточного давления:

Q = Cv × √(ΔP / ρ_жидкость)  [для жидкостей]
Q = Cv × √((ΔP × T) / (M × Z))  [для газов]

где Q — объёмный расход (л/мин или м³/ч)
    Cv — коэффициент пропускной способности клапана
    ΔP — разница давлений на клапане (бар)
    ρ — плотность среды (кг/м³)
    T — абсолютная температура (К)
    M — молярная масса (г/моль)
    Z — коэффициент сжимаемости

Подбор клапана:
1. Определяется максимальный расход Q_макс (при нормальной работе оборудования)
2. Добавляется запас ~20% (Q_расч = Q_макс × 1.2)
3. По каталогу подбирается клапан с Cv ≥ Q_расч
4. Проверяется, что срабатывает при установленном давлении (обычно 110% от рабочего)
5. Стандартные размеры: Cv = 2, 4, 6, 10, 16, 25, 40, 60, 100 л/мин
  `,
  inputs: [
    {
      key: 'normalFlow',
      label: 'Нормальный расход жидкости/газа',
      unit: 'л/мин',
      defaultValue: 50,
      range: {
        min: 1,
        max: 1000,
        typical: 50,
        hint: 'Максимальный расход при нормальной работе',
      },
    },
    {
      key: 'pressureDrop',
      label: 'Избыточное давление на клапане',
      unit: 'бар',
      defaultValue: 2,
      range: {
        min: 0.5,
        max: 50,
        typical: 2,
        hint: 'Перепад давления: входное минус выходное',
      },
    },
    {
      key: 'safetyMargin',
      label: 'Коэффициент запаса',
      unit: '1',
      defaultValue: 1.2,
      range: {
        min: 1,
        max: 2,
        typical: 1.2,
        hint: 'Обычно 1,2 (20% запас)',
      },
    },
  ],
  outputs: [
    {
      key: 'requiredCapacity',
      label: 'Требуемая пропускная способность',
      unit: 'л/мин',
      precision: 1,
      formula: (i) => i.normalFlow * i.safetyMargin,
      description: 'Минимальная производительность клапана с учётом запаса',
    },
    {
      key: 'suggestedCv',
      label: 'Рекомендуемый Cv (код клапана)',
      unit: 'л/мин',
      precision: 0,
      formula: (i) => {
        const req = i.normalFlow * i.safetyMargin;
        const cvOptions = [2, 4, 6, 10, 16, 25, 40, 60, 100];
        for (const cv of cvOptions) {
          if (cv >= req) return cv;
        }
        return 100;
      },
      threshold: {
        evaluate: (value) => {
          return { severity: 'warning', message: `Выбрать стандартный клапан с Cv = ${value} л/мин` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 12.2.060-81',
      title: 'Оборудование производственное. Общие требования безопасности',
      clause: 'п. 4.6',
      quote: 'Предохранительные устройства от избыточного давления',
    },
    {
      code: 'СП 53-105-2000',
      title: 'Проектирование и строительство водопровода из полиэтиленовых труб',
      clause: 'п. 5.2',
    },
  ],
};

// ===== РАСЧЁТ 8: РАСЧЁТ БУФЕРНОЙ ЗОНЫ ВОКРУГ ИСТОЧНИКА =====

const pb_buffer_zone_methodology_rd: Methodology = {
  id: 'pb_buffer_zone_rd03_418',
  name: 'РД 03-418-01 (Буферная зона)',
  description: 'Расчёт радиуса буферной зоны вокруг опасного объекта на основе класса опасности',
  asciiFormula: 'r = 100 · √(q / K)',
  latexFormula: 'r = 100 \\cdot \\sqrt{\\frac{q}{K}}',
  methodology: `
Буферная зона (зона отчуждения) рассчитывается для предотвращения попадания людей в зону поражения:

r = 100 × √(q / K)

где r — радиус буферной зоны (м)
    q — характеристическая величина опасного вещества (т)
    K — коэффициент класса опасности

Классы опасности и коэффициенты K:
  Класс 1 (высокий риск): K = 250–400
    Пример: хлор (Cl₂), сероводород (H₂S), аммиак (NH₃)

  Класс 2 (средний риск): K = 100–250
    Пример: азотная кислота (HNO₃), серная кислота (H₂SO₄)

  Класс 3 (низкий риск): K = 30–100
    Пример: щёлочи, органические растворители

  Класс 4 (минимальный риск): K = 10–30
    Пример: топливо, масло, газ на низком давлении

Альтернативный упрощённый метод:
r = 100 × √(m)  [для прямого расчёта через массу в тоннах]
  `,
  inputs: [
    {
      key: 'substanceMass',
      label: 'Масса опасного вещества',
      unit: 'т',
      defaultValue: 10,
      range: {
        min: 0.1,
        max: 1000,
        typical: 10,
        hint: 'Общая масса опасного вещества на объекте',
      },
    },
    {
      key: 'hazardClass',
      label: 'Класс опасности',
      unit: 'выбор (1–4)',
      defaultValue: 2,
      range: {
        min: 1,
        max: 4,
        typical: 2,
        hint: '1=высокий (хлор), 2=средний (кислоты), 3=низкий, 4=минимальный',
      },
    },
  ],
  outputs: [
    {
      key: 'bufferRadius',
      label: 'Радиус буферной зоны',
      unit: 'м',
      precision: 2,
      formula: (i) => {
        const kValues = [0, 400, 250, 100, 30]; // K для классов 1–4
        const k = kValues[i.hazardClass] || 100;
        return 100 * Math.sqrt(i.substanceMass / k);
      },
      description: 'Минимальное расстояние до границы жилой/рабочей зоны',
      threshold: {
        evaluate: (value) => {
          if (value > 500)
            return { severity: 'warning', message: `Очень большая буферная зона (${value.toFixed(0)} м) — требуется серьёзное переоборудование или переселение` };
          if (value > 100)
            return { severity: 'warning', message: `Буферная зона ${value.toFixed(0)} м — требует согласования с местными органами` };
          return { severity: 'safe', message: `Буферная зона ${value.toFixed(0)} м — в допустимых пределах` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'РД 03-418-01',
      title: 'Методические рекомендации по оценке степени риска аварий на опасных производственных объектах',
      clause: 'разд. 3.2',
      quote: 'Определение границ зон поражения и зон влияния',
    },
    {
      code: 'Федеральный закон № 116-ФЗ',
      title: 'О безопасности на опасных производственных объектах',
      clause: 'ст. 9',
    },
  ],
};

// ===== РАСЧЁТ 9: ВРЕМЯ СРАБАТЫВАНИЯ СИСТЕМ ЗАЩИТЫ =====

const pb_protection_response_time_methodology: Methodology = {
  id: 'pb_response_time_iso61508',
  name: 'ГОСТ Р ИСО/МЭК 61508 (Время срабатывания)',
  description: 'Расчёт времени от обнаружения опасного события до полного срабатывания защитной системы',
  asciiFormula: 't_отклик = t_детект + t_обраб + t_срабат',
  latexFormula: 't_{отклик} = t_{детект} + t_{обраб} + t_{срабат}',
  methodology: `
Полное время отклика системы защиты складывается из трёх компонентов:

t_отклик = t_детект + t_обработка + t_срабатывание

где t_детект — время обнаружения опасного события (мс)
    t_обработка — время обработки сигнала логикой контроллера (мс)
    t_срабатывание — время физического срабатывания исполнительного элемента (мс)

Типовые значения (в миллисекундах):

Детектирование:
  - Датчик температуры (терморезистор): 100–500 мс
  - Датчик давления (электрический): 50–200 мс
  - Камера видеонаблюдения (обработка): 500–2000 мс
  - Дымовой датчик: 30–100 мс

Обработка (контроллер/PLC):
  - Быстрая логика (SIL 3–4): 10–50 мс
  - Стандартная логика: 50–200 мс
  - Сложная логика (машинное обучение): 200–1000 мс

Срабатывание (исполнительные элементы):
  - Электромагнитный клапан: 20–100 мс
  - Гидравлический привод: 50–500 мс
  - Механический тормоз: 100–500 мс
  - Двигатель отключение: 50–200 мс

Требуемое время отклика зависит от SIL:
  SIL 1: t ≤ 5 сек (5000 мс)
  SIL 2: t ≤ 2 сек (2000 мс)
  SIL 3: t ≤ 1 сек (1000 мс)
  SIL 4: t ≤ 500 мс
  `,
  inputs: [
    {
      key: 'detectionTime',
      label: 'Время обнаружения (датчик)',
      unit: 'мс',
      defaultValue: 200,
      range: {
        min: 10,
        max: 2000,
        typical: 200,
        hint: 'Время срабатывания датчика',
      },
    },
    {
      key: 'processingTime',
      label: 'Время обработки (контроллер)',
      unit: 'мс',
      defaultValue: 100,
      range: {
        min: 10,
        max: 1000,
        typical: 100,
        hint: 'Время обработки логики PLC/контроллера',
      },
    },
    {
      key: 'actuationTime',
      label: 'Время срабатывания (исполнитель)',
      unit: 'мс',
      defaultValue: 150,
      range: {
        min: 20,
        max: 1000,
        typical: 150,
        hint: 'Время срабатывания клапана, тормоза, привода',
      },
    },
  ],
  outputs: [
    {
      key: 'totalResponseTime',
      label: 'Полное время отклика системы',
      unit: 'мс',
      precision: 0,
      formula: (i) => i.detectionTime + i.processingTime + i.actuationTime,
      description: 'Общее время от обнаружения до полного срабатывания',
    },
    {
      key: 'requiredSIL',
      label: 'Достаточный SIL',
      unit: 'уровень (1–4)',
      precision: 0,
      formula: (i) => {
        const total = i.detectionTime + i.processingTime + i.actuationTime;
        if (total <= 500) return 4;
        if (total <= 1000) return 3;
        if (total <= 2000) return 2;
        return 1;
      },
      threshold: {
        evaluate: (value) => {
          const levels = ['SIL 1 (базовый)', 'SIL 2 (повышенный)', 'SIL 3 (высокий)', 'SIL 4 (максимальный)'];
          return { severity: 'warning', message: `Система обеспечивает ${levels[value - 1] || 'SIL 4+'}` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ Р ИСО/МЭК 61508-4:2019',
      title: 'Функциональная безопасность. Определение показателей безопасности',
      clause: 'п. 7.4',
      quote: 'Время отклика функциональной безопасности',
    },
    {
      code: 'IEC 61511:2016',
      title: 'Functional safety. Safety instrumented systems for the process industry sector',
      clause: 'Part 2, п. 8.2',
    },
  ],
};

// ===== РАСЧЁТ 10: ЭФФЕКТИВНОСТЬ СИЗ (СРЕДСТВ ИНДИВИДУАЛЬНОЙ ЗАЩИТЫ) =====

const pb_ppe_effectiveness_methodology_gost: Methodology = {
  id: 'pb_ppe_effectiveness_gost12_4_041',
  name: 'ГОСТ 12.4.041-89 (Эффективность СИЗ)',
  description: 'Расчёт остаточного риска воздействия вредного фактора при использовании СИЗ',
  asciiFormula: 'R_остат = R_исход × (1 − η) / 100',
  latexFormula: 'R_{остат} = R_{исход} \\times \\frac{1 - \\eta}{100}',
  methodology: `
Эффективность СИЗ оценивается на основе коэффициента защиты (η):

R_остат = R_исходный × (1 − η / 100)

где R_остат — остаточный риск
    R_исходный — исходный риск без СИЗ
    η — коэффициент эффективности СИЗ (0–100%)

Типовые коэффициенты защиты для СИЗ (в %):

Средства защиты дыхания:
  - Респиратор без картриджа (марля): 10–20%
  - Противопыльный респиратор: 60–80%
  - Фильтрующий противогаз: 85–95%
  - Шланговый противогаз: 95–99%

Средства защиты от шума:
  - Вата (без защиты): 5–10%
  - Беруши (поролон): 15–25%
  - Наушники простые: 20–30%
  - Наушники с активным шумоподавлением: 75–85%

Средства защиты от попадания (очки, щиток):
  - Обычные очки: 50–70%
  - Защитный щиток: 85–95%
  - Полнолицевая маска: 95–99%

Средства защиты от химических веществ:
  - Хлопчатобумажный фартук: 30–40%
  - Прорезиненный фартук: 70–80%
  - Защитный костюм (полный): 85–95%
  - Химически стойкий костюм: 98–99%

Остаточный риск = R_исходный × (100 − η) / 100

Если R_остаток ≤ R_допустимый, СИЗ достаточно эффективны.
  `,
  inputs: [
    {
      key: 'initialRisk',
      label: 'Исходный риск воздействия',
      unit: 'баллы (1–10) или условные единицы',
      defaultValue: 8,
      range: {
        min: 1,
        max: 10,
        typical: 5,
        hint: '1=минимальный, 10=критический без защиты',
      },
    },
    {
      key: 'ppeEffectiveness',
      label: 'Эффективность СИЗ',
      unit: '%',
      defaultValue: 85,
      range: {
        min: 5,
        max: 99,
        typical: 80,
        hint: '0%=нет защиты, 100%=полная защита (невозможно)',
      },
    },
    {
      key: 'allowableRisk',
      label: 'Допустимый уровень риска',
      unit: 'баллы (1–10)',
      defaultValue: 2,
      range: {
        min: 1,
        max: 10,
        typical: 2,
        hint: 'Максимально допустимый уровень для данной операции',
      },
    },
  ],
  outputs: [
    {
      key: 'residualRisk',
      label: 'Остаточный риск после СИЗ',
      unit: 'баллы',
      precision: 2,
      formula: (i) => i.initialRisk * (1 - i.ppeEffectiveness / 100),
      description: 'Риск воздействия, остающийся после использования СИЗ',
    },
    {
      key: 'isAcceptable',
      label: 'Статус защиты',
      unit: 'вердикт',
      precision: 0,
      formula: (i) => {
        const residual = i.initialRisk * (1 - i.ppeEffectiveness / 100);
        if (residual <= i.allowableRisk) return 1; // Acceptable
        return 0; // Not acceptable
      },
      threshold: {
        evaluate: (_value, inputs) => {
          const residual = inputs.initialRisk * (1 - inputs.ppeEffectiveness / 100);
          if (residual <= inputs.allowableRisk)
            return { severity: 'safe', message: `✓ СИЗ обеспечивают приемлемый уровень защиты (остаточный риск ${residual.toFixed(2)})` };
          return { severity: 'critical', message: `✗ СИЗ НЕДОСТАТОЧНЫ! Остаточный риск ${residual.toFixed(2)} превышает допустимый ${inputs.allowableRisk}` };
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 12.4.041-89',
      title: 'Средства индивидуальной защиты. Общие требования и методы контроля защитного действия',
      clause: 'п. 4–5',
      quote: 'Оценка эффективности и выбор СИЗ',
    },
    {
      code: 'СП 1.1.1058-01',
      title: 'Организация и проведение производственной санитарии и гигиены труда',
      clause: 'разд. 4',
    },
  ],
};

// ===== ЭКСПОРТ =====

export const PB_CALCULATIONS: FullCalculation[] = [
  // Категория 1: Оценка рисков и безопасность
  {
    id: 'pb-risk-assessment',
    name: 'Оценка риска (матрица вероятность × последствия)',
    description: 'Матричная оценка профессиональных рисков по шкале вероятности и тяжести',
    category: 'safety',
    asciiFormula: 'Risk = Probability × Severity',
    latexFormula: 'Risk = P \\times S',
    methodology: pb_risk_assessment_methodology_gost.methodology,
    inputs: pb_risk_assessment_methodology_gost.inputs,
    outputs: pb_risk_assessment_methodology_gost.outputs,
    normativeRefs: pb_risk_assessment_methodology_gost.normativeRefs,
    keywords: ['риск', 'безопасность', 'вероятность', 'последствия', 'матрица рисков'],
  },
  {
    id: 'pb-evacuation-time',
    name: 'Время эвакуации из помещения',
    description: 'Расчёт времени безопасной эвакуации людей при аварийной ситуации',
    category: 'safety',
    asciiFormula: 't = L / v + t₀',
    latexFormula: 't = \\frac{L}{v} + t_0',
    methodology: pb_evacuation_time_methodology_snip.methodology,
    inputs: pb_evacuation_time_methodology_snip.inputs,
    outputs: pb_evacuation_time_methodology_snip.outputs,
    normativeRefs: pb_evacuation_time_methodology_snip.normativeRefs,
    keywords: ['эвакуация', 'время', 'пожар', 'помещение', 'выход'],
  },
  {
    id: 'pb-safe-distance',
    name: 'Безопасное расстояние от источника опасности',
    description: 'Минимальное расстояние до опасного объекта на основе энергии взрыва',
    category: 'safety',
    asciiFormula: 'd = √(E / (4π·P_доп))',
    latexFormula: 'd = \\sqrt{\\frac{E}{4\\pi \\cdot P_{доп}}}',
    methodology: pb_safe_distance_methodology.methodology,
    inputs: pb_safe_distance_methodology.inputs,
    outputs: pb_safe_distance_methodology.outputs,
    normativeRefs: pb_safe_distance_methodology.normativeRefs,
    keywords: ['расстояние', 'безопасность', 'взрыв', 'давление', 'зона поражения'],
  },
  {
    id: 'pb-sil-calculation',
    name: 'Уровень целостности безопасности (SIL)',
    description: 'Определение требуемого SIL для защитной системы на основе ASIL',
    category: 'safety',
    asciiFormula: 'SIL = f(ASIL, PFD, MTTRrepair)',
    latexFormula: 'SIL = f(ASIL, PFD, MTTR_{repair})',
    methodology: pb_sil_methodology_iso61508.methodology,
    inputs: pb_sil_methodology_iso61508.inputs,
    outputs: pb_sil_methodology_iso61508.outputs,
    normativeRefs: pb_sil_methodology_iso61508.normativeRefs,
    keywords: ['SIL', 'ASIL', 'целостность', 'безопасность', 'риск', 'система'],
  },
  {
    id: 'pb-bleve-index',
    name: 'Оценка взрывоопасности (BLEVE индекс)',
    description: 'Оценка вероятности взрыва с вскипанием сжиженного газа в резервуаре',
    category: 'safety',
    asciiFormula: 'I_BLEVE = V × P_превышение × ΔT / 100',
    latexFormula: 'I_{BLEVE} = V \\times P_{превышение} \\times \\frac{\\Delta T}{100}',
    methodology: pb_bleve_assessment_methodology.methodology,
    inputs: pb_bleve_assessment_methodology.inputs,
    outputs: pb_bleve_assessment_methodology.outputs,
    normativeRefs: pb_bleve_assessment_methodology.normativeRefs,
    keywords: ['BLEVE', 'взрыв', 'резервуар', 'газ', 'давление', 'испарение'],
  },

  // Категория 2: Защита и инженерные меры
  {
    id: 'pb-ventilation-hazmat',
    name: 'Вентиляция для опасных веществ',
    description: 'Расчёт необходимого воздухообмена для нейтрализации опасного вещества',
    category: 'safety',
    asciiFormula: 'L = G / (C_доп − C_фон) × 3600',
    latexFormula: 'L = \\frac{G}{(C_{доп} - C_{фон})} \\times 3600',
    methodology: pb_ventilation_methodology_snip.methodology,
    inputs: pb_ventilation_methodology_snip.inputs,
    outputs: pb_ventilation_methodology_snip.outputs,
    normativeRefs: pb_ventilation_methodology_snip.normativeRefs,
    keywords: ['вентиляция', 'опасное вещество', 'воздухообмен', 'ПДК', 'концентрация'],
  },
  {
    id: 'pb-relief-valve',
    name: 'Размер предохранительного клапана',
    description: 'Расчёт производительности и выбор предохранительного клапана по давлению',
    category: 'safety',
    asciiFormula: 'Q = √(ΔP / (ρ · Cd² · A²))',
    latexFormula: 'Q = \\sqrt{\\frac{\\Delta P}{\\rho \\cdot C_d^2 \\cdot A^2}}',
    methodology: pb_relief_valve_methodology_gost.methodology,
    inputs: pb_relief_valve_methodology_gost.inputs,
    outputs: pb_relief_valve_methodology_gost.outputs,
    normativeRefs: pb_relief_valve_methodology_gost.normativeRefs,
    keywords: ['клапан', 'давление', 'расход', 'защита', 'предохранительный'],
  },
  {
    id: 'pb-buffer-zone',
    name: 'Буферная зона вокруг источника опасности',
    description: 'Расчёт радиуса зоны отчуждения вокруг опасного производственного объекта',
    category: 'safety',
    asciiFormula: 'r = 100 · √(q / K)',
    latexFormula: 'r = 100 \\cdot \\sqrt{\\frac{q}{K}}',
    methodology: pb_buffer_zone_methodology_rd.methodology,
    inputs: pb_buffer_zone_methodology_rd.inputs,
    outputs: pb_buffer_zone_methodology_rd.outputs,
    normativeRefs: pb_buffer_zone_methodology_rd.normativeRefs,
    keywords: ['буферная зона', 'отчуждение', 'расстояние', 'жилая зона', 'опасный объект'],
  },
  {
    id: 'pb-protection-response-time',
    name: 'Время срабатывания систем защиты',
    description: 'Расчёт полного времени отклика системы защиты от обнаружения до срабатывания',
    category: 'safety',
    asciiFormula: 't_отклик = t_детект + t_обраб + t_срабат',
    latexFormula: 't_{отклик} = t_{детект} + t_{обраб} + t_{срабат}',
    methodology: pb_protection_response_time_methodology.methodology,
    inputs: pb_protection_response_time_methodology.inputs,
    outputs: pb_protection_response_time_methodology.outputs,
    normativeRefs: pb_protection_response_time_methodology.normativeRefs,
    keywords: ['время отклика', 'срабатывание', 'датчик', 'защита', 'SIL', 'система'],
  },
  {
    id: 'pb-ppe-effectiveness',
    name: 'Эффективность средств индивидуальной защиты (СИЗ)',
    description: 'Расчёт остаточного риска при использовании СИЗ и оценка их достаточности',
    category: 'safety',
    asciiFormula: 'R_остат = R_исход × (1 − η) / 100',
    latexFormula: 'R_{остат} = R_{исход} \\times \\frac{1 - \\eta}{100}',
    methodology: pb_ppe_effectiveness_methodology_gost.methodology,
    inputs: pb_ppe_effectiveness_methodology_gost.inputs,
    outputs: pb_ppe_effectiveness_methodology_gost.outputs,
    normativeRefs: pb_ppe_effectiveness_methodology_gost.normativeRefs,
    keywords: ['СИЗ', 'защита', 'эффективность', 'остаточный риск', 'фактор защиты'],
  },
];
