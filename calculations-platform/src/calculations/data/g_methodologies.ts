import { FullCalculation, Methodology } from '../types';

/**
 * Фаза 5: G — Геодезия и геометрия (10 расчётов)
 * 2 категории × 5 расчётов
 * 1. Геодезические расчёты (5)
 * 2. Геометрические расчёты (5)
 */

const PI = Math.PI;
const DEG_TO_RAD = PI / 180;
const RAD_TO_DEG = 180 / PI;
const EARTH_RADIUS_M = 6371000; // в метрах

// ============================================================================
// 1. ГЕОДЕЗИЧЕСКИЕ РАСЧЁТЫ (5)
// ============================================================================

const g_haversine_distance: Methodology = {
  id: 'g_haversine_distance',
  name: 'Формула Хаверсинуса — Расстояние между точками',
  description: 'Расчёт расстояния между двумя точками на земной поверхности по координатам',
  asciiFormula: 'd = 2·R·arcsin(√(sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)))',
  latexFormula: 'd = 2R \\arcsin\\left(\\sqrt{\\sin^2\\left(\\frac{\\Delta\\varphi}{2}\\right) + \\cos\\varphi_1 \\cos\\varphi_2 \\sin^2\\left(\\frac{\\Delta\\lambda}{2}\\right)}\\right)',
  methodology: `
Формула Хаверсинуса (Haversine formula) — наиболее точный метод расчёта расстояния между двумя точками
на сфере (земная поверхность) по их географическим координатам.

Входные параметры:
- φ₁, λ₁ — широта и долгота первой точки (градусы)
- φ₂, λ₂ — широта и долгота второй точки (градусы)
- R — радиус Земли ≈ 6371 км = 6,371,000 м

Формула:
  a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
  c = 2·arcsin(√a)
  d = R·c

Точность: ±0.5% на расстояниях до 20,000 км.
Стандарт: ГОСТ 22268-92 (Геодезические работы)
  `,
  inputs: [
    {
      key: 'lat1_deg',
      label: 'Широта точки 1',
      unit: '°',
      defaultValue: 55.7558,
      range: { min: -90, max: 90, typical: 55.75, hint: 'Северное полушарие: +, Южное: -' },
    },
    {
      key: 'lon1_deg',
      label: 'Долгота точки 1',
      unit: '°',
      defaultValue: 37.6173,
      range: { min: -180, max: 180, typical: 37.6, hint: 'Восточное полушарие: +, Западное: -' },
    },
    {
      key: 'lat2_deg',
      label: 'Широта точки 2',
      unit: '°',
      defaultValue: 55.7558,
      range: { min: -90, max: 90, typical: 55.75, hint: 'Северное полушарие: +, Южное: -' },
    },
    {
      key: 'lon2_deg',
      label: 'Долгота точки 2',
      unit: '°',
      defaultValue: 37.7,
      range: { min: -180, max: 180, typical: 37.7, hint: 'Восточное полушарие: +, Западное: -' },
    },
  ],
  outputs: [
    {
      key: 'distance_m',
      label: 'Расстояние',
      unit: 'м',
      precision: 1,
      formula: (i) => {
        const φ1 = i.lat1_deg * DEG_TO_RAD;
        const φ2 = i.lat2_deg * DEG_TO_RAD;
        const Δφ = (i.lat2_deg - i.lat1_deg) * DEG_TO_RAD;
        const Δλ = (i.lon2_deg - i.lon1_deg) * DEG_TO_RAD;

        const sinΔφ2 = Math.sin(Δφ / 2);
        const sinΔλ2 = Math.sin(Δλ / 2);
        const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
        const c = 2 * Math.asin(Math.sqrt(a));
        return EARTH_RADIUS_M * c;
      },
      threshold: {
        evaluate: (value) => {
          if (value < 1) return { severity: 'warning', message: 'Расстояние < 1 м (точки практически совпадают)' };
          if (value > 40000000) return { severity: 'warning', message: 'Расстояние > половины окружности Земли (проверьте координаты)' };
          return null;
        },
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 22268-92',
      title: 'Геодезические работы. Производство, обработка и использование геодезических измерений',
      clause: 'Раздел 5',
      quote: 'Методы расчёта расстояний между географическими пунктами',
    },
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 4.3',
    },
  ],
};

const g_bearing_azimuth: Methodology = {
  id: 'g_bearing_azimuth',
  name: 'Азимут между точками',
  description: 'Расчёт азимута (направления) от первой точки ко второй',
  asciiFormula: 'A = atan2(sin(Δλ)·cos(φ2), cos(φ1)·sin(φ2) - sin(φ1)·cos(φ2)·cos(Δλ))',
  latexFormula: 'A = \\text{atan2}(\\sin\\Delta\\lambda \\cos\\varphi_2, \\cos\\varphi_1 \\sin\\varphi_2 - \\sin\\varphi_1 \\cos\\varphi_2 \\cos\\Delta\\lambda)',
  methodology: `
Азимут — направление от первой точки к второй, измеряемое по часовой стрелке от северного направления (0°).
Расчёт выполняется на основе географических координат двух пунктов.

Формула (формулы косинуса для наибольшей точности):
  A = atan2(sin(Δλ)·cos(φ₂), cos(φ₁)·sin(φ₂) - sin(φ₁)·cos(φ₂)·cos(Δλ))

Результат в диапазоне [0°, 360°):
- 0° = Север
- 90° = Восток
- 180° = Юг
- 270° = Запад

Стандарт: ГОСТ 22268-92, СП 47.13330.2016
  `,
  inputs: [
    {
      key: 'lat1_deg',
      label: 'Широта точки 1',
      unit: '°',
      defaultValue: 55.7558,
      range: { min: -90, max: 90, typical: 55.75, hint: 'Северное полушарие: +, Южное: -' },
    },
    {
      key: 'lon1_deg',
      label: 'Долгота точки 1',
      unit: '°',
      defaultValue: 37.6173,
      range: { min: -180, max: 180, typical: 37.6, hint: 'Восточное полушарие: +, Западное: -' },
    },
    {
      key: 'lat2_deg',
      label: 'Широта точки 2',
      unit: '°',
      defaultValue: 55.7558,
      range: { min: -90, max: 90, typical: 55.75, hint: 'Северное полушарие: +, Южное: -' },
    },
    {
      key: 'lon2_deg',
      label: 'Долгота точки 2',
      unit: '°',
      defaultValue: 37.7,
      range: { min: -180, max: 180, typical: 37.7, hint: 'Восточное полушарие: +, Западное: -' },
    },
  ],
  outputs: [
    {
      key: 'azimuth_deg',
      label: 'Азимут',
      unit: '°',
      precision: 2,
      formula: (i) => {
        const φ1 = i.lat1_deg * DEG_TO_RAD;
        const φ2 = i.lat2_deg * DEG_TO_RAD;
        const Δλ = (i.lon2_deg - i.lon1_deg) * DEG_TO_RAD;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        let azimuth = Math.atan2(y, x) * RAD_TO_DEG;
        if (azimuth < 0) azimuth += 360;
        return azimuth;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 22268-92',
      title: 'Геодезические работы',
      clause: 'Раздел 5',
    },
  ],
};

const g_utm_to_geographic: Methodology = {
  id: 'g_utm_to_geographic',
  name: 'Преобразование UTM в географические координаты',
  description: 'Перевод плоских координат (UTM) в широту/долготу',
  asciiFormula: 'φ = φ₀ - (tₙ/ρ)·(x - x₀)² / 2 + ...',
  latexFormula: '\\varphi = \\varphi_0 - \\frac{t_n}{\\rho} \\cdot \\frac{(x - x_0)^2}{2} + ...',
  methodology: `
UTM (Universal Transverse Mercator) — система плоских прямоугольных координат, разбивающая Землю на 60 зон.

Преобразование из плоских UTM координат (x, y, зона) в географические (φ, λ):
1. Нормализовать координаты (восточное значение должно быть в диапазоне [166000, 834000] м)
2. Вычислить параметры эллипсоида WGS84
3. Применить формулы обратного преобразования Меркатора

Входные параметры:
- x, y — плоские координаты (м)
- zone — номер зоны UTM (1–60)
- hemisphere — полушарие ('N' = северное, 'S' = южное)

Результат: широта φ и долгота λ в градусах.

Стандарт: ISO 19101 (ГИС), СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'easting_m',
      label: 'Восточное значение (Easting)',
      unit: 'м',
      defaultValue: 489000,
      range: { min: 166000, max: 834000, typical: 500000, hint: 'Обычно 166000–834000 м в зоне' },
    },
    {
      key: 'northing_m',
      label: 'Северное значение (Northing)',
      unit: 'м',
      defaultValue: 6180000,
      range: { min: 0, max: 10000000, typical: 6180000, hint: 'Для северного полушария 0–9,000,000 м' },
    },
    {
      key: 'utm_zone',
      label: 'Номер зоны UTM',
      unit: '',
      defaultValue: 37,
      range: { min: 1, max: 60, typical: 37, hint: 'От 1 (−180°) до 60 (180°)' },
    },
  ],
  outputs: [
    {
      key: 'latitude_deg',
      label: 'Широта',
      unit: '°',
      precision: 6,
      formula: (i) => {
        const e = 0.00669438; // эксцентриситет WGS84
        const k0 = 0.9996; // масштабный коэффициент
        const a = 6378137; // большая полуось WGS84
        const m = i.northing_m / k0;
        const mu = m / (a * (1 - e / 4 - 3 * e * e / 64 - 5 * e * e * e / 256));
        const p1 = (3 * e / 8 + 3 * e * e / 32 - 45 * e * e * e / 1024) * Math.sin(2 * mu);
        const p2 = (15 * e * e / 256 - 45 * e * e * e / 1024) * Math.sin(4 * mu);
        const p3 = (35 * e * e * e / 3072) * Math.sin(6 * mu);
        const footpointLat = mu + p1 + p2 + p3;

        const c1 = e / (1 - e);
        const t = Math.tan(footpointLat);
        const n = a / Math.sqrt(1 - e * Math.sin(footpointLat) * Math.sin(footpointLat));
        const r = a * (1 - e) / Math.sqrt(Math.pow(1 - e * Math.sin(footpointLat) * Math.sin(footpointLat), 3));
        const d = (i.easting_m - 500000) / (n * k0);

        const lat = footpointLat - (n * Math.tan(footpointLat) / r) * (d * d / 2 - (d * d * d * d / 24) * (5 + 3 * t * t + 10 * c1 * c1 - 4 * c1 * c1 * c1 * c1 - 9 * c1 * c1));
        return lat * RAD_TO_DEG;
      },
    },
    {
      key: 'longitude_deg',
      label: 'Долгота',
      unit: '°',
      precision: 6,
      formula: (i) => {
        const e = 0.00669438;
        const k0 = 0.9996;
        const a = 6378137;
        const m = i.northing_m / k0;
        const mu = m / (a * (1 - e / 4 - 3 * e * e / 64 - 5 * e * e * e / 256));
        const p1 = (3 * e / 8 + 3 * e * e / 32 - 45 * e * e * e / 1024) * Math.sin(2 * mu);
        const p2 = (15 * e * e / 256 - 45 * e * e * e / 1024) * Math.sin(4 * mu);
        const p3 = (35 * e * e * e / 3072) * Math.sin(6 * mu);
        const footpointLat = mu + p1 + p2 + p3;

        const c1 = e / (1 - e);
        const t = Math.tan(footpointLat);
        const n = a / Math.sqrt(1 - e * Math.sin(footpointLat) * Math.sin(footpointLat));
        const d = (i.easting_m - 500000) / (n * k0);

        const lon = ((d - (d * d * d / 6) * (1 + 2 * t * t + c1 * c1) + (d * d * d * d * d / 120) * (5 - 2 * c1 * c1 + 28 * t * t - 3 * c1 * c1 * c1 * c1 + 8 * c1 * c1 * t * t)) / Math.cos(footpointLat)) * RAD_TO_DEG;
        const lonZone = ((i.utm_zone - 1) * 6 - 180) + 3;
        return lonZone + lon;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'ISO 19101:2014',
      title: 'Geographic information — Reference model',
      clause: 'Annex E — UTM conversion',
    },
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 4.5',
    },
  ],
};

const g_height_by_angle_distance: Methodology = {
  id: 'g_height_by_angle_distance',
  name: 'Высота по углу наклона и расстоянию',
  description: 'Расчёт превышения между двумя пунктами по угловому измерению и горизонтальному расстоянию',
  asciiFormula: 'h = d·tan(α)',
  latexFormula: 'h = d \\cdot \\tan(\\alpha)',
  methodology: `
Тригонометрический метод определения превышения по результатам угломерных и дальномерных работ.

Входные параметры:
- d — горизонтальное расстояние между пунктами (м)
- α — угол наклона визирной оси (°, положительный вверх)

Формула:
  h = d·tan(α)

Корректировка на кривизну Земли для расстояний > 100 км:
  h_корр = d·tan(α) - d² / (2R), где R = 6,371 км

Этот метод используется при тахеометрической съёмке, определении высот при геодезических работах.

Стандарт: ГОСТ 22268-92, СП 47.13330.2016
  `,
  inputs: [
    {
      key: 'horizontal_distance_m',
      label: 'Горизонтальное расстояние',
      unit: 'м',
      defaultValue: 100,
      range: { min: 0.1, max: 100000, typical: 100, hint: 'Расстояние между пунктами по горизонтали' },
    },
    {
      key: 'angle_deg',
      label: 'Угол наклона',
      unit: '°',
      defaultValue: 5,
      range: { min: -90, max: 90, typical: 5, hint: 'Положительный угол — вверх, отрицательный — вниз' },
    },
  ],
  outputs: [
    {
      key: 'height_m',
      label: 'Превышение (высота)',
      unit: 'м',
      precision: 2,
      formula: (i) => i.horizontal_distance_m * Math.tan(i.angle_deg * DEG_TO_RAD),
      threshold: {
        evaluate: (value, inputs) => {
          const slopePercent = (Math.abs(value) / inputs.horizontal_distance_m) * 100;
          if (slopePercent > 100) return { severity: 'warning', message: 'Уклон > 100% (угол > 45°) — очень крутой' };
          return null;
        },
      },
    },
    {
      key: 'slope_percent',
      label: 'Уклон',
      unit: '%',
      precision: 1,
      formula: (i) => (Math.abs(i.horizontal_distance_m * Math.tan(i.angle_deg * DEG_TO_RAD)) / i.horizontal_distance_m) * 100,
    },
  ],
  normativeRefs: [
    {
      code: 'ГОСТ 22268-92',
      title: 'Геодезические работы',
      clause: 'Раздел 6',
    },
  ],
};

const g_polygon_area_shoelace: Methodology = {
  id: 'g_polygon_area_shoelace',
  name: 'Площадь полигона по координатам (формула Шнурка)',
  description: 'Расчёт площади произвольного многоугольника на плоскости по координатам вершин',
  asciiFormula: 'A = ½·|Σ(xᵢ·yᵢ₊₁ - xᵢ₊₁·yᵢ)|',
  latexFormula: 'A = \\frac{1}{2} \\left| \\sum_{i=0}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) \\right|',
  methodology: `
Формула Шнурка (Shoelace formula) — алгоритм расчёта площади многоугольника на плоскости по координатам его вершин.

Входные параметры:
- Координаты вершин многоугольника: (x₁, y₁), (x₂, y₂), ..., (xₙ, yₙ)
- Вершины должны быть упорядочены (обычно в порядке против часовой стрелки)

Формула:
  A = ½·|Σ(xᵢ·yᵢ₊₁ - xᵢ₊₁·yᵢ)|, где индексы циклические

Точность: Точная для любого простого многоугольника (без самопересечений).

Пример использования: расчёт площади земельного участка, здания, площадки по координатам.

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'vertices_count',
      label: 'Количество вершин',
      unit: '',
      defaultValue: 4,
      range: { min: 3, max: 100, typical: 4, hint: 'Минимум 3 (треугольник), обычно 4 (четырёхугольник)' },
    },
    {
      key: 'vertex_x1',
      label: 'X вершины 1',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: 'Координата X первой вершины' },
    },
    {
      key: 'vertex_y1',
      label: 'Y вершины 1',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: 'Координата Y первой вершины' },
    },
    {
      key: 'vertex_x2',
      label: 'X вершины 2',
      unit: 'м',
      defaultValue: 100,
      range: { min: -100000, max: 100000, typical: 100, hint: '' },
    },
    {
      key: 'vertex_y2',
      label: 'Y вершины 2',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: '' },
    },
    {
      key: 'vertex_x3',
      label: 'X вершины 3',
      unit: 'м',
      defaultValue: 100,
      range: { min: -100000, max: 100000, typical: 100, hint: '' },
    },
    {
      key: 'vertex_y3',
      label: 'Y вершины 3',
      unit: 'м',
      defaultValue: 100,
      range: { min: -100000, max: 100000, typical: 100, hint: '' },
    },
    {
      key: 'vertex_x4',
      label: 'X вершины 4',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: '' },
    },
    {
      key: 'vertex_y4',
      label: 'Y вершины 4',
      unit: 'м',
      defaultValue: 100,
      range: { min: -100000, max: 100000, typical: 100, hint: '' },
    },
  ],
  outputs: [
    {
      key: 'area_m2',
      label: 'Площадь',
      unit: 'м²',
      precision: 1,
      formula: (i) => {
        const vertices = [
          [i.vertex_x1, i.vertex_y1],
          [i.vertex_x2, i.vertex_y2],
          [i.vertex_x3, i.vertex_y3],
          [i.vertex_x4, i.vertex_y4],
        ];
        let sum = 0;
        for (let j = 0; j < vertices.length; j++) {
          const k = (j + 1) % vertices.length;
          sum += vertices[j][0] * vertices[k][1] - vertices[k][0] * vertices[j][1];
        }
        return Math.abs(sum) / 2;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 5.2',
    },
  ],
};

const g_triangle_heron: Methodology = {
  id: 'g_triangle_heron',
  name: 'Площадь треугольника по трём сторонам (формула Герона)',
  description: 'Расчёт площади треугольника, если известны длины всех трёх сторон',
  asciiFormula: 'A = √(p·(p-a)·(p-b)·(p-c)), где p = (a+b+c)/2',
  latexFormula: 'A = \\sqrt{p(p-a)(p-b)(p-c)}, \\quad p = \\frac{a+b+c}{2}',
  methodology: `
Формула Герона (Heron's formula) — способ вычисления площади треугольника по длинам его сторон.

Входные параметры:
- a, b, c — длины сторон треугольника (м)

Формула:
  s = (a + b + c) / 2 — полупериметр
  A = √(s·(s-a)·(s-b)·(s-c))

Условия применения:
- Стороны должны удовлетворять неравенству треугольника: a + b > c, a + c > b, b + c > a
- Если условие нарушено, треугольник невозможен

Точность: Высокая. Рекомендуется для площадей до 1 млн м².
Для очень больших треугольников (> 10,000 м) используйте формулу с поправкой на кривизну.

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'side_a_m',
      label: 'Сторона a',
      unit: 'м',
      defaultValue: 10,
      range: { min: 0.1, max: 100000, typical: 10, hint: 'Длина первой стороны' },
    },
    {
      key: 'side_b_m',
      label: 'Сторона b',
      unit: 'м',
      defaultValue: 12,
      range: { min: 0.1, max: 100000, typical: 12, hint: 'Длина второй стороны' },
    },
    {
      key: 'side_c_m',
      label: 'Сторона c',
      unit: 'м',
      defaultValue: 8,
      range: { min: 0.1, max: 100000, typical: 8, hint: 'Длина третьей стороны' },
    },
  ],
  outputs: [
    {
      key: 'area_m2',
      label: 'Площадь',
      unit: 'м²',
      precision: 2,
      formula: (i) => {
        const s = (i.side_a_m + i.side_b_m + i.side_c_m) / 2;
        return Math.sqrt(s * (s - i.side_a_m) * (s - i.side_b_m) * (s - i.side_c_m));
      },
      threshold: {
        evaluate: (_, inputs) => {
          if (inputs.side_a_m + inputs.side_b_m <= inputs.side_c_m || inputs.side_a_m + inputs.side_c_m <= inputs.side_b_m || inputs.side_b_m + inputs.side_c_m <= inputs.side_a_m) {
            return { severity: 'critical', message: 'Стороны не удовлетворяют неравенству треугольника — треугольник невозможен' };
          }
          return null;
        },
      },
    },
    {
      key: 'perimeter_m',
      label: 'Периметр',
      unit: 'м',
      precision: 2,
      formula: (i) => i.side_a_m + i.side_b_m + i.side_c_m,
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 5.2',
    },
  ],
};

const g_circle_segment_area: Methodology = {
  id: 'g_circle_segment_area',
  name: 'Площадь кругового сегмента',
  description: 'Расчёт площади части круга, ограниченной хордой',
  asciiFormula: 'A = (R²/2)·(θ - sin(θ)), где θ = 2·arcsin(c/(2·R))',
  latexFormula: 'A = \\frac{R^2}{2}(\\theta - \\sin\\theta), \\quad \\theta = 2\\arcsin\\left(\\frac{c}{2R}\\right)',
  methodology: `
Круговой сегмент — часть круга, ограниченная хордой и дугой окружности.

Входные параметры:
- R — радиус круга (м)
- c — длина хорды (м)

Расчёт:
1. Центральный угол θ = 2·arcsin(c/(2·R))
2. Площадь сегмента A = (R²/2)·(θ - sin(θ))

Альтернативная формула (если известна высота h сегмента):
  A = R²·arccos((R-h)/R) - (R-h)·√(2·R·h - h²)

Применение: расчёты площадей при трубопроводах, кровле, резервуарах с круговым сечением.

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'radius_m',
      label: 'Радиус круга',
      unit: 'м',
      defaultValue: 10,
      range: { min: 0.1, max: 100000, typical: 10, hint: 'Радиус круга (не диаметр)' },
    },
    {
      key: 'chord_length_m',
      label: 'Длина хорды',
      unit: 'м',
      defaultValue: 12,
      range: { min: 0.1, max: 200000, typical: 12, hint: 'Должна быть ≤ 2·R (диаметр)' },
    },
  ],
  outputs: [
    {
      key: 'segment_area_m2',
      label: 'Площадь сегмента',
      unit: 'м²',
      precision: 2,
      formula: (i) => {
        const sinArg = Math.min(1, i.chord_length_m / (2 * i.radius_m));
        const theta = 2 * Math.asin(sinArg);
        return (i.radius_m * i.radius_m / 2) * (theta - Math.sin(theta));
      },
      threshold: {
        evaluate: (_, inputs) => {
          if (inputs.chord_length_m > 2 * inputs.radius_m) {
            return { severity: 'critical', message: 'Длина хорды > 2·R (диаметра) — невозможна' };
          }
          return null;
        },
      },
    },
    {
      key: 'central_angle_deg',
      label: 'Центральный угол',
      unit: '°',
      precision: 2,
      formula: (i) => {
        const sinArg = Math.min(1, i.chord_length_m / (2 * i.radius_m));
        const theta = 2 * Math.asin(sinArg);
        return theta * RAD_TO_DEG;
      },
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 5.2',
    },
  ],
};

const g_circle_circumference: Methodology = {
  id: 'g_circle_circumference',
  name: 'Окружность и площадь круга',
  description: 'Расчёт длины окружности и площади круга по радиусу',
  asciiFormula: 'C = 2·π·R, A = π·R²',
  latexFormula: 'C = 2\\pi R, \\quad A = \\pi R^2',
  methodology: `
Основные параметры круга:

Длина окружности (периметр):
  C = 2·π·R = π·d

Площадь:
  A = π·R² = (π·d²) / 4

Входные параметры:
- R — радиус круга (м)

Применение:
- Расчёты трубопроводов круглого сечения
- Определение длины кровельных сёток, труб
- Вычисление площади круглого основания

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'radius_m',
      label: 'Радиус круга',
      unit: 'м',
      defaultValue: 5,
      range: { min: 0.01, max: 100000, typical: 5, hint: 'Радиус (не диаметр)' },
    },
  ],
  outputs: [
    {
      key: 'circumference_m',
      label: 'Окружность',
      unit: 'м',
      precision: 2,
      formula: (i) => 2 * PI * i.radius_m,
    },
    {
      key: 'area_m2',
      label: 'Площадь',
      unit: 'м²',
      precision: 2,
      formula: (i) => PI * i.radius_m * i.radius_m,
    },
    {
      key: 'diameter_m',
      label: 'Диаметр',
      unit: 'м',
      precision: 2,
      formula: (i) => 2 * i.radius_m,
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 5.2',
    },
  ],
};

const g_rectangle_params: Methodology = {
  id: 'g_rectangle_params',
  name: 'Прямоугольник: площадь, периметр, диагональ',
  description: 'Расчёт основных параметров прямоугольника по длинам сторон',
  asciiFormula: 'A = a·b, P = 2·(a+b), d = √(a²+b²)',
  latexFormula: 'A = a \\cdot b, \\quad P = 2(a+b), \\quad d = \\sqrt{a^2 + b^2}',
  methodology: `
Основные параметры прямоугольника со сторонами a и b:

Площадь:
  A = a·b

Периметр:
  P = 2·(a + b)

Диагональ:
  d = √(a² + b²)

Входные параметры:
- a — длина одной стороны (м)
- b — длина другой стороны (м)

Применение:
- Расчёты площадей помещений, участков
- Определение периметра забора, кровли
- Проверка диагоналей при разметке

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'side_a_m',
      label: 'Сторона a',
      unit: 'м',
      defaultValue: 10,
      range: { min: 0.01, max: 100000, typical: 10, hint: 'Длина одной стороны' },
    },
    {
      key: 'side_b_m',
      label: 'Сторона b',
      unit: 'м',
      defaultValue: 5,
      range: { min: 0.01, max: 100000, typical: 5, hint: 'Длина другой стороны' },
    },
  ],
  outputs: [
    {
      key: 'area_m2',
      label: 'Площадь',
      unit: 'м²',
      precision: 2,
      formula: (i) => i.side_a_m * i.side_b_m,
    },
    {
      key: 'perimeter_m',
      label: 'Периметр',
      unit: 'м',
      precision: 2,
      formula: (i) => 2 * (i.side_a_m + i.side_b_m),
    },
    {
      key: 'diagonal_m',
      label: 'Диагональ',
      unit: 'м',
      precision: 2,
      formula: (i) => Math.sqrt(i.side_a_m * i.side_a_m + i.side_b_m * i.side_b_m),
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 5.2',
    },
  ],
};

const g_distance_3d: Methodology = {
  id: 'g_distance_3d',
  name: 'Расстояние между точками в пространстве (3D)',
  description: 'Расчёт пространственного расстояния между двумя точками с координатами X, Y, Z',
  asciiFormula: 'd = √((x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²)',
  latexFormula: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}',
  methodology: `
Трёхмерное евклидово расстояние — расстояние между двумя точками в пространстве.

Входные параметры:
- (x₁, y₁, z₁) — координаты первой точки (м)
- (x₂, y₂, z₂) — координаты второй точки (м)

Формула:
  d = √((x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²)

Применение:
- Расчёты расстояний между пунктами при пространственной съёмке
- Определение длины трубопровода в 3D
- Проверка расстояний между конструктивными элементами

Частные случаи:
- 2D (z₁ = z₂): d = √((x₂-x₁)² + (y₂-y₁)²) — планиметрическое расстояние
- 1D (y₁ = y₂, z₁ = z₂): d = |x₂-x₁| — расстояние вдоль оси X

Стандарт: СП 47.13330.2016 (Инженерные изыскания)
  `,
  inputs: [
    {
      key: 'x1_m',
      label: 'X координата точки 1',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: 'Координата X первой точки' },
    },
    {
      key: 'y1_m',
      label: 'Y координата точки 1',
      unit: 'м',
      defaultValue: 0,
      range: { min: -100000, max: 100000, typical: 0, hint: 'Координата Y первой точки' },
    },
    {
      key: 'z1_m',
      label: 'Z координата точки 1',
      unit: 'м',
      defaultValue: 0,
      range: { min: -10000, max: 10000, typical: 0, hint: 'Координата Z (высота) первой точки' },
    },
    {
      key: 'x2_m',
      label: 'X координата точки 2',
      unit: 'м',
      defaultValue: 30,
      range: { min: -100000, max: 100000, typical: 30, hint: 'Координата X второй точки' },
    },
    {
      key: 'y2_m',
      label: 'Y координата точки 2',
      unit: 'м',
      defaultValue: 40,
      range: { min: -100000, max: 100000, typical: 40, hint: 'Координата Y второй точки' },
    },
    {
      key: 'z2_m',
      label: 'Z координата точки 2',
      unit: 'м',
      defaultValue: 10,
      range: { min: -10000, max: 10000, typical: 10, hint: 'Координата Z (высота) второй точки' },
    },
  ],
  outputs: [
    {
      key: 'distance_3d_m',
      label: 'Пространственное расстояние',
      unit: 'м',
      precision: 2,
      formula: (i) => {
        const dx = i.x2_m - i.x1_m;
        const dy = i.y2_m - i.y1_m;
        const dz = i.z2_m - i.z1_m;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      },
    },
    {
      key: 'horizontal_distance_m',
      label: 'Горизонтальное расстояние (XY)',
      unit: 'м',
      precision: 2,
      formula: (i) => {
        const dx = i.x2_m - i.x1_m;
        const dy = i.y2_m - i.y1_m;
        return Math.sqrt(dx * dx + dy * dy);
      },
    },
    {
      key: 'vertical_distance_m',
      label: 'Вертикальное расстояние (ΔZ)',
      unit: 'м',
      precision: 2,
      formula: (i) => Math.abs(i.z2_m - i.z1_m),
    },
  ],
  normativeRefs: [
    {
      code: 'СП 47.13330.2016',
      title: 'Инженерные изыскания для строительства',
      clause: 'п. 4.3',
    },
  ],
};

// ============================================================================
// ЭКСПОРТ РАСЧЁТОВ
// ============================================================================

export const G_CALCULATIONS: FullCalculation[] = [
  // Геодезические
  {
    id: 'g-haversine-distance',
    name: 'Расстояние между географическими пунктами (Haversine)',
    description: 'Расчёт расстояния между двумя точками на земной поверхности по формуле Хаверсинуса',
    category: 'geodesy',
    methodologies: [g_haversine_distance],
    defaultMethodologyId: 'g_haversine_distance',
    keywords: ['геодезия', 'расстояние', 'координаты', 'широта', 'долгота'],
  },
  {
    id: 'g-bearing-azimuth',
    name: 'Азимут между географическими пунктами',
    description: 'Расчёт направления (азимута) от одной точки к другой по географическим координатам',
    category: 'geodesy',
    methodologies: [g_bearing_azimuth],
    defaultMethodologyId: 'g_bearing_azimuth',
    keywords: ['геодезия', 'азимут', 'направление', 'пеленг'],
  },
  {
    id: 'g-utm-to-geographic',
    name: 'Преобразование UTM → географические координаты',
    description: 'Перевод плоских координат UTM в широту и долготу',
    category: 'geodesy',
    methodologies: [g_utm_to_geographic],
    defaultMethodologyId: 'g_utm_to_geographic',
    keywords: ['геодезия', 'UTM', 'координаты', 'преобразование'],
  },
  {
    id: 'g-height-by-angle-distance',
    name: 'Высота по углу наклона и расстоянию',
    description: 'Расчёт превышения между двумя пунктами тригонометрическим методом',
    category: 'geodesy',
    methodologies: [g_height_by_angle_distance],
    defaultMethodologyId: 'g_height_by_angle_distance',
    keywords: ['геодезия', 'высота', 'превышение', 'угол наклона'],
  },
  {
    id: 'g-distance-3d',
    name: 'Расстояние между точками в пространстве (3D)',
    description: 'Расчёт пространственного расстояния между двумя точками с координатами X, Y, Z',
    category: 'geodesy',
    methodologies: [g_distance_3d],
    defaultMethodologyId: 'g_distance_3d',
    keywords: ['геодезия', 'расстояние', '3D', 'пространство'],
  },

  // Геометрические
  {
    id: 'g-polygon-area-shoelace',
    name: 'Площадь многоугольника (формула Шнурка)',
    description: 'Расчёт площади произвольного многоугольника по координатам вершин',
    category: 'geodesy',
    methodologies: [g_polygon_area_shoelace],
    defaultMethodologyId: 'g_polygon_area_shoelace',
    keywords: ['геометрия', 'площадь', 'полигон', 'координаты'],
  },
  {
    id: 'g-triangle-heron',
    name: 'Площадь треугольника (формула Герона)',
    description: 'Расчёт площади треугольника по длинам трёх его сторон',
    category: 'geodesy',
    methodologies: [g_triangle_heron],
    defaultMethodologyId: 'g_triangle_heron',
    keywords: ['геометрия', 'площадь', 'треугольник'],
  },
  {
    id: 'g-circle-segment-area',
    name: 'Площадь кругового сегмента',
    description: 'Расчёт площади части круга, ограниченной хордой и дугой',
    category: 'geodesy',
    methodologies: [g_circle_segment_area],
    defaultMethodologyId: 'g_circle_segment_area',
    keywords: ['геометрия', 'площадь', 'круг', 'сегмент'],
  },
  {
    id: 'g-circle-circumference',
    name: 'Окружность и площадь круга',
    description: 'Расчёт длины окружности и площади круга по радиусу',
    category: 'geodesy',
    methodologies: [g_circle_circumference],
    defaultMethodologyId: 'g_circle_circumference',
    keywords: ['геометрия', 'окружность', 'круг', 'площадь'],
  },
  {
    id: 'g-rectangle-params',
    name: 'Прямоугольник: площадь, периметр, диагональ',
    description: 'Расчёт основных параметров прямоугольника по длинам сторон',
    category: 'geodesy',
    methodologies: [g_rectangle_params],
    defaultMethodologyId: 'g_rectangle_params',
    keywords: ['геометрия', 'прямоугольник', 'площадь', 'периметр'],
  },
];
