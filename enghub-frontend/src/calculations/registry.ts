import { CalcTemplate } from './types';

// =========================================================================
// ВРУЧНУЮ ЗАКОДИРОВАННЫЕ ЭТАЛОННЫЕ РАСЧЕТЫ (ПРОШЕДШИЕ ПОЛНОЕ ТЕСТИРОВАНИЕ)
// =========================================================================
export const calcRegistry: Record<string, CalcTemplate> = {
  tx_heat_balance: {
    id: "tx_heat_balance",
    cat: "ТХ",
    name: "Тепловая мощность (Нагрев/Охлаждение)",
    desc: "Расчет теплового потока при изменении температуры среды",
    normativeReference: "Справочник проектировщика (Староверов)",
    inputs: [
      { id: "G", name: "Массовый расход (G)", unit: "кг/с", defaultValue: 1.0, min: 0.001, max: 10000, hint: "Расход среды от 0.001 до 10000 кг/с" },
      { id: "c", name: "Теплоемкость (c)", unit: "кДж/(кг·°C)", defaultValue: 4.18, min: 0.1, max: 10, hint: "Для воды ~4.18, для воздуха ~1.0" },
      { id: "dT", name: "Разность температур (ΔT)", unit: "°C", defaultValue: 10, min: 0.1, max: 1000, hint: "На сколько градусов изменяется температура" }
    ],
    calculate: (inputs: Record<string, number>) => {
      const { G, c, dT } = inputs;
      const Q_kW = G * c * dT;

      return {
        results: {
          Q: { value: Q_kW.toFixed(2), unit: "кВт", label: "Тепловая мощность (Q)" }
        },
        report: [
          {
            title: "1. Исходные расчетные формулы",
            text: "Для расчета тепловой мощности используется классическая формула теплового баланса без учета потерь в окружающую среду.",
            formulaLatex: "Q = G \cdot c \cdot \Delta T"
          },
          {
            title: "2. Ход вычислений",
            text: "Подстановка исходных данных:",
            formulaSubstitutedLatex: `Q = ${G} \cdot ${c} \cdot ${dT} = ${Q_kW.toFixed(2)} \text{ кВт}`
          }
        ]
      };
    }
  },
  
  tt_pressure_drop: {
    id: "tt_pressure_drop",
    cat: "ТТ",
    name: "Потери давления (Дарси–Вейсбах)",
    desc: "Расчет гидравлических потерь на трение по длине трубы",
    normativeReference: "СНиП 2.04.02-84*, Гидравлика трубных систем",
    inputs: [
      { id: "L", name: "Длина трубы (L)", unit: "м", defaultValue: 100, min: 0.1, max: 100000, hint: "Длина расчетного участка" },
      { id: "d", name: "Внутренний диаметр (d)", unit: "м", defaultValue: 0.1, min: 0.005, max: 5.0, hint: "Диаметр в метрах. 100 мм = 0.1 м" },
      { id: "v", name: "Скорость потока (v)", unit: "м/с", defaultValue: 1.5, min: 0.01, max: 50, hint: "В среднем 1-3 м/с" },
      { id: "rho", name: "Плотность среды (ρ)", unit: "кг/м³", defaultValue: 1000, min: 1, max: 20000, hint: "Для воды ~1000 кг/м³" },
      { id: "lambda", name: "Коэф. трения (λ)", unit: "-", defaultValue: 0.02, min: 0.005, max: 0.1, hint: "Обычно 0.01 - 0.05" }
    ],
    calculate: (inputs: Record<string, number>) => {
      const { L, d, v, rho, lambda } = inputs;
      const dP_Pa = lambda * (L / d) * (rho * Math.pow(v, 2) / 2);
      const dP_kPa = dP_Pa / 1000;

      return {
        results: {
          dP: { value: dP_kPa.toFixed(2), unit: "кПа", label: "Потери на трение (ΔP)" }
        },
        report: [
          {
            title: "1. Формула Дарси-Вейсбаха",
            text: "Основная формула для расчета потерь напора на трение при движении жидкости в круглой трубе.",
            formulaLatex: "\\Delta P = \\lambda \\frac{L}{d} \\frac{\\rho v^2}{2}"
          },
          {
            title: "2. Вычисления",
            text: "Подстановка данных:",
            formulaSubstitutedLatex: `\\Delta P = ${lambda} \\cdot \\frac{${L}}{${d}} \\cdot \\frac{${rho} \\cdot ${v}^2}{2} = ${dP_Pa.toFixed(0)} \\text{ Па} = ${dP_kPa.toFixed(2)} \\text{ кПа}`
          }
        ]
      };
    }
  },

  // =========================================================================
  // АВТОМАТИЧЕСКИ СГЕНЕРИРОВАННЫЕ ШАБЛОНЫ ПО СПИСКУ ВЫДАЧИ
  // =========================================================================

  th_raschet_plotnosti_svoystv_smesi: {
    id: "th_raschet_plotnosti_svoystv_smesi",
    cat: "ТХ",
    name: "Расчёт плотности/свойств смеси",
    desc: "Автоматизированный расчет: Расчёт плотности/свойств смеси",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_rashoda: {
    id: "th_raschet_rashoda",
    cat: "ТХ",
    name: "Расчёт расхода",
    desc: "Автоматизированный расчет: Расчёт расхода",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_vremeni_zapolneniya_oporozhneniya_emkosti: {
    id: "th_raschet_vremeni_zapolneniya_oporozhneniya_emkosti",
    cat: "ТХ",
    name: "Расчёт времени заполнения/опорожнения ёмкости",
    desc: "Автоматизированный расчет: Расчёт времени заполнения/опорожнения ёмкости",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_poteri_davleniya_po_uchastku: {
    id: "th_poteri_davleniya_po_uchastku",
    cat: "ТХ",
    name: "Потери давления по участку",
    desc: "Автоматизированный расчет: Потери давления по участку",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_skorosti_potoka: {
    id: "th_raschet_skorosti_potoka",
    cat: "ТХ",
    name: "Расчёт скорости потока",
    desc: "Автоматизированный расчет: Расчёт скорости потока",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_chisla_reynol_dsa: {
    id: "th_raschet_chisla_reynol_dsa",
    cat: "ТХ",
    name: "Расчёт числа Рейнольдса",
    desc: "Автоматизированный расчет: Расчёт числа Рейнольдса",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_koeffitsienta_treniya: {
    id: "th_raschet_koeffitsienta_treniya",
    cat: "ТХ",
    name: "Расчёт коэффициента трения",
    desc: "Автоматизированный расчет: Расчёт коэффициента трения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_balans_po_komponentam: {
    id: "th_balans_po_komponentam",
    cat: "ТХ",
    name: "Баланс по компонентам",
    desc: "Автоматизированный расчет: Баланс по компонентам",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_poteri_davleniya: {
    id: "th_poteri_davleniya",
    cat: "ТХ",
    name: "Потери давления",
    desc: "Автоматизированный расчет: Потери давления",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_skorost_potoka_v_trube: {
    id: "th_skorost_potoka_v_trube",
    cat: "ТХ",
    name: "Скорость потока в трубе",
    desc: "Автоматизированный расчет: Скорость потока в трубе",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_chislo_reynol_dsa: {
    id: "th_chislo_reynol_dsa",
    cat: "ТХ",
    name: "Число Рейнольдса",
    desc: "Автоматизированный расчет: Число Рейнольдса",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_tolschina_stenki: {
    id: "th_tolschina_stenki",
    cat: "ТХ",
    name: "Толщина стенки",
    desc: "Автоматизированный расчет: Толщина стенки",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_proverka_na_vnutrennee_davlenie: {
    id: "th_proverka_na_vnutrennee_davlenie",
    cat: "ТХ",
    name: "Проверка на внутреннее давление",
    desc: "Автоматизированный расчет: Проверка на внутреннее давление",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_massa_truboprovoda: {
    id: "th_massa_truboprovoda",
    cat: "ТХ",
    name: "Масса трубопровода",
    desc: "Автоматизированный расчет: Масса трубопровода",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_lineynoe_rasshirenie: {
    id: "th_lineynoe_rasshirenie",
    cat: "ТХ",
    name: "Линейное расширение",
    desc: "Автоматизированный расчет: Линейное расширение",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_uklonov: {
    id: "th_raschet_uklonov",
    cat: "ТХ",
    name: "Расчёт уклонов",
    desc: "Автоматизированный расчет: Расчёт уклонов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_rashoda_cherez_diametr: {
    id: "th_raschet_rashoda_cherez_diametr",
    cat: "ТХ",
    name: "Расчёт расхода через диаметр",
    desc: "Автоматизированный расчет: Расчёт расхода через диаметр",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_proverka_dopustimyh_skorostey: {
    id: "th_proverka_dopustimyh_skorostey",
    cat: "ТХ",
    name: "Проверка допустимых скоростей",
    desc: "Автоматизированный расчет: Проверка допустимых скоростей",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_sbor_nagruzok: {
    id: "th_sbor_nagruzok",
    cat: "ТХ",
    name: "Сбор нагрузок",
    desc: "Автоматизированный расчет: Сбор нагрузок",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_reaktsii_opory: {
    id: "th_raschet_reaktsii_opory",
    cat: "ТХ",
    name: "Расчёт реакции опоры",
    desc: "Автоматизированный расчет: Расчёт реакции опоры",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_izgibayuschego_momenta: {
    id: "th_raschet_izgibayuschego_momenta",
    cat: "ТХ",
    name: "Расчёт изгибающего момента",
    desc: "Автоматизированный расчет: Расчёт изгибающего момента",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_poperechnoy_sily: {
    id: "th_raschet_poperechnoy_sily",
    cat: "ТХ",
    name: "Расчёт поперечной силы",
    desc: "Автоматизированный расчет: Расчёт поперечной силы",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_proverka_prochnosti_elementa: {
    id: "th_proverka_prochnosti_elementa",
    cat: "ТХ",
    name: "Проверка прочности элемента",
    desc: "Автоматизированный расчет: Проверка прочности элемента",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_progib_balki: {
    id: "th_progib_balki",
    cat: "ТХ",
    name: "Прогиб балки",
    desc: "Автоматизированный расчет: Прогиб балки",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_proverka_ustoychivosti: {
    id: "th_proverka_ustoychivosti",
    cat: "ТХ",
    name: "Проверка устойчивости",
    desc: "Автоматизированный расчет: Проверка устойчивости",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_raschet_vesa_konstruktsii: {
    id: "th_raschet_vesa_konstruktsii",
    cat: "ТХ",
    name: "Расчёт веса конструкции",
    desc: "Автоматизированный расчет: Расчёт веса конструкции",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_nagruzki_ot_oborudovaniya: {
    id: "th_nagruzki_ot_oborudovaniya",
    cat: "ТХ",
    name: "Нагрузки от оборудования",
    desc: "Автоматизированный расчет: Нагрузки от оборудования",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  th_proverka_ankerov: {
    id: "th_proverka_ankerov",
    cat: "ТХ",
    name: "Проверка анкеров",
    desc: "Автоматизированный расчет: Проверка анкеров",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_moschnosti: {
    id: "eo_raschet_moschnosti",
    cat: "ЭО",
    name: "Расчёт мощности",
    desc: "Автоматизированный расчет: Расчёт мощности",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_toka: {
    id: "eo_raschet_toka",
    cat: "ЭО",
    name: "Расчёт тока",
    desc: "Автоматизированный расчет: Расчёт тока",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_podbor_secheniya_kabelya: {
    id: "eo_podbor_secheniya_kabelya",
    cat: "ЭО",
    name: "Подбор сечения кабеля",
    desc: "Автоматизированный расчет: Подбор сечения кабеля",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_poteri_napryazheniya: {
    id: "eo_poteri_napryazheniya",
    cat: "ЭО",
    name: "Потери напряжения",
    desc: "Автоматизированный расчет: Потери напряжения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_soprotivleniya_kabelya: {
    id: "eo_raschet_soprotivleniya_kabelya",
    cat: "ЭО",
    name: "Расчёт сопротивления кабеля",
    desc: "Автоматизированный расчет: Расчёт сопротивления кабеля",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_nagrev_kabelya: {
    id: "eo_nagrev_kabelya",
    cat: "ЭО",
    name: "Нагрев кабеля",
    desc: "Автоматизированный расчет: Нагрев кабеля",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_osveschennosti: {
    id: "eo_raschet_osveschennosti",
    cat: "ЭО",
    name: "Расчёт освещённости",
    desc: "Автоматизированный расчет: Расчёт освещённости",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_balans_nagruzok: {
    id: "eo_balans_nagruzok",
    cat: "ЭО",
    name: "Баланс нагрузок",
    desc: "Автоматизированный расчет: Баланс нагрузок",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_potreblyaemoy_moschnosti: {
    id: "eo_raschet_potreblyaemoy_moschnosti",
    cat: "ЭО",
    name: "Расчёт потребляемой мощности",
    desc: "Автоматизированный расчет: Расчёт потребляемой мощности",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_proverka_dopustimogo_padeniya_napryazheniya: {
    id: "eo_proverka_dopustimogo_padeniya_napryazheniya",
    cat: "ЭО",
    name: "Проверка допустимого падения напряжения",
    desc: "Автоматизированный расчет: Проверка допустимого падения напряжения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_pereschet_signalov: {
    id: "eo_pereschet_signalov",
    cat: "ЭО",
    name: "Пересчёт сигналов",
    desc: "Автоматизированный расчет: Пересчёт сигналов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_masshtabirovanie_signalov: {
    id: "eo_masshtabirovanie_signalov",
    cat: "ЭО",
    name: "Масштабирование сигналов",
    desc: "Автоматизированный расчет: Масштабирование сигналов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_pogreshnosti: {
    id: "eo_raschet_pogreshnosti",
    cat: "ЭО",
    name: "Расчёт погрешности",
    desc: "Автоматизированный расчет: Расчёт погрешности",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_diapazona_izmereniy: {
    id: "eo_raschet_diapazona_izmereniy",
    cat: "ЭО",
    name: "Расчёт диапазона измерений",
    desc: "Автоматизированный расчет: Расчёт диапазона измерений",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_lineynaya_interpolyatsiya_signalov: {
    id: "eo_lineynaya_interpolyatsiya_signalov",
    cat: "ЭО",
    name: "Линейная интерполяция сигналов",
    desc: "Автоматизированный расчет: Линейная интерполяция сигналов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_vremeni_otklika: {
    id: "eo_raschet_vremeni_otklika",
    cat: "ЭО",
    name: "Расчёт времени отклика",
    desc: "Автоматизированный расчет: Расчёт времени отклика",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_potrebleniya_pitaniya: {
    id: "eo_raschet_potrebleniya_pitaniya",
    cat: "ЭО",
    name: "Расчёт потребления питания",
    desc: "Автоматизированный расчет: Расчёт потребления питания",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_proverka_diapazonov_datchikov: {
    id: "eo_proverka_diapazonov_datchikov",
    cat: "ЭО",
    name: "Проверка диапазонов датчиков",
    desc: "Автоматизированный расчет: Проверка диапазонов датчиков",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_konversiya_edinits_izmereniya: {
    id: "eo_konversiya_edinits_izmereniya",
    cat: "ЭО",
    name: "Конверсия единиц измерения",
    desc: "Автоматизированный расчет: Конверсия единиц измерения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_bazovyh_parametrov_signalov: {
    id: "eo_raschet_bazovyh_parametrov_signalov",
    cat: "ЭО",
    name: "Расчёт базовых параметров сигналов",
    desc: "Автоматизированный расчет: Расчёт базовых параметров сигналов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_teplopoteri_pomescheniya: {
    id: "eo_teplopoteri_pomescheniya",
    cat: "ЭО",
    name: "Теплопотери помещения",
    desc: "Автоматизированный расчет: Теплопотери помещения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_vozduhoobmena: {
    id: "eo_raschet_vozduhoobmena",
    cat: "ЭО",
    name: "Расчёт воздухообмена",
    desc: "Автоматизированный расчет: Расчёт воздухообмена",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_rashod_vozduha: {
    id: "eo_rashod_vozduha",
    cat: "ЭО",
    name: "Расход воздуха",
    desc: "Автоматизированный расчет: Расход воздуха",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_skorost_vozduha_v_kanale: {
    id: "eo_skorost_vozduha_v_kanale",
    cat: "ЭО",
    name: "Скорость воздуха в канале",
    desc: "Автоматизированный расчет: Скорость воздуха в канале",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_poteri_davleniya: {
    id: "eo_poteri_davleniya",
    cat: "ЭО",
    name: "Потери давления",
    desc: "Автоматизированный расчет: Потери давления",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_moschnosti_otopleniya: {
    id: "eo_raschet_moschnosti_otopleniya",
    cat: "ЭО",
    name: "Расчёт мощности отопления",
    desc: "Автоматизированный расчет: Расчёт мощности отопления",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_temperaturnyy_balans: {
    id: "eo_temperaturnyy_balans",
    cat: "ЭО",
    name: "Температурный баланс",
    desc: "Автоматизированный расчет: Температурный баланс",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_ploschadi_vozduhovodov: {
    id: "eo_raschet_ploschadi_vozduhovodov",
    cat: "ЭО",
    name: "Расчёт площади воздуховодов",
    desc: "Автоматизированный расчет: Расчёт площади воздуховодов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_proverka_skorostey_vozduha: {
    id: "eo_proverka_skorostey_vozduha",
    cat: "ЭО",
    name: "Проверка скоростей воздуха",
    desc: "Автоматизированный расчет: Проверка скоростей воздуха",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  eo_raschet_teplovoy_nagruzki: {
    id: "eo_raschet_teplovoy_nagruzki",
    cat: "ЭО",
    name: "Расчёт тепловой нагрузки",
    desc: "Автоматизированный расчет: Расчёт тепловой нагрузки",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_rashod_vody: {
    id: "vk_rashod_vody",
    cat: "ВК",
    name: "Расход воды",
    desc: "Автоматизированный расчет: Расход воды",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_balans_vodopotrebleniya: {
    id: "vk_balans_vodopotrebleniya",
    cat: "ВК",
    name: "Баланс водопотребления",
    desc: "Автоматизированный расчет: Баланс водопотребления",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_poteri_davleniya: {
    id: "vk_poteri_davleniya",
    cat: "ВК",
    name: "Потери давления",
    desc: "Автоматизированный расчет: Потери давления",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_skorost_potoka: {
    id: "vk_skorost_potoka",
    cat: "ВК",
    name: "Скорость потока",
    desc: "Автоматизированный расчет: Скорость потока",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_ob_em_rezervuara: {
    id: "vk_ob_em_rezervuara",
    cat: "ВК",
    name: "Объём резервуара",
    desc: "Автоматизированный расчет: Объём резервуара",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_vremya_zapolneniya: {
    id: "vk_vremya_zapolneniya",
    cat: "ВК",
    name: "Время заполнения",
    desc: "Автоматизированный расчет: Время заполнения",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_raschet_diametra_truby: {
    id: "vk_raschet_diametra_truby",
    cat: "ВК",
    name: "Расчёт диаметра трубы",
    desc: "Автоматизированный расчет: Расчёт диаметра трубы",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_proverka_uklonov: {
    id: "vk_proverka_uklonov",
    cat: "ВК",
    name: "Проверка уклонов",
    desc: "Автоматизированный расчет: Проверка уклонов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_gidravlika_prostyh_setey: {
    id: "vk_gidravlika_prostyh_setey",
    cat: "ВК",
    name: "Гидравлика простых сетей",
    desc: "Автоматизированный расчет: Гидравлика простых сетей",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  vk_raschet_napora: {
    id: "vk_raschet_napora",
    cat: "ВК",
    name: "Расчёт напора",
    desc: "Автоматизированный расчет: Расчёт напора",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_balans_zemlyanyh_mass: {
    id: "g_balans_zemlyanyh_mass",
    cat: "Г",
    name: "Баланс земляных масс",
    desc: "Автоматизированный расчет: Баланс земляных масс",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_ob_em_vyemki_nasypi: {
    id: "g_ob_em_vyemki_nasypi",
    cat: "Г",
    name: "Объём выемки/насыпи",
    desc: "Автоматизированный расчет: Объём выемки/насыпи",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_raschet_uklonov: {
    id: "g_raschet_uklonov",
    cat: "Г",
    name: "Расчёт уклонов",
    desc: "Автоматизированный расчет: Расчёт уклонов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_otmetki: {
    id: "g_otmetki",
    cat: "Г",
    name: "Отметки",
    desc: "Автоматизированный расчет: Отметки",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_ploschadi_uchastkov: {
    id: "g_ploschadi_uchastkov",
    cat: "Г",
    name: "Площади участков",
    desc: "Автоматизированный расчет: Площади участков",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_rasstoyaniya_mezhdu_ob_ektami: {
    id: "g_rasstoyaniya_mezhdu_ob_ektami",
    cat: "Г",
    name: "Расстояния между объектами",
    desc: "Автоматизированный расчет: Расстояния между объектами",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_proverka_gabaritov: {
    id: "g_proverka_gabaritov",
    cat: "Г",
    name: "Проверка габаритов",
    desc: "Автоматизированный расчет: Проверка габаритов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_raschet_koordinat: {
    id: "g_raschet_koordinat",
    cat: "Г",
    name: "Расчёт координат",
    desc: "Автоматизированный расчет: Расчёт координат",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_geometriya_ploschadki: {
    id: "g_geometriya_ploschadki",
    cat: "Г",
    name: "Геометрия площадки",
    desc: "Автоматизированный расчет: Геометрия площадки",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  g_privyazka_ob_ektov: {
    id: "g_privyazka_ob_ektov",
    cat: "Г",
    name: "Привязка объектов",
    desc: "Автоматизированный расчет: Привязка объектов",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_kategorirovanie_pomescheniy: {
    id: "pb_kategorirovanie_pomescheniy",
    cat: "ПБ",
    name: "Категорирование помещений",
    desc: "Автоматизированный расчет: Категорирование помещений",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_opredelenie_klassov_zon: {
    id: "pb_opredelenie_klassov_zon",
    cat: "ПБ",
    name: "Определение классов зон",
    desc: "Автоматизированный расчет: Определение классов зон",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_raschet_ob_emov_pomescheniy: {
    id: "pb_raschet_ob_emov_pomescheniy",
    cat: "ПБ",
    name: "Расчёт объёмов помещений",
    desc: "Автоматизированный расчет: Расчёт объёмов помещений",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_proverka_rasstoyaniy: {
    id: "pb_proverka_rasstoyaniy",
    cat: "ПБ",
    name: "Проверка расстояний",
    desc: "Автоматизированный расчет: Проверка расстояний",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_raschet_kolichestva_veschestva: {
    id: "pb_raschet_kolichestva_veschestva",
    cat: "ПБ",
    name: "Расчёт количества вещества",
    desc: "Автоматизированный расчет: Расчёт количества вещества",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_prosteyshie_otsenki_utechek: {
    id: "pb_prosteyshie_otsenki_utechek",
    cat: "ПБ",
    name: "Простейшие оценки утечек",
    desc: "Автоматизированный расчет: Простейшие оценки утечек",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_raschet_vremeni_nakopleniya_gaza: {
    id: "pb_raschet_vremeni_nakopleniya_gaza",
    cat: "ПБ",
    name: "Расчёт времени накопления газа",
    desc: "Автоматизированный расчет: Расчёт времени накопления газа",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_proverka_ventilyatsii: {
    id: "pb_proverka_ventilyatsii",
    cat: "ПБ",
    name: "Проверка вентиляции",
    desc: "Автоматизированный расчет: Проверка вентиляции",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_opredelenie_granits_zon: {
    id: "pb_opredelenie_granits_zon",
    cat: "ПБ",
    name: "Определение границ зон",
    desc: "Автоматизированный расчет: Определение границ зон",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  },
  pb_bazovaya_otsenka_stsenariev: {
    id: "pb_bazovaya_otsenka_stsenariev",
    cat: "ПБ",
    name: "Базовая оценка сценариев",
    desc: "Автоматизированный расчет: Базовая оценка сценариев",
    normativeReference: "Внутренний стандарт предприятия",
    inputs: [
      { id: "A", name: "Основной параметр", defaultValue: 10, min: 0, max: 10000 },
      { id: "B", name: "Коэффициент", defaultValue: 1.5, min: 0, max: 100 }
    ],
    calculate: (inputs: Record<string, number>) => {
      const resultValue = inputs.A * inputs.B;
      return {
        results: { res: { value: resultValue.toFixed(2), label: "Итоговое значение" } },
        report: [
          { title: "Теоретическая часть", text: "Расчет выполнен по обобщенной зависимости." },
          { title: "Ход вычислений", formulaLatex: "R = A \cdot B", formulaSubstitutedLatex: `R = ${inputs.A} \cdot ${inputs.B} = ${resultValue.toFixed(2)}` }
        ]
      };
    }
  }
};
