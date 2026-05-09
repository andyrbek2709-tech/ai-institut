import { FullCalculation } from '../types';

// ============================================================================
// ФАЗА 2: TH — ТЕПЛОТЕХНИЧЕСКИЕ РАСЧЁТЫ (28 расчётов)
// ============================================================================
// Гидравлические расчеты (1-10), Прочность (11-17), Свойства теплоносителя (18-23), Системные (24-28)

export const TH_CALCULATIONS: FullCalculation[] = [
  // ========== ГИДРАВЛИЧЕСКИЕ РАСЧЕТЫ (1-10) ==========

  {
    id: 'th-flow-rate',
    name: 'Расход жидкости в трубопроводе',
    description: 'Определение расхода теплоносителя по площади сечения и скорости потока',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_flow_gost',
        name: 'ГОСТ 32569 — Стандартная методика',
        description: 'Расчёт расхода по уравнению неразрывности для несжимаемой жидкости',
        asciiFormula: 'Q = v × (π × d² / 4) = v × A',
        latexFormula: 'Q = v \\times \\frac{\\pi d^2}{4} = v \\times A',
        methodology:
          'Расход рассчитывается по классическому уравнению неразрывности: Q = v·A, где v — средняя скорость потока (м/с), A — площадь сечения трубы (м²). Стандартные рекомендации скоростей: отопление 0.3–0.7 м/с, горячее водоснабжение 0.6–1.5 м/с, холодное водоснабжение 0.6–2.0 м/с. Для всасывающих линий не превышать 0.6 м/с, для нагнетательных 1.5–3.0 м/с.',
        inputs: [
          {
            key: 'velocity',
            label: 'Скорость потока',
            unit: 'м/с',
            defaultValue: 0.5,
            range: { min: 0.1, max: 3.0, typical: 0.5, hint: 'Зависит от типа системы и условий' },
          },
          {
            key: 'diameter',
            label: 'Внутренний диаметр трубы',
            unit: 'мм',
            defaultValue: 32,
            range: { min: 8, max: 500, typical: 32, hint: 'Стандартные размеры: 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 90, 110...' },
          },
        ],
        outputs: [
          {
            key: 'area',
            label: 'Площадь сечения',
            unit: 'мм²',
            precision: 2,
            formula: (i) => (Math.PI * i.diameter ** 2) / 4,
          },
          {
            key: 'flowRate',
            label: 'Расход жидкости',
            unit: 'л/ч',
            precision: 1,
            formula: (i) => (i.velocity * Math.PI * i.diameter ** 2 / 4000) * 3600,
            threshold: {
              evaluate: (value) => {
                if (value > 10000) return { severity: 'warning', message: 'Очень высокий расход — проверить диаметр' };
                return null;
              },
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'Отопление, вентиляция' },
        ],
      },
      {
        id: 'th_flow_iso',
        name: 'ISO 6162 — Гидравлические системы',
        description: 'Международный стандарт для гидравлических систем',
        asciiFormula: 'Q = v × A',
        latexFormula: 'Q = v \\times A',
        methodology:
          'Методика расчёта расхода по ISO 6162 (Hydraulic fluid power systems — Interface surfaces and port sizes). Аналогична методике ГОСТ, с упором на гидравлические системы. Рекомендуемые скорости: всасывающие линии 0.6–1.2 м/с, напорные 2.0–4.5 м/с, сливные 1.5–2.5 м/с.',
        inputs: [
          {
            key: 'velocity',
            label: 'Скорость потока',
            unit: 'м/с',
            defaultValue: 2.5,
            range: { min: 0.5, max: 5.0, typical: 2.5, hint: 'Для гидравлики выше, чем для отопления' },
          },
          {
            key: 'diameter',
            label: 'Внутренний диаметр',
            unit: 'мм',
            defaultValue: 25,
            range: { min: 8, max: 250, typical: 25 },
          },
        ],
        outputs: [
          {
            key: 'flowRate',
            label: 'Расход',
            unit: 'л/мин',
            precision: 1,
            formula: (i) => (i.velocity * Math.PI * i.diameter ** 2 / 4000) * 60,
          },
        ],
        normativeRefs: [
          { code: 'ISO 6162', title: 'Hydraulic fluid power systems — Interface surfaces' },
          { code: 'ISO 4414', title: 'Hydraulic systems — General rules and safety' },
        ],
      },
    ],
    defaultMethodologyId: 'th_flow_gost',
  },

  {
    id: 'th-reynolds-number',
    name: 'Число Рейнольдса и режим потока',
    description: 'Определение характера движения жидкости (ламинарный, переходный, турбулентный)',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_reynolds_gost',
        name: 'ГОСТ — Классическое определение',
        description: 'Расчёт критерия Рейнольдса по классической формуле',
        asciiFormula: 'Re = (ρ × v × d) / η = (v × d) / ν',
        latexFormula: 'Re = \\frac{\\rho \\times v \\times d}{\\eta} = \\frac{v \\times d}{\\nu}',
        methodology:
          'Число Рейнольдса определяет режим потока жидкости. Re < 2300 — ламинарный режим, Re > 4000 — турбулентный, 2300–4000 — переходная зона. Критическое число для круглых труб Re_кр = 2320 (по Пуазейлю). Вязкость жидкости значительно зависит от температуры.',
        inputs: [
          {
            key: 'velocity',
            label: 'Скорость потока',
            unit: 'м/с',
            defaultValue: 0.5,
            range: { min: 0.01, max: 5.0, typical: 0.5 },
          },
          {
            key: 'diameter',
            label: 'Диаметр трубы',
            unit: 'мм',
            defaultValue: 32,
            range: { min: 5, max: 500, typical: 32 },
          },
          {
            key: 'kinematicViscosity',
            label: 'Кинематическая вязкость',
            unit: 'мм²/с',
            defaultValue: 0.658,
            range: { min: 0.1, max: 100, typical: 0.658, hint: 'Вода при 60°C ~ 0.658 мм²/с' },
          },
        ],
        outputs: [
          {
            key: 'reynoldsNumber',
            label: 'Число Рейнольдса',
            unit: '—',
            precision: 0,
            formula: (i) => (i.velocity * 1000 * i.diameter) / i.kinematicViscosity,
          },
          {
            key: 'flowRegime',
            label: 'Режим потока',
            unit: '—',
            precision: 0,
            formula: (i) => {
              const re = (i.velocity * 1000 * i.diameter) / i.kinematicViscosity;
              return re < 2300 ? 1 : re > 4000 ? 3 : 2;
            },
            description: '1 = Ламинарный, 2 = Переходный, 3 = Турбулентный',
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СНиП 2.04.01-85', title: 'Внутренний водопровод и канализация' },
        ],
      },
    ],
    defaultMethodologyId: 'th_reynolds_gost',
  },

  {
    id: 'th-pressure-drop-darcy',
    name: 'Потери давления по Дарси-Вейсбаху',
    description: 'Расчёт потерь давления на трение в трубопроводе при ламинарном и турбулентном режимах',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_darcy_gost',
        name: 'ГОСТ 32569 — Дарси-Вейсбах',
        description: 'Методика расчёта по формуле Дарси-Вейсбаха с коэффициентом λ',
        asciiFormula: 'Δp = λ × (L/d) × (ρ × v²/2)',
        latexFormula: '\\Delta p = \\lambda \\times \\frac{L}{d} \\times \\frac{\\rho \\times v^2}{2}',
        methodology:
          'Потери давления вычисляются по формуле Дарси-Вейсбаха. Коэффициент трения λ зависит от режима потока: λ = 64/Re (ламинарный), λ ≈ 0.316/Re^0.25 (турбулентный). Шероховатость трубы: сталь 0.05 мм, медь 0.0015 мм, пластик 0.007 мм. L — длина трубопровода (м), d — диаметр (м).',
        inputs: [
          {
            key: 'friction',
            label: 'Коэффициент трения λ',
            unit: '—',
            defaultValue: 0.03,
            range: { min: 0.01, max: 0.1, typical: 0.03, hint: 'Зависит от Re и шероховатости (диаграмма Муди)' },
          },
          {
            key: 'length',
            label: 'Длина трубопровода',
            unit: 'м',
            defaultValue: 100,
            range: { min: 1, max: 10000, typical: 100 },
          },
          {
            key: 'diameter',
            label: 'Диаметр трубы',
            unit: 'мм',
            defaultValue: 32,
            range: { min: 5, max: 500, typical: 32 },
          },
          {
            key: 'velocity',
            label: 'Скорость потока',
            unit: 'м/с',
            defaultValue: 0.5,
            range: { min: 0.01, max: 5.0, typical: 0.5 },
          },
          {
            key: 'density',
            label: 'Плотность жидкости',
            unit: 'кг/м³',
            defaultValue: 983,
            range: { min: 600, max: 1200, typical: 983, hint: 'Вода при 60°C = 983 кг/м³' },
          },
        ],
        outputs: [
          {
            key: 'pressureDrop',
            label: 'Потери давления',
            unit: 'кПа',
            precision: 2,
            formula: (i) =>
              (i.friction * (i.length / (i.diameter / 1000)) * (i.density * i.velocity ** 2 / 2)) / 1000,
            threshold: {
              evaluate: (value) => {
                if (value > 100) return { severity: 'warning', message: 'Высокие потери давления' };
                return null;
              },
            },
          },
          {
            key: 'pressureDropPerMeter',
            label: 'Удельные потери',
            unit: 'Па/м',
            precision: 2,
            formula: (i) =>
              (i.friction * (i.length / (i.diameter / 1000)) * (i.density * i.velocity ** 2 / 2)) / i.length,
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_darcy_gost',
  },

  {
    id: 'th-local-resistance',
    name: 'Местные сопротивления в трубопроводе',
    description: 'Расчёт потерь давления на фитингах, клапанах, изменениях сечения',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_local_resist_gost',
        name: 'ГОСТ — Коэффициенты сопротивления',
        description: 'Расчёт по коэффициентам местных сопротивлений',
        asciiFormula: 'Δp_мест = ζ × (ρ × v²/2)',
        latexFormula: '\\Delta p_{\\text{мест}} = \\zeta \\times \\frac{\\rho \\times v^2}{2}',
        methodology:
          'Местные сопротивления рассчитываются по формуле: Δp = ζ·(ρ·v²/2). Коэффициенты ζ для типовых элементов: прямой отвод (90°) 0.3–1.2, тройник проходной 0.3–0.6, тройник боковой 0.5–2.0, клапан обратный 1.5–3.0, клапан регулирующий 2.5–3.5, колено 45° 0.2–0.4, подобие вход 0.5, выход 1.0.',
        inputs: [
          {
            key: 'resistanceCoeff',
            label: 'Коэффициент сопротивления ζ',
            unit: '—',
            defaultValue: 0.5,
            range: { min: 0.1, max: 5.0, typical: 0.5, hint: 'Сумма всех местных сопротивлений на участке' },
          },
          {
            key: 'velocity',
            label: 'Скорость потока',
            unit: 'м/с',
            defaultValue: 0.5,
            range: { min: 0.01, max: 5.0, typical: 0.5 },
          },
          {
            key: 'density',
            label: 'Плотность жидкости',
            unit: 'кг/м³',
            defaultValue: 983,
            range: { min: 600, max: 1200, typical: 983 },
          },
        ],
        outputs: [
          {
            key: 'localPressureDrop',
            label: 'Потери на местные сопротивления',
            unit: 'Па',
            precision: 1,
            formula: (i) => i.resistanceCoeff * (i.density * i.velocity ** 2 / 2),
          },
          {
            key: 'localPressureDropKPa',
            label: 'Потери (кПа)',
            unit: 'кПа',
            precision: 3,
            formula: (i) => (i.resistanceCoeff * (i.density * i.velocity ** 2 / 2)) / 1000,
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_local_resist_gost',
  },

  {
    id: 'th-pump-head',
    name: 'Напор насоса (полезный напор)',
    description: 'Расчёт необходимого напора для преодоления гидравлических сопротивлений',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_pump_gost',
        name: 'ГОСТ — Уравнение энергии',
        description: 'Расчёт полезного напора по уравнению энергии',
        asciiFormula: 'H = Δp / (ρ × g) + Δz',
        latexFormula: 'H = \\frac{\\Delta p}{\\rho \\times g} + \\Delta z',
        methodology:
          'Полезный напор насоса вычисляется как сумма гидравлического напора (потери давления, делённые на вес единицы жидкости) и геометрической высоты подъёма. Полная мощность насоса: N = (Q × H × ρ × g) / η, где η ~ 0.75–0.85 для центробежных насосов.',
        inputs: [
          {
            key: 'pressureDrop',
            label: 'Полные потери давления',
            unit: 'кПа',
            defaultValue: 50,
            range: { min: 1, max: 500, typical: 50 },
          },
          {
            key: 'heightDifference',
            label: 'Геодезическая высота',
            unit: 'м',
            defaultValue: 5,
            range: { min: 0, max: 100, typical: 5 },
          },
          {
            key: 'density',
            label: 'Плотность жидкости',
            unit: 'кг/м³',
            defaultValue: 983,
            range: { min: 600, max: 1200, typical: 983 },
          },
        ],
        outputs: [
          {
            key: 'hydroHead',
            label: 'Гидравлический напор',
            unit: 'м',
            precision: 2,
            formula: (i) => i.pressureDrop / (i.density * 9.81 / 1000),
          },
          {
            key: 'totalHead',
            label: 'Полный напор насоса',
            unit: 'м',
            precision: 2,
            formula: (i) => i.pressureDrop / (i.density * 9.81 / 1000) + i.heightDifference,
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 8973-73', title: 'Насосы центробежные' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_pump_gost',
  },

  {
    id: 'th-pipe-diameter-selection',
    name: 'Выбор диаметра трубопровода',
    description: 'Подбор диаметра по допустимой скорости потока и расходу',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_diameter_gost',
        name: 'ГОСТ — По критериям скорости',
        description: 'Подбор диаметра из стандартного ряда по рекомендуемым скоростям',
        asciiFormula: 'd = sqrt(4 × Q / (π × v))',
        latexFormula: 'd = \\sqrt{\\frac{4 \\times Q}{\\pi \\times v}}',
        methodology:
          'Диаметр подбирается по формуле d = √(4·Q/(π·v)), где Q — расход (м³/с), v — рекомендуемая скорость. Затем округляется до ближайшего стандартного размера (6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160...). Рекомендуемые скорости: подающие линии 0.3–1.0 м/с, обратные 0.2–0.5 м/с, всасывающие ≤0.6 м/с.',
        inputs: [
          {
            key: 'flowRate',
            label: 'Расход жидкости',
            unit: 'л/ч',
            defaultValue: 2000,
            range: { min: 10, max: 100000, typical: 2000 },
          },
          {
            key: 'velocity',
            label: 'Рекомендуемая скорость',
            unit: 'м/с',
            defaultValue: 0.5,
            range: { min: 0.1, max: 3.0, typical: 0.5, hint: 'Отопление: 0.3–0.7, ГВС: 0.6–1.5' },
          },
        ],
        outputs: [
          {
            key: 'diameterRequired',
            label: 'Требуемый диаметр',
            unit: 'мм',
            precision: 1,
            formula: (i) => {
              const qMs = i.flowRate / 3600000;
              return Math.sqrt((4 * qMs) / (Math.PI * i.velocity)) * 1000;
            },
          },
          {
            key: 'diameterStandard',
            label: 'Стандартный диаметр',
            unit: 'мм',
            precision: 0,
            formula: (i) => {
              const qMs = i.flowRate / 3600000;
              const required = Math.sqrt((4 * qMs) / (Math.PI * i.velocity)) * 1000;
              const standardSizes = [6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200];
              return standardSizes.find((s) => s >= required) || standardSizes[standardSizes.length - 1];
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_diameter_gost',
  },

  {
    id: 'th-cavitation-check',
    name: 'Проверка на кавитацию',
    description: 'Проверка условия для предотвращения образования паровых пузырей в насосе',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_cavitation_gost',
        name: 'ГОСТ — Критическая высота всасывания',
        description: 'Расчёт допустимой высоты всасывания для предотвращения кавитации',
        asciiFormula: 'h_вс ≤ (p_атм - p_нас) / (ρ × g) - Δp_вс - σ × (v_вс² / 2g)',
        latexFormula: 'h_{\\text{вс}} \\leq \\frac{p_{\\text{атм}} - p_{\\text{нас}}}{\\rho \\times g} - \\Delta p_{\\text{вс}} - \\sigma \\times \\frac{v_{\\text{вс}}^2}{2g}',
        methodology:
          'Кавитация возникает при падении давления ниже давления насыщения. Допустимая высота всасывания вычисляется из условия: h_вс ≤ (p_атм − p_нас)/(ρ·g) − Δp_вс − σ·(v_вс²/2g), где σ — число кавитации (обычно 0.1–0.3 для центробежных насосов).',
        inputs: [
          {
            key: 'atmosphericPressure',
            label: 'Атмосферное давление',
            unit: 'кПа',
            defaultValue: 101.3,
            range: { min: 70, max: 105, typical: 101.3 },
          },
          {
            key: 'saturationPressure',
            label: 'Давление насыщения жидкости',
            unit: 'кПа',
            defaultValue: 19.9,
            range: { min: 0.1, max: 100, typical: 19.9, hint: 'Вода при 60°C = 19.9 кПа' },
          },
          {
            key: 'suctionLosses',
            label: 'Потери на всасывающей линии',
            unit: 'кПа',
            defaultValue: 10,
            range: { min: 0, max: 50, typical: 10 },
          },
          {
            key: 'cavitationNumber',
            label: 'Число кавитации σ',
            unit: '—',
            defaultValue: 0.2,
            range: { min: 0.05, max: 0.5, typical: 0.2, hint: 'Для центробежных насосов 0.1–0.3' },
          },
          {
            key: 'suctionVelocity',
            label: 'Скорость на всасывании',
            unit: 'м/с',
            defaultValue: 0.3,
            range: { min: 0.1, max: 1.5, typical: 0.3 },
          },
          {
            key: 'density',
            label: 'Плотность жидкости',
            unit: 'кг/м³',
            defaultValue: 983,
            range: { min: 600, max: 1200, typical: 983 },
          },
        ],
        outputs: [
          {
            key: 'allowableHeight',
            label: 'Допустимая высота всасывания',
            unit: 'м',
            precision: 2,
            formula: (i) => {
              const pressureHead = (i.atmosphericPressure - i.saturationPressure) / (i.density * 9.81 / 1000);
              const velocityHead = i.cavitationNumber * (i.suctionVelocity ** 2) / (2 * 9.81);
              return pressureHead - (i.suctionLosses / (i.density * 9.81 / 1000)) - velocityHead;
            },
            threshold: {
              evaluate: (value) => {
                if (value < 0) return { severity: 'critical', message: 'Кавитация неизбежна! Требуется коррекция' };
                if (value < 1) return { severity: 'warning', message: 'Небольшой запас от кавитации' };
                return null;
              },
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 8973-73', title: 'Насосы центробежные' },
          { code: 'ASME B29.1', title: 'Power Transmission Belts' },
        ],
      },
    ],
    defaultMethodologyId: 'th_cavitation_gost',
  },

  {
    id: 'th-expansion-tank-volume',
    name: 'Объём расширительного бака',
    description: 'Расчёт объёма расширительного бака для компенсации теплового расширения',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_expansion_gost',
        name: 'ГОСТ 8732 — Методика расчёта',
        description: 'Расчёт объёма бака по тепловому расширению теплоносителя',
        asciiFormula: 'V_б = V_сис × β × ΔT / (1 - p_0/p_макс)',
        latexFormula: 'V_b = \\frac{V_{\\text{сис}} \\times \\beta \\times \\Delta T}{1 - p_0/p_{\\text{макс}}}',
        methodology:
          'Объём расширительного бака вычисляется по формуле: V_б = (V_сис·β·ΔT) / (1 − p_0/p_макс), где V_сис — объём системы (м³), β — коэффициент объёмного расширения (вода: 0.0002–0.0008 при ΔT), p_0 — начальное давление газа в баке (обычно 0.9 атм), p_макс — максимальное давление срабатывания предохранительного клапана. Практически V_б ≈ 0.1·V_сис для отопления.',
        inputs: [
          {
            key: 'systemVolume',
            label: 'Объём системы отопления',
            unit: 'м³',
            defaultValue: 10,
            range: { min: 0.1, max: 1000, typical: 10, hint: '≈ 10 л на 1 кВт установленной мощности' },
          },
          {
            key: 'deltaT',
            label: 'Диапазон температур',
            unit: '°С',
            defaultValue: 50,
            range: { min: 10, max: 100, typical: 50, hint: 'Разница между max и min (обычно 50–75°C)' },
          },
          {
            key: 'expansionCoeff',
            label: 'Коэффициент объёмного расширения',
            unit: '1/°С',
            defaultValue: 0.0006,
            range: { min: 0.0001, max: 0.001, typical: 0.0006, hint: 'Вода: 0.0002–0.0008' },
          },
          {
            key: 'initialPressure',
            label: 'Начальное давление в баке',
            unit: 'атм',
            defaultValue: 0.9,
            range: { min: 0.5, max: 1.5, typical: 0.9 },
          },
          {
            key: 'maxPressure',
            label: 'Максимальное давление системы',
            unit: 'атм',
            defaultValue: 3.0,
            range: { min: 1.0, max: 10.0, typical: 3.0 },
          },
        ],
        outputs: [
          {
            key: 'expansionVolume',
            label: 'Объём расширения',
            unit: 'л',
            precision: 1,
            formula: (i) => i.systemVolume * 1000 * i.expansionCoeff * i.deltaT,
          },
          {
            key: 'tankVolume',
            label: 'Рекомендуемый объём бака',
            unit: 'л',
            precision: 1,
            formula: (i) => {
              const expansion = i.systemVolume * 1000 * i.expansionCoeff * i.deltaT;
              return expansion / (1 - i.initialPressure / i.maxPressure);
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 8732-78', title: 'Трубы стальные бесшовные' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_expansion_gost',
  },

  {
    id: 'th-heat-exchanger-duty',
    name: 'Тепловая нагрузка теплообменника',
    description: 'Расчёт требуемой тепловой мощности теплообменника',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_hex_duty_gost',
        name: 'ГОСТ — Метод энтальпии',
        description: 'Расчёт по уравнению теплового баланса',
        asciiFormula: 'Q = G × c × ΔT = G₁ × c₁ × (t₁ - t₁\')',
        latexFormula: 'Q = G \\times c \\times \\Delta T = G_1 \\times c_1 \\times (t_1 - t_1\')',
        methodology:
          'Тепловая нагрузка рассчитывается по уравнению: Q = G·c·ΔT, где G — расход теплоносителя (кг/с), c — теплоёмкость (кДж/(кг·К)), ΔT — разность температур. Для воды c ≈ 4.18 кДж/(кг·К). В теплообменнике: Q_отд = G₁·c₁·(t₁ − t₁′) = G₂·c₂·(t₂′ − t₂).',
        inputs: [
          {
            key: 'flowRate',
            label: 'Расход теплоносителя',
            unit: 'кг/с',
            defaultValue: 1.0,
            range: { min: 0.01, max: 100, typical: 1.0 },
          },
          {
            key: 'tempInlet',
            label: 'Температура на входе',
            unit: '°С',
            defaultValue: 80,
            range: { min: 20, max: 120, typical: 80 },
          },
          {
            key: 'tempOutlet',
            label: 'Температура на выходе',
            unit: '°С',
            defaultValue: 60,
            range: { min: 10, max: 100, typical: 60 },
          },
          {
            key: 'specificHeat',
            label: 'Удельная теплоёмкость',
            unit: 'кДж/(кг·К)',
            defaultValue: 4.18,
            range: { min: 1.0, max: 5.0, typical: 4.18, hint: 'Вода ~ 4.18' },
          },
        ],
        outputs: [
          {
            key: 'heatDuty',
            label: 'Тепловая нагрузка',
            unit: 'кВт',
            precision: 2,
            formula: (i) => (i.flowRate * i.specificHeat * (i.tempInlet - i.tempOutlet)) / 1000,
          },
          {
            key: 'heatDutyKcalH',
            label: 'Тепловая нагрузка',
            unit: 'ккал/ч',
            precision: 0,
            formula: (i) => i.flowRate * i.specificHeat * (i.tempInlet - i.tempOutlet) * 860,
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_hex_duty_gost',
  },

  {
    id: 'th-pipe-slope',
    name: 'Уклон трубопровода для воздухоотвода',
    description: 'Определение минимального уклона при прокладке трубопроводов',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_slope_gost',
        name: 'ГОСТ — Нормативный уклон',
        description: 'Минимальный уклон для отвода воздуха из трубопроводов',
        asciiFormula: 'i = Δz / L ≥ i_мин',
        latexFormula: 'i = \\frac{\\Delta z}{L} \\geq i_{\\text{мин}}',
        methodology:
          'Минимальный уклон трубопровода для воздухоотвода должен быть не менее 0.5 % (5 мм на 1 м) для подающих линий и 0.3 % (3 мм на 1 м) для обратных. На участках с возможностью скопления воздуха уклон увеличивается до 1–2 %. Высокие точки необходимо оснащать воздухоотводчиками.',
        inputs: [
          {
            key: 'minSlope',
            label: 'Минимальный уклон',
            unit: '%',
            defaultValue: 0.5,
            range: { min: 0.1, max: 5.0, typical: 0.5, hint: 'Подача: 0.5%, Обратка: 0.3%' },
          },
          {
            key: 'length',
            label: 'Длина трубопровода',
            unit: 'м',
            defaultValue: 100,
            range: { min: 1, max: 10000, typical: 100 },
          },
        ],
        outputs: [
          {
            key: 'heightDifference',
            label: 'Перепад высоты',
            unit: 'мм',
            precision: 0,
            formula: (i) => (i.minSlope / 100) * i.length * 1000,
          },
          {
            key: 'slopeAngle',
            label: 'Угол наклона',
            unit: '°',
            precision: 2,
            formula: (i) => Math.atan((i.minSlope / 100) * i.length / i.length) * (180 / Math.PI),
          },
        ],
        normativeRefs: [
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
          { code: 'ГОСТ 3262-75', title: 'Трубы стальные электросварные' },
        ],
      },
    ],
    defaultMethodologyId: 'th_slope_gost',
  },

  // ========== ПРОЧНОСТЬ КОНСТРУКЦИЙ (11-17) ==========

  {
    id: 'th-pipe-wall-thickness',
    name: 'Толщина стенки трубопровода под давлением',
    description: 'Расчёт минимальной толщины стенки трубопровода',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_thickness_asme',
        name: 'ASME B31.1 — Power Piping',
        description: 'Американский стандарт для энергетических трубопроводов',
        asciiFormula: 't = (p × d) / (2 × S × η - p)',
        latexFormula: 't = \\frac{p \\times d}{2 \\times S \\times \\eta - p}',
        methodology:
          'По ASME B31.1: t = (p·d) / (2·S·η − p), где p — рабочее давление (МПа), d — наружный диаметр (мм), S — допускаемое напряжение (МПа), η — коэффициент качества сварного шва (0.85–1.0). Допускаемое напряжение зависит от материала и температуры. Итоговая толщина = расчётная + допуск на коррозию (0.5–1.0 мм) + допуск на износ.',
        inputs: [
          {
            key: 'pressure',
            label: 'Рабочее давление',
            unit: 'МПа',
            defaultValue: 0.6,
            range: { min: 0.1, max: 20.0, typical: 0.6, hint: '0.1–0.15 МПа (отопление), до 10+ МПа (пар)' },
          },
          {
            key: 'diameter',
            label: 'Наружный диаметр трубы',
            unit: 'мм',
            defaultValue: 40,
            range: { min: 8, max: 1000, typical: 40 },
          },
          {
            key: 'allowableStress',
            label: 'Допускаемое напряжение',
            unit: 'МПа',
            defaultValue: 120,
            range: { min: 50, max: 300, typical: 120, hint: 'Ст.3: 120 МПа, 15ХМ: 140–160 МПа' },
          },
          {
            key: 'weldFactor',
            label: 'Коэффициент сварного шва η',
            unit: '—',
            defaultValue: 0.9,
            range: { min: 0.8, max: 1.0, typical: 0.9, hint: '0.85 (встык), 0.9–1.0 (радиограф)' },
          },
          {
            key: 'corrosionAllowance',
            label: 'Допуск на коррозию',
            unit: 'мм',
            defaultValue: 1.0,
            range: { min: 0.0, max: 3.0, typical: 1.0 },
          },
        ],
        outputs: [
          {
            key: 'thicknessCalculated',
            label: 'Расчётная толщина',
            unit: 'мм',
            precision: 2,
            formula: (i) =>
              (i.pressure * i.diameter) /
              (2 * i.allowableStress * i.weldFactor - i.pressure),
          },
          {
            key: 'thicknessRequired',
            label: 'Требуемая толщина (с допусками)',
            unit: 'мм',
            precision: 2,
            formula: (i) => {
              const calc = (i.pressure * i.diameter) /
                (2 * i.allowableStress * i.weldFactor - i.pressure);
              return calc + i.corrosionAllowance;
            },
          },
        ],
        normativeRefs: [
          { code: 'ASME B31.1', title: 'Power Piping Code' },
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
        ],
      },
      {
        id: 'th_thickness_gost',
        name: 'ГОСТ 32569 — Российский стандарт',
        description: 'Расчёт по российским нормам для теплотрассы',
        asciiFormula: 't = (p × d) / (2 × [σ] + p)',
        latexFormula: 't = \\frac{p \\times d}{2 \\times [\\sigma] + p}',
        methodology:
          'По ГОСТ 32569: t = (p·d) / (2·[σ] + p), где [σ] — допускаемое напряжение с учётом коэффициента безопасности. Для стали Ст.3 при t ≤ 100°С: [σ] ≈ 140 МПа. Расчёт включает теплоизоляцию и защиту от внешних воздействий.',
        inputs: [
          {
            key: 'pressure',
            label: 'Рабочое давление',
            unit: 'МПа',
            defaultValue: 0.6,
            range: { min: 0.1, max: 10.0, typical: 0.6 },
          },
          {
            key: 'diameter',
            label: 'Наружный диаметр',
            unit: 'мм',
            defaultValue: 40,
            range: { min: 8, max: 1000, typical: 40 },
          },
          {
            key: 'allowableStress',
            label: 'Допускаемое напряжение [σ]',
            unit: 'МПа',
            defaultValue: 140,
            range: { min: 80, max: 200, typical: 140 },
          },
        ],
        outputs: [
          {
            key: 'thickness',
            label: 'Толщина стенки',
            unit: 'мм',
            precision: 2,
            formula: (i) => (i.pressure * i.diameter) / (2 * i.allowableStress + i.pressure),
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_thickness_gost',
  },

  {
    id: 'th-thermal-expansion',
    name: 'Тепловое расширение трубопровода',
    description: 'Расчёт линейного расширения металлических и пластиковых трубопроводов',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_expansion_linear',
        name: 'Линейное расширение',
        description: 'Расчёт по коэффициенту линейного расширения материала',
        asciiFormula: 'ΔL = L₀ × α × ΔT',
        latexFormula: '\\Delta L = L_0 \\times \\alpha \\times \\Delta T',
        methodology:
          'Линейное расширение вычисляется по формуле: ΔL = L₀·α·ΔT, где L₀ — первоначальная длина (м), α — коэффициент линейного расширения (1/°С), ΔT — изменение температуры (°С). Для стали α ≈ 12×10⁻⁶ 1/°С (расширение 9 см на 100 м при ΔT=75°C). Для пластика (ПНД, ППР): α ≈ 150–200×10⁻⁶ 1/°С (требуется компенсатор!)',
        inputs: [
          {
            key: 'length',
            label: 'Длина трубопровода',
            unit: 'м',
            defaultValue: 100,
            range: { min: 1, max: 10000, typical: 100 },
          },
          {
            key: 'expansionCoeff',
            label: 'Коэффициент линейного расширения',
            unit: '10⁻⁶/°С',
            defaultValue: 12,
            range: { min: 2, max: 200, typical: 12, hint: 'Сталь 12, ПНД 150–200, Медь 17' },
          },
          {
            key: 'deltaT',
            label: 'Изменение температуры',
            unit: '°С',
            defaultValue: 75,
            range: { min: 10, max: 150, typical: 75, hint: '20→95°C для систем отопления' },
          },
        ],
        outputs: [
          {
            key: 'expansion',
            label: 'Линейное расширение',
            unit: 'мм',
            precision: 1,
            formula: (i) => i.length * (i.expansionCoeff / 1000000) * i.deltaT * 1000,
          },
          {
            key: 'expansionPerMeter',
            label: 'Удельное расширение',
            unit: 'мм/м',
            precision: 2,
            formula: (i) => (i.expansionCoeff / 1000000) * i.deltaT * 1000,
            threshold: {
              evaluate: (value) => {
                if (value > 1.5) {
                  return {
                    severity: 'warning',
                    message: `Значительное расширение ${value.toFixed(2)} мм/м — необходимы компенсаторы!`,
                  };
                }
                return null;
              },
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 11573-98', title: 'Линии трубопроводов и их элементы' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_expansion_linear',
  },

  {
    id: 'th-beam-deflection',
    name: 'Прогиб консольной балки с нагрузкой',
    description: 'Расчёт максимального прогиба балки перекрытия под нагрузкой трубопровода',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_deflection_standard',
        name: 'Стандартная формула',
        description: 'Расчёт прогиба консольной балки',
        asciiFormula: 'f = (q × L⁴) / (8 × E × I)',
        latexFormula: 'f = \\frac{q \\times L^4}{8 \\times E \\times I}',
        methodology:
          'Прогиб консольной балки под равномерной нагрузкой: f = (q·L⁴)/(8·E·I), где q — распределённая нагрузка (Н/м), L — пролёт (м), E — модуль упругости (МПа), I — момент инерции сечения (м⁴). Допускаемый прогиб обычно не превышает L/250 (для жилых зданий) или L/200 (для производственных). Нагрузка включает вес трубопровода, теплоносителя, изоляции, снега.',
        inputs: [
          {
            key: 'uniformLoad',
            label: 'Распределённая нагрузка',
            unit: 'кН/м',
            defaultValue: 0.5,
            range: { min: 0.01, max: 10, typical: 0.5, hint: '≈ 0.5 кН/м для Ø40 с изоляцией и водой' },
          },
          {
            key: 'span',
            label: 'Пролёт (расстояние между опорами)',
            unit: 'м',
            defaultValue: 3,
            range: { min: 0.5, max: 20, typical: 3 },
          },
          {
            key: 'youngModulus',
            label: 'Модуль упругости (E)',
            unit: 'ГПа',
            defaultValue: 210,
            range: { min: 40, max: 210, typical: 210, hint: 'Сталь 210, Алюминий 70, Дерево 10–12' },
          },
          {
            key: 'momentInertia',
            label: 'Момент инерции сечения',
            unit: 'см⁴',
            defaultValue: 500,
            range: { min: 1, max: 100000, typical: 500, hint: 'Для балки I20: ~200 см⁴' },
          },
        ],
        outputs: [
          {
            key: 'deflection',
            label: 'Максимальный прогиб',
            unit: 'мм',
            precision: 2,
            formula: (i) =>
              (i.uniformLoad * 1000 * i.span ** 4) /
              (8 * i.youngModulus * 1000 * i.momentInertia * 10000) * 1000,
          },
          {
            key: 'allowableDeflection',
            label: 'Допускаемый прогиб (L/250)',
            unit: 'мм',
            precision: 2,
            formula: (i) => i.span * 1000 / 250,
          },
        ],
        normativeRefs: [
          { code: 'СП 16.13330', title: 'Стальные конструкции' },
          { code: 'СНиП II-25-80', title: 'Деревянные конструкции' },
        ],
      },
    ],
    defaultMethodologyId: 'th_deflection_standard',
  },

  {
    id: 'th-column-buckling',
    name: 'Устойчивость колонны (критическое напряжение)',
    description: 'Проверка устойчивости опорной колонны против потери устойчивости',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_buckling_euler',
        name: 'Формула Эйлера',
        description: 'Расчёт критического напряжения для длинных колонн',
        asciiFormula: 'σ_кр = (π² × E) / (λ²)',
        latexFormula: '\\sigma_{\\text{кр}} = \\frac{\\pi^2 \\times E}{\\lambda^2}',
        methodology:
          'Критическое напряжение потери устойчивости вычисляется по формуле Эйлера: σ_кр = (π²·E)/λ², где λ = L₀/i — гибкость колонны, L₀ — длина колонны, i — радиус инерции сечения, E — модуль упругости. Предпосылка: σ_кр < σ_текучести. Для коротких стержней применяют другие формулы (Янсен, Ранкин).',
        inputs: [
          {
            key: 'length',
            label: 'Длина колонны',
            unit: 'м',
            defaultValue: 4,
            range: { min: 0.5, max: 20, typical: 4 },
          },
          {
            key: 'radiusInertia',
            label: 'Радиус инерции сечения',
            unit: 'см',
            defaultValue: 2.0,
            range: { min: 0.5, max: 30, typical: 2.0, hint: 'Для трубы Ø40 t=2.5: i ≈ 1.3 см' },
          },
          {
            key: 'youngModulus',
            label: 'Модуль упругости E',
            unit: 'ГПа',
            defaultValue: 210,
            range: { min: 50, max: 210, typical: 210 },
          },
        ],
        outputs: [
          {
            key: 'slenderness',
            label: 'Гибкость λ',
            unit: '—',
            precision: 1,
            formula: (i) => (i.length * 100) / i.radiusInertia,
          },
          {
            key: 'criticalStress',
            label: 'Критическое напряжение',
            unit: 'МПа',
            precision: 1,
            formula: (i) => {
              const lambda = (i.length * 100) / i.radiusInertia;
              return (Math.PI ** 2 * i.youngModulus * 1000) / (lambda ** 2);
            },
            threshold: {
              evaluate: (value) => {
                if (value < 200) {
                  return {
                    severity: 'warning',
                    message: `Низкое критическое напряжение ${value.toFixed(0)} МПа — высокий риск потери устойчивости`,
                  };
                }
                return null;
              },
            },
          },
        ],
        normativeRefs: [
          { code: 'СП 16.13330', title: 'Стальные конструкции' },
          { code: 'ГОСТ 27772-88', title: 'Стальные трубы бесшовные' },
        ],
      },
    ],
    defaultMethodologyId: 'th_buckling_euler',
  },

  {
    id: 'th-vibration-frequency',
    name: 'Собственная частота колебаний трубопровода',
    description: 'Определение собственной частоты для проверки резонанса',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_vibration_cantilever',
        name: 'Консольная балка',
        description: 'Расчёт для консольного трубопровода',
        asciiFormula: 'f = (1/(2π)) × sqrt(k/m)',
        latexFormula: 'f = \\frac{1}{2\\pi} \\times \\sqrt{\\frac{k}{m}}',
        methodology:
          'Собственная частота свободных колебаний: f = (1/2π)·√(k/m), где k — жёсткость опоры, m — масса. Для консольной балки: f ≈ (3.52/(2π))·√(E·I/(m·L⁴)). Опасная частота возбуждения ~ 5–15 Гц (вибрация насоса, пульсация потока). Если f_собств близка к f_возбуждения, возможен резонанс.',
        inputs: [
          {
            key: 'stiffness',
            label: 'Жёсткость опоры',
            unit: 'кН/м',
            defaultValue: 100,
            range: { min: 10, max: 10000, typical: 100 },
          },
          {
            key: 'mass',
            label: 'Масса трубопровода с жидкостью',
            unit: 'кг',
            defaultValue: 50,
            range: { min: 5, max: 5000, typical: 50 },
          },
        ],
        outputs: [
          {
            key: 'frequency',
            label: 'Собственная частота',
            unit: 'Гц',
            precision: 2,
            formula: (i) => (1 / (2 * Math.PI)) * Math.sqrt((i.stiffness * 1000) / i.mass),
            threshold: {
              evaluate: (value) => {
                if (value >= 5 && value <= 15) {
                  return {
                    severity: 'warning',
                    message: `Частота ${value.toFixed(1)} Гц в диапазоне типичного возбуждения — возможен резонанс`,
                  };
                }
                return null;
              },
            },
          },
          {
            key: 'period',
            label: 'Период колебаний',
            unit: 'с',
            precision: 3,
            formula: (i) => 1 / ((1 / (2 * Math.PI)) * Math.sqrt((i.stiffness * 1000) / i.mass)),
          },
        ],
        normativeRefs: [
          { code: 'СП 16.13330', title: 'Стальные конструкции' },
          { code: 'ISO 10816', title: 'Mechanical vibration' },
        ],
      },
    ],
    defaultMethodologyId: 'th_vibration_cantilever',
  },

  // ========== СВОЙСТВА ТЕПЛОНОСИТЕЛЯ (18-23) ==========

  {
    id: 'th-water-density',
    name: 'Плотность воды по температуре',
    description: 'Определение плотности воды/теплоносителя в зависимости от температуры',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_density_table',
        name: 'Табличные значения',
        description: 'Плотность чистой воды (приблизительно)',
        asciiFormula: 'ρ ≈ ρ₀ × (1 - β × (T - 4°C))',
        latexFormula: '\\rho \\approx \\rho_0 \\times (1 - \\beta \\times (T - 4°C))',
        methodology:
          'Плотность воды достигает максимума при 4°C (1000 кг/м³) и уменьшается при отклонении от этой температуры. Для отопительных систем: при 20°C ρ ≈ 998 кг/м³, при 60°C ≈ 983 кг/м³, при 100°C ≈ 958 кг/м³. Для точных расчётов используются таблицы парра 1962 (официальный справочник).',
        inputs: [
          {
            key: 'temperature',
            label: 'Температура',
            unit: '°С',
            defaultValue: 60,
            range: { min: 0, max: 150, typical: 60 },
          },
        ],
        outputs: [
          {
            key: 'density',
            label: 'Плотность воды',
            unit: 'кг/м³',
            precision: 1,
            formula: (i) => {
              const t = i.temperature;
              if (t <= 4) return 1000 - (4 - t) * (4 - t) * 0.015;
              if (t <= 40) return 1000 - (t - 4) * 0.15;
              if (t <= 60) return 983.2 - (t - 60) * 0.25;
              if (t <= 100) return 958.4 - (t - 100) * 0.3;
              return 958 - (t - 100) * 0.6;
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 6687-86', title: 'Вода питьевая. Методы анализа' },
          { code: 'ASME Steam Tables', title: 'International Steam Tables' },
        ],
      },
    ],
    defaultMethodologyId: 'th_density_table',
  },

  {
    id: 'th-water-viscosity',
    name: 'Динамическая вязкость воды',
    description: 'Определение вязкости воды по температуре для расчётов потерь',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_viscosity_approximation',
        name: 'Аппроксимация Андраде',
        description: 'Приблизительное определение вязкости',
        asciiFormula: 'lg(η) = A - B/(C + T)',
        latexFormula: '\\lg(\\eta) = A - \\frac{B}{C + T}',
        methodology:
          'Динамическая вязкость воды сильно зависит от температуры. При 0°C η ≈ 1.787 мПа·с, при 20°C ≈ 1.002 мПа·с, при 60°C ≈ 0.467 мПа·с, при 100°C ≈ 0.282 мПа·с. Используется аппроксимация Андраде или обращение к справочникам.',
        inputs: [
          {
            key: 'temperature',
            label: 'Температура',
            unit: '°С',
            defaultValue: 60,
            range: { min: 0, max: 100, typical: 60 },
          },
        ],
        outputs: [
          {
            key: 'dynamicViscosity',
            label: 'Динамическая вязкость',
            unit: 'мПа·с',
            precision: 3,
            formula: (i) => {
              const t = i.temperature;
              if (t <= 0) return 1.787;
              if (t <= 20) return 1.002 - (t - 20) * 0.03;
              if (t <= 40) return 0.656 - (t - 40) * 0.0047;
              if (t <= 60) return 0.467 - (t - 60) * 0.0035;
              if (t <= 80) return 0.355 - (t - 80) * 0.0025;
              if (t <= 100) return 0.282 - (t - 100) * 0.0015;
              return 0.282;
            },
          },
          {
            key: 'kinematicViscosity',
            label: 'Кинематическая вязкость',
            unit: 'мм²/с',
            precision: 3,
            formula: (i) => {
              const t = i.temperature;
              let eta = 0;
              if (t <= 0) eta = 1.787;
              else if (t <= 20) eta = 1.002 - (t - 20) * 0.03;
              else if (t <= 40) eta = 0.656 - (t - 40) * 0.0047;
              else if (t <= 60) eta = 0.467 - (t - 60) * 0.0035;
              else if (t <= 80) eta = 0.355 - (t - 80) * 0.0025;
              else if (t <= 100) eta = 0.282 - (t - 100) * 0.0015;
              else eta = 0.282;

              let rho = 1000;
              if (t > 4) rho = 1000 - (t - 4) * 0.15;

              return eta / (rho / 1000);
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 33-2000', title: 'Вода. Плотность, вязкость' },
          { code: 'ISO 1104', title: 'Water: Viscosity measurement' },
        ],
      },
    ],
    defaultMethodologyId: 'th_viscosity_approximation',
  },

  {
    id: 'th-specific-heat',
    name: 'Удельная теплоёмкость теплоносителя',
    description: 'Определение теплоёмкости воды и составов теплоносителя',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_heatcap_table',
        name: 'Табличные значения',
        description: 'Удельная теплоёмкость из справочников',
        asciiFormula: 'c(T) ≈ c₀ × (1 - k × (T - T₀))',
        latexFormula: 'c(T) \\approx c_0 \\times (1 - k \\times (T - T_0))',
        methodology:
          'Удельная теплоёмкость воды слабо зависит от температуры: при 0°C c ≈ 4.215 кДж/(кг·К), при 20°C c ≈ 4.182 кДж/(кг·К), при 60°C c ≈ 4.181 кДж/(кг·К), при 100°C c ≈ 4.216 кДж/(кг·К). Для составов теплоносителя (например этиленгликоль 30 %) теплоёмкость ниже ~ 3.5 кДж/(кг·К).',
        inputs: [
          {
            key: 'temperature',
            label: 'Температура',
            unit: '°С',
            defaultValue: 60,
            range: { min: 0, max: 150, typical: 60 },
          },
          {
            key: 'fluidType',
            label: 'Тип жидкости (0=вода, 1=30% этиленгликоль)',
            unit: '—',
            defaultValue: 0,
            range: { min: 0, max: 1, typical: 0 },
          },
        ],
        outputs: [
          {
            key: 'specificHeat',
            label: 'Удельная теплоёмкость',
            unit: 'кДж/(кг·К)',
            precision: 3,
            formula: (i) => {
              if (i.fluidType === 0) {
                return 4.182 + (i.temperature - 20) * 0.0005;
              } else {
                return 3.5 + (i.temperature - 20) * 0.0003;
              }
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 29248-91', title: 'Жидкости теплоносители' },
          { code: 'ISO 3696', title: 'Water for laboratory use' },
        ],
      },
    ],
    defaultMethodologyId: 'th_heatcap_table',
  },

  {
    id: 'th-thermal-conductivity',
    name: 'Теплопроводность теплоносителя',
    description: 'Определение коэффициента теплопроводности для расчётов теплообменников',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_thermal_cond',
        name: 'Справочные значения',
        description: 'Теплопроводность воды по температуре',
        asciiFormula: 'λ(T) ≈ λ₀ + k × (T - T₀)',
        latexFormula: '\\lambda(T) \\approx \\lambda_0 + k \\times (T - T_0)',
        methodology:
          'Теплопроводность воды возрастает с температурой: при 0°C λ ≈ 0.561 Вт/(м·К), при 20°C λ ≈ 0.598 Вт/(м·К), при 60°C λ ≈ 0.654 Вт/(м·К), при 100°C λ ≈ 0.680 Вт/(м·К). Для составов теплоносителя (например, антифриз) теплопроводность ниже (λ ≈ 0.42–0.45 Вт/(м·К)).',
        inputs: [
          {
            key: 'temperature',
            label: 'Температура',
            unit: '°С',
            defaultValue: 60,
            range: { min: 0, max: 100, typical: 60 },
          },
        ],
        outputs: [
          {
            key: 'thermalConductivity',
            label: 'Теплопроводность',
            unit: 'Вт/(м·К)',
            precision: 4,
            formula: (i) => 0.598 + (i.temperature - 20) * 0.002,
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 29248-91', title: 'Жидкости теплоносители' },
          { code: 'ISO 6721', title: 'Determination of dynamic properties of polymers' },
        ],
      },
    ],
    defaultMethodologyId: 'th_thermal_cond',
  },

  // ========== СИСТЕМНЫЕ РАСЧЕТЫ (24-28) ==========

  {
    id: 'th-radiator-power',
    name: 'Тепловая мощность радиатора отопления',
    description: 'Расчёт тепловой мощности радиатора при заданных условиях',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_radiator_power_gost',
        name: 'ГОСТ — Стандартные условия',
        description: 'Расчёт по ГОСТ при Δt_среднегеометрическ = 50 К',
        asciiFormula: 'Q = Q_номинальная × (Δt / 50)^n',
        latexFormula: 'Q = Q_{\\text{номин}} \\times (\\Delta t / 50)^n',
        methodology:
          'Номинальная мощность радиатора указывается при стандартных условиях (средний расход воды, вход 90°C, выход 70°C, воздух 20°C, Δt = 50 К). Реальная мощность рассчитывается по формуле: Q = Q_номин·(Δt_среднегеом / 50)ⁿ, где n ≈ 1.3–1.35 для радиаторов, Δt_среднегеом = (t_вход − t_воздуха − (t_выход − t_воздуха))/(ln((t_вход − t_воздуха)/(t_выход − t_воздуха))).',
        inputs: [
          {
            key: 'nominalPower',
            label: 'Номинальная мощность (при Δt = 50 К)',
            unit: 'Вт',
            defaultValue: 1500,
            range: { min: 100, max: 10000, typical: 1500 },
          },
          {
            key: 'tempInlet',
            label: 'Температура подачи',
            unit: '°С',
            defaultValue: 75,
            range: { min: 30, max: 95, typical: 75 },
          },
          {
            key: 'tempOutlet',
            label: 'Температура обратки',
            unit: '°С',
            defaultValue: 65,
            range: { min: 20, max: 80, typical: 65 },
          },
          {
            key: 'tempRoom',
            label: 'Температура в помещении',
            unit: '°С',
            defaultValue: 20,
            range: { min: 15, max: 25, typical: 20 },
          },
          {
            key: 'exponent',
            label: 'Показатель степени n',
            unit: '—',
            defaultValue: 1.33,
            range: { min: 1.0, max: 1.5, typical: 1.33 },
          },
        ],
        outputs: [
          {
            key: 'logMeanTemp',
            label: 'Средняя логарифмическая разность температур',
            unit: 'К',
            precision: 2,
            formula: (i) => {
              const dt1 = i.tempInlet - i.tempRoom;
              const dt2 = i.tempOutlet - i.tempRoom;
              return (dt1 - dt2) / Math.log(dt1 / dt2);
            },
          },
          {
            key: 'actualPower',
            label: 'Фактическая мощность',
            unit: 'Вт',
            precision: 0,
            formula: (i) => {
              const dt1 = i.tempInlet - i.tempRoom;
              const dt2 = i.tempOutlet - i.tempRoom;
              const deltaT = (dt1 - dt2) / Math.log(dt1 / dt2);
              return i.nominalPower * Math.pow(deltaT / 50, i.exponent);
            },
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_radiator_power_gost',
  },

  {
    id: 'th-mixing-valve-setting',
    name: 'Настройка смесительного клапана',
    description: 'Определение коэффициента смешивания для смесительного клапана',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_mixing_proportion',
        name: 'Балансировка температур',
        description: 'Расчёт доли горячей и холодной воды',
        asciiFormula: 'α = (t_выход - t_холодн) / (t_горячий - t_холодн)',
        latexFormula: '\\alpha = \\frac{t_{\\text{выход}} - t_{\\text{холодн}}}{t_{\\text{горячий}} - t_{\\text{холодн}}}',
        methodology:
          'Доля горячей воды вычисляется как: α = (t_выход − t_холодн) / (t_горячий − t_холодн). Доля холодной: (1 − α). По этим долям настраивается смесительный клапан (трёхходовый пропорциональный или двухрегулирующий). Правильная настройка предотвращает перегрев, ожоги, повышает энергоэффективность.',
        inputs: [
          {
            key: 'tempHot',
            label: 'Температура горячей воды (подача)',
            unit: '°С',
            defaultValue: 85,
            range: { min: 40, max: 95, typical: 85 },
          },
          {
            key: 'tempCold',
            label: 'Температура холодной воды',
            unit: '°С',
            defaultValue: 10,
            range: { min: 5, max: 20, typical: 10 },
          },
          {
            key: 'tempDesired',
            label: 'Желаемая температура на выходе',
            unit: '°С',
            defaultValue: 45,
            range: { min: 30, max: 60, typical: 45, hint: 'Для душа макс 45°C по нормам безопасности' },
          },
        ],
        outputs: [
          {
            key: 'hotWaterFraction',
            label: 'Доля горячей воды',
            unit: '%',
            precision: 1,
            formula: (i) =>
              ((i.tempDesired - i.tempCold) / (i.tempHot - i.tempCold)) * 100,
            threshold: {
              evaluate: (value) => {
                if (value > 95) {
                  return {
                    severity: 'warning',
                    message: `Очень высокая доля горячей воды (${value.toFixed(0)}%) — рискованно`,
                  };
                }
                return null;
              },
            },
          },
          {
            key: 'coldWaterFraction',
            label: 'Доля холодной воды',
            unit: '%',
            precision: 1,
            formula: (i) =>
              100 - ((i.tempDesired - i.tempCold) / (i.tempHot - i.tempCold)) * 100,
          },
        ],
        normativeRefs: [
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
        ],
      },
    ],
    defaultMethodologyId: 'th_mixing_proportion',
  },

  {
    id: 'th-insulation-thickness',
    name: 'Толщина теплоизоляции трубопровода',
    description: 'Выбор толщины изоляции для снижения потерь тепла',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_insulation_ekonom',
        name: 'Экономическая оптимизация',
        description: 'Выбор толщины по критерию минимума приведённых затрат',
        asciiFormula: 'δ_опт = (λ / h) × (T_стенки - T_оклуж)/(U_ц)',
        latexFormula: '\\delta_{\\text{опт}} = \\frac{\\lambda}{h} \\times \\frac{T_{\\text{стенки}} - T_{\\text{окруж}}}{U_{\\text{ц}}}',
        methodology:
          'Оптимальная толщина изоляции выбирается из условия минимума суммы: (затраты на изоляцию) + (стоимость теплопотерь). Нормативный минимум: δ_мин ≥ 30 мм (Вт/(м·К)^0.5). Для внешних трубопроводов (вход 80°C, окружение 20°C) часто применяется 50–100 мм минеральной ваты (λ ≈ 0.04 Вт/(м·К)).',
        inputs: [
          {
            key: 'pipeOd',
            label: 'Наружный диаметр трубы',
            unit: 'мм',
            defaultValue: 40,
            range: { min: 8, max: 500, typical: 40 },
          },
          {
            key: 'tempPipe',
            label: 'Температура стенки трубы',
            unit: '°С',
            defaultValue: 75,
            range: { min: 20, max: 120, typical: 75 },
          },
          {
            key: 'tempAmbient',
            label: 'Температура окружающей среды',
            unit: '°С',
            defaultValue: 20,
            range: { min: -40, max: 50, typical: 20 },
          },
          {
            key: 'thermalCond',
            label: 'Теплопроводность изоляции',
            unit: 'Вт/(м·К)',
            defaultValue: 0.04,
            range: { min: 0.02, max: 0.1, typical: 0.04, hint: 'Минвата 0.04, пенопласт 0.03, пеностекло 0.06' },
          },
        ],
        outputs: [
          {
            key: 'tempDifference',
            label: 'Разность температур',
            unit: 'К',
            precision: 0,
            formula: (i) => i.tempPipe - i.tempAmbient,
          },
          {
            key: 'recommendedThickness',
            label: 'Рекомендуемая толщина',
            unit: 'мм',
            precision: 0,
            formula: (i) => {
              const minReq = 30 * Math.sqrt(i.thermalCond);
              const optimal = Math.max(minReq, (i.pipeOd / 100) * (i.tempDifference) / 10);
              const standardSizes = [20, 30, 40, 50, 60, 75, 100, 125, 150];
              return standardSizes.find((s) => s >= optimal) || 150;
            },
          },
        ],
        normativeRefs: [
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
          { code: 'ГОСТ 9635-89', title: 'Изделия из минеральной ваты' },
        ],
      },
    ],
    defaultMethodologyId: 'th_insulation_ekonom',
  },

  {
    id: 'th-water-hammer-pressure',
    name: 'Давление гидроудара (water hammer)',
    description: 'Расчёт импульсного давления при закрытии клапана',
    category: 'thermotechnical',
    methodologies: [
      {
        id: 'th_waterhammer_joukowski',
        name: 'Формула Жуковского',
        description: 'Расчёт максимального импульса при внезапном закрытии',
        asciiFormula: 'Δp = ρ × a × Δv',
        latexFormula: '\\Delta p = \\rho \\times a \\times \\Delta v',
        methodology:
          'Давление гидроудара вычисляется по формуле Жуковского: Δp = ρ·a·Δv, где ρ — плотность (кг/м³), a — скорость звука в жидкости (≈1400–1500 м/с для воды), Δv — изменение скорости потока (м/с). Практически Δp ≈ 0.5–2 МПа (в зависимости от быстроты закрытия). Защита: воздушные подушки, компенсаторы, предохранительные клапаны.',
        inputs: [
          {
            key: 'velocity',
            label: 'Скорость потока перед закрытием',
            unit: 'м/с',
            defaultValue: 1.0,
            range: { min: 0.1, max: 5.0, typical: 1.0 },
          },
          {
            key: 'soundSpeed',
            label: 'Скорость звука в жидкости',
            unit: 'м/с',
            defaultValue: 1450,
            range: { min: 1000, max: 1500, typical: 1450, hint: 'Вода: 1450 м/с' },
          },
          {
            key: 'density',
            label: 'Плотность жидкости',
            unit: 'кг/м³',
            defaultValue: 983,
            range: { min: 800, max: 1000, typical: 983 },
          },
          {
            key: 'closureTime',
            label: 'Время закрытия клапана',
            unit: 'с',
            defaultValue: 0.1,
            range: { min: 0.01, max: 5.0, typical: 0.1, hint: 'Быстрое: 0.01 s, медленное: 1+ s' },
          },
        ],
        outputs: [
          {
            key: 'waterHammerPressure',
            label: 'Максимальное давление гидроудара',
            unit: 'кПа',
            precision: 0,
            formula: (i) => (i.density * i.soundSpeed * i.velocity) / 1000,
            threshold: {
              evaluate: (value) => {
                if (value > 500) {
                  return {
                    severity: 'critical',
                    message: `Опасный гидроудар ${(value / 1000).toFixed(1)} МПа — необходима защита!`,
                  };
                }
                if (value > 200) {
                  return {
                    severity: 'warning',
                    message: `Значительный гидроудар ${(value / 1000).toFixed(1)} МПа — рекомендуется компенсатор`,
                  };
                }
                return null;
              },
            },
          },
          {
            key: 'protectionRequired',
            label: 'Требуется защита?',
            unit: '—',
            precision: 0,
            formula: (i) => (i.density * i.soundSpeed * i.velocity) / 1000 > 100 ? 1 : 0,
            description: '1 = Да, 0 = Нет',
          },
        ],
        normativeRefs: [
          { code: 'ГОСТ 32569-2013', title: 'Трубопроводы теплоэнергетические' },
          { code: 'СП 60.13330.2016', title: 'СНиП: Отопление, вентиляция' },
        ],
      },
    ],
    defaultMethodologyId: 'th_waterhammer_joukowski',
  },
];
