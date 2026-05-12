import React, { useState } from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { calcRegistry } from './registry';
import { exportToDocx } from './DocxExporter';

// 2c: Разбираем normativeReference на отдельные документы для кликабельных тегов
function parseNormRefs(s: string): string[] {
  return s.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
}

// =====================================================================
// Реестр конвертеров единиц
// keywords — подстроки unit'а, при совпадении показываем этот конвертер
// =====================================================================
const UNIT_CONVERTERS: Record<string, {
  label: string;
  icon: string;
  baseUnit: string;
  keywords: string[];
  rows: (v: number) => Array<[string, string]>;
}> = {
  length: {
    label: "Длина", icon: "📏", baseUnit: "м",
    keywords: ["м", "мм", "см", "км"],
    rows: (v) => [
      ["мм", (v * 1000).toFixed(2)],
      ["см", (v * 100).toFixed(3)],
      ["м", v.toFixed(4)],
      ["км", (v / 1000).toFixed(6)],
    ]
  },
  pressure: {
    label: "Давление", icon: "🔵", baseUnit: "МПа",
    keywords: ["МПа", "кПа", "Па", "бар", "атм", "кгс/см"],
    rows: (v) => [
      ["Па", (v * 1e6).toFixed(0)],
      ["кПа", (v * 1000).toFixed(3)],
      ["МПа", v.toFixed(5)],
      ["бар", (v * 10).toFixed(4)],
      ["атм", (v * 9.8692).toFixed(4)],
      ["кгс/см²", (v * 10.197).toFixed(4)],
    ]
  },
  temperature: {
    label: "Температура", icon: "🌡️", baseUnit: "°C",
    keywords: ["°C", "°к", "°f", "кельвин", "dT", "ΔT"],
    rows: (v) => [
      ["°C", v.toFixed(2)],
      ["K", (v + 273.15).toFixed(2)],
      ["°F", (v * 9 / 5 + 32).toFixed(2)],
    ]
  },
  power: {
    label: "Мощность / Теплота", icon: "⚡", baseUnit: "кВт",
    keywords: ["кВт", "Вт", "МВт", "ккал", "Гкал"],
    rows: (v) => [
      ["Вт", (v * 1000).toFixed(1)],
      ["кВт", v.toFixed(4)],
      ["МВт", (v / 1000).toFixed(6)],
      ["ккал/ч", (v * 860.2).toFixed(2)],
      ["Гкал/ч", (v * 860.2e-6).toFixed(8)],
    ]
  },
  mass: {
    label: "Масса", icon: "⚖️", baseUnit: "кг",
    keywords: ["кг", "т", "тонн"],
    rows: (v) => [
      ["г", (v * 1000).toFixed(1)],
      ["кг", v.toFixed(3)],
      ["т", (v / 1000).toFixed(6)],
    ]
  },
  flow_mass: {
    label: "Массовый расход", icon: "🌊", baseUnit: "кг/с",
    keywords: ["кг/с", "т/ч", "кг/ч", "кг/мин"],
    rows: (v) => [
      ["кг/с", v.toFixed(4)],
      ["кг/мин", (v * 60).toFixed(3)],
      ["кг/ч", (v * 3600).toFixed(2)],
      ["т/ч", (v * 3.6).toFixed(4)],
    ]
  },
  velocity: {
    label: "Скорость", icon: "💨", baseUnit: "м/с",
    keywords: ["м/с", "км/ч"],
    rows: (v) => [
      ["м/с", v.toFixed(3)],
      ["км/ч", (v * 3.6).toFixed(2)],
      ["м/мин", (v * 60).toFixed(2)],
    ]
  },
  density: {
    label: "Плотность", icon: "💧", baseUnit: "кг/м³",
    keywords: ["кг/м³", "г/л", "г/см³"],
    rows: (v) => [
      ["кг/м³", v.toFixed(3)],
      ["г/л", v.toFixed(3)],
      ["г/см³", (v / 1000).toFixed(6)],
    ]
  },
  force: {
    label: "Сила / Нагрузка", icon: "🔩", baseUnit: "кН",
    keywords: ["кН", "МН", "кгс", "тс"],
    rows: (v) => [
      ["Н", (v * 1000).toFixed(1)],
      ["кН", v.toFixed(3)],
      ["МН", (v / 1000).toFixed(6)],
      ["кгс", (v * 101.97).toFixed(2)],
      ["тс", (v * 0.10197).toFixed(4)],
    ]
  },
  area_section: {
    label: "Сечение (площадь)", icon: "📐", baseUnit: "мм²",
    keywords: ["мм²", "см²", "мм2", "см2"],
    rows: (v) => [
      ["мм²", v.toFixed(2)],
      ["см²", (v / 100).toFixed(4)],
      ["м²", (v / 1e6).toFixed(8)],
    ]
  },
  current: {
    label: "Электрический ток", icon: "⚡", baseUnit: "А",
    keywords: ["А", "мА", "кА"],
    rows: (v) => [
      ["мА", (v * 1000).toFixed(1)],
      ["А", v.toFixed(3)],
      ["кА", (v / 1000).toFixed(6)],
    ]
  },
  voltage: {
    label: "Напряжение", icon: "🔋", baseUnit: "В",
    keywords: ["В", "кВ"],
    rows: (v) => [
      ["мВ", (v * 1000).toFixed(1)],
      ["В", v.toFixed(2)],
      ["кВ", (v / 1000).toFixed(5)],
    ]
  },
};

// Определяем, какие конвертеры нужны для данного набора units
function detectConverters(units: string[]): string[] {
  const found: string[] = [];
  for (const [key, def] of Object.entries(UNIT_CONVERTERS)) {
    const needed = units.some(u =>
      def.keywords.some(kw => u.toLowerCase().includes(kw.toLowerCase()))
    );
    if (needed) found.push(key);
  }
  return found;
}

// =====================================================================

export const CalculationView = ({ calcId, C, onNormSearch }: { calcId: string, C: any, onNormSearch?: (query: string) => void }) => {
  const template = calcRegistry[calcId];
  const [inputs, setInputs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (template) template.inputs.forEach(inp => init[inp.id] = inp.defaultValue ?? 0);
    return init;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calcResult, setCalcResult] = useState<any>(null);
  const [showConverter, setShowConverter] = useState(false);
  const [convValues, setConvValues] = useState<Record<string, number>>({});

  if (!template) return <div style={{ padding: 40, color: C.textDim, textAlign: "center" }}>Выберите расчет из списка слева</div>;

  // Определяем применимые конвертеры на основе единиц входных данных
  const inputUnits = template.inputs.map(inp => inp.unit || "").filter(Boolean);
  const applicableConverters = detectConverters(inputUnits);

  const handleInputChange = (id: string, value: string) => {
    const num = parseFloat(value);
    setInputs(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
    const inpDef = template.inputs.find(i => i.id === id);
    if (!inpDef) return;
    let err = "";
    if (inpDef.min !== undefined && num < inpDef.min) err = `Мин: ${inpDef.min}. ${inpDef.hint || ""}`;
    if (inpDef.max !== undefined && num > inpDef.max) err = `Макс: ${inpDef.max}. ${inpDef.hint || ""}`;
    setErrors(prev => ({ ...prev, [id]: err }));
  };

  const handleCalculate = () => {
    if (Object.values(errors).some(e => e !== "")) {
      alert("Исправьте ошибки в исходных данных перед расчетом.");
      return;
    }
    setCalcResult(template.calculate(inputs));
  };

  const handleExport = () => {
    if (!calcResult) return;
    exportToDocx(template, inputs, calcResult.results, calcResult.report);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", position: "relative" }}>
      {/* HEADER */}
      <div style={{ padding: "24px 32px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{template.name}</div>
            <span title="Модуль расчётов в разработке — формулы и методология верифицируются" style={{
              fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
              background: "#d08a3815", color: "#d08a38", border: "1px solid #d08a3850",
              whiteSpace: "nowrap"
            }}>🚧 В разработке</span>
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{template.desc}</div>
          {template.normativeReference && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              {parseNormRefs(template.normativeReference).map(ref => (
                <span
                  key={ref}
                  title={onNormSearch ? `Открыть в поиске нормативки: ${ref}` : ref}
                  onClick={() => onNormSearch && onNormSearch(ref)}
                  style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 999, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.textMuted, fontFamily: 'monospace', letterSpacing: 0.3,
                    cursor: onNormSearch ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { if (onNormSearch) (e.currentTarget as HTMLElement).style.background = C.surface2; }}
                  onMouseLeave={e => { if (onNormSearch) (e.currentTarget as HTMLElement).style.background = C.surface; }}
                >
                  📖 {ref}
                </span>
              ))}
            </div>
          )}
        </div>
        {applicableConverters.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setShowConverter(!showConverter)}
            style={{ background: showConverter ? C.surface2 : "transparent" }}>
            🔄 Конвертер ({applicableConverters.length})
          </button>
        )}
      </div>

      {/* УМНЫЙ КОНВЕРТЕР — только нужные единицы */}
      {showConverter && applicableConverters.length > 0 && (
        <div style={{ background: C.surface2, padding: "16px 32px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Конвертер для этого расчёта:</div>
            <button style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 15 }} onClick={() => setShowConverter(false)}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {applicableConverters.map(key => {
              const def = UNIT_CONVERTERS[key];
              const v = convValues[key] ?? 1;
              return (
                <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 10 }}>
                    {def.icon} {def.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <input
                      type="number"
                      value={v}
                      onChange={e => setConvValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, outline: "none" }}
                    />
                    <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{def.baseUnit}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {def.rows(v).map(([unit, val]) => (
                      <div key={unit} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.text }}>
                        <span style={{ color: C.textMuted }}>{unit}</span>
                        <span style={{ fontWeight: 600 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32, maxWidth: 1000 }}>

        {/* INPUT FORM */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>1. Исходные данные</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {template.inputs.map(inp => (
              <div key={inp.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, color: C.textDim, fontWeight: 500 }}>
                  {inp.name} {inp.unit ? `[${inp.unit}]` : ""}
                </label>
                <input
                  type="number"
                  value={inputs[inp.id] ?? 0}
                  onChange={e => handleInputChange(inp.id, e.target.value)}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: `1.5px solid ${errors[inp.id] ? C.red : C.border}`,
                    background: C.surface2, color: C.text, outline: "none", fontSize: 15
                  }}
                />
                {errors[inp.id] && <div style={{ fontSize: 11, color: C.red }}>{errors[inp.id]}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <button className="btn btn-primary" onClick={handleCalculate} style={{ padding: "12px 32px", fontSize: 15, borderRadius: 8 }}>
              🚀 Выполнить расчет
            </button>
          </div>
        </div>

        {/* RESULTS */}
        {calcResult && (
          <div style={{ background: C.green + "08", border: `1px solid ${C.green}30`, padding: 24, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>2. Результаты и Отчет</div>
              <button className="btn btn-ghost" onClick={handleExport} style={{ border: `1px solid ${C.green}`, color: C.green }}>
                📥 Скачать .docx отчет
              </button>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24, paddingBottom: 24, borderBottom: `1px dashed ${C.border}` }}>
              {Object.values(calcResult.results).map((r: any, i) => (
                <div key={i} style={{ background: C.surface, padding: "16px 24px", borderRadius: 8, border: `1px solid ${C.border}`, flex: "1 1 min-content" }}>
                  <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>{r.label}:</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{r.value} <span style={{ fontSize: 16, color: C.textMuted, fontWeight: 500 }}>{r.unit}</span></div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {calcResult.report.map((step: any, i: number) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface, padding: 20, borderRadius: 8, border: `1px solid ${C.border}50` }}>
                  {step.title && <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{step.title}</div>}
                  {step.text && <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.5 }}>{step.text}</div>}
                  {step.formulaLatex && (
                    <div style={{ padding: "16px 0", textAlign: "center", fontSize: 18, color: C.accent, overflowX: "auto" }}>
                      <Latex>{`$$${step.formulaLatex}$$`}</Latex>
                    </div>
                  )}
                  {step.formulaSubstitutedLatex && (
                    <div style={{ padding: "12px 0", textAlign: "center", fontSize: 16, color: C.text, overflowX: "auto" }}>
                      <Latex>{`$$${step.formulaSubstitutedLatex}$$`}</Latex>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
