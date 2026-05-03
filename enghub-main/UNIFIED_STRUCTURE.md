# 📁 Единая структура проекта Cable Calculator

**Дата объединения:** 2026-05-04  
**Статус:** ✅ Полностью объединено в `/d/ai-institut/enghub-main`

---

## 🎯 Причина объединения

Раньше код был разделен между двумя папками:
- `/d/Raschety/cable_calc/` — Python backend
- `/d/Raschety/cable_calc_ui/` — Vue.js frontend
- `/d/ai-institut/enghub-main/` — Новый Vercel проект

**Теперь** всё находится в одном месте: **`/d/ai-institut/enghub-main`**

---

## 📂 Текущая структура

```
enghub-main/
├── public/
│   ├── cable-calc.html          ← ГЛАВНЫЙ UI (HTML+JS, все три режима)
│   └── [прочие статические файлы]
│
├── api/cable-calc/              ← BACKEND (Python)
│   ├── app.py                   ← Flask приложение (для локальной разработки)
│   ├── calc.py                  ← Vercel endpoint: /api/cable-calc/calc
│   ├── parse.py                 ← Vercel endpoint: парсинг файлов
│   ├── reverse.py               ← Vercel endpoint: обратный расчёт
│   ├── report-xlsx.py           ← Vercel endpoint: экспорт Excel
│   │
│   ├── engine/                  ← РАСЧЁТНЫЙ ДВИЖОК (неизменный)
│   │   ├── calc.py              ← Базовые формулы МЭК 60364-5-52 ✓
│   │   ├── tables.py            ← Справочные таблицы
│   │   ├── calculation_engine.py ← Слой делегирования (Фаза 1)
│   │   ├── validation_engine.py  ← Валидация без пересчёта (Фаза 1)
│   │   ├── reverse_calculator.py ← Обратный поиск (Фаза 3)
│   │   └── __init__.py
│   │
│   ├── models/                  ← УНИФИЦИРОВАННЫЕ МОДЕЛИ
│   │   ├── result_model.py      ← ResultModel (все режимы)
│   │   └── __init__.py
│   │
│   ├── excel/                   ← BATCH ОБРАБОТКА
│   │   ├── batch_processor.py   ← Обработчик Excel файлов
│   │   ├── batch_endpoint.py    ← Endpoint для batch (Flask)
│   │   └── __init__.py
│   │
│   ├── parsers/                 ← ПАРСЕРЫ ФАЙЛОВ
│   │   ├── pdf_parser.py        ← PDF парсинг
│   │   ├── excel_parser.py      ← Excel парсинг
│   │   ├── word_parser.py       ← Word парсинг
│   │   ├── models.py            ← Модели парсинга
│   │   ├── utils.py
│   │   └── __init__.py
│   │
│   ├── static/                  ← Статические файлы (для Flask)
│   ├── requirements.txt          ← Python зависимости
│   ├── test_phase1.py           ← Тесты (CalculationEngine)
│   ├── test_phase2.py           ← Тесты (BatchProcessor)
│   ├── test_phase3.py           ← Тесты (ReverseCalculator)
│   │
│   ├── PHASE_2_3_4_COMPLETE.md  ← Техническая документация
│   ├── IMPROVEMENTS.md
│   └── debug_*.py               ← Утилиты для отладки
│
├── INTEGRATION_COMPLETE.md      ← Итоговая документация интеграции
├── UNIFIED_STRUCTURE.md         ← ЭТА ДОКУМЕНТАЦИЯ
├── vercel.json                  ← Конфиг Vercel (endpoint'ы)
│
├── [Примеры и тесты]
├── test_kzh.py                  ← Тест парсинга кабельного журнала
├── test_journal.xlsx            ← Пример журнала
├── КЖ.PDF                       ← Пример PDF журнала
├── cable_calc_report.xlsx       ← Пример отчёта Excel
└── cable_calc_report.docx       ← Пример отчёта Word
```

---

## ✅ Что здесь есть

### 🧮 Расчётный движок (engine/)
- **Стабильный, проверенный код** из МЭК 60364-5-52
- **Не модифицируется** — принцип "чёрный ящик"
- Все новые режимы работают через обёртки

### 🌐 Три режима расчёта
1. **SINGLE** — одиночный расчёт (check-section / select-section / max-load)
2. **BATCH** — массовая обработка файлов (Excel, PDF, Word)
3. **REVERSE** — поиск минимального сечения по требованиям

### 🔗 API endpoints (Vercel serverless)
- `POST /api/cable-calc/calc` — SINGLE/BATCH расчёты
- `POST /api/cable-calc/parse` — Парсинг файлов
- `POST /api/cable-calc/reverse` — Обратный расчёт
- `POST /api/cable-calc/report-xlsx` — Экспорт Excel

### 📋 Frontend
- Единый `public/cable-calc.html` (921 строка)
- Все три режима в одном интерфейсе
- Современный дизайн (CSS Grid, темная тема)

---

## 🚀 Как это работает

### Локально (разработка)
```bash
cd api/cable-calc
python3 -m pip install -r requirements.txt
python3 app.py
# Откроется http://localhost:5000
```

### На Vercel (production)
```bash
git push origin main
# Vercel автоматически развёртывает:
# - HTML (public/cable-calc.html)
# - Python endpoints (api/cable-calc/*.py)
# - Результат: https://enghub-three.vercel.app/cable-calc.html
```

---

## 📊 Сравнение: было → стало

### БЫЛО (разделённо):
```
D:\Raschety\cable_calc\          ← Python backend
D:\Raschety\cable_calc_ui\       ← Vue.js frontend (не используется)
D:\ai-institut\enghub-main\      ← Новый Vercel проект

→ Код дублировался
→ Два фронтенда
→ Сложно обновлять
```

### СТАЛО (объединённо):
```
D:\ai-institut\enghub-main\
├── api/cable-calc\              ← Весь Python код
├── public/cable-calc.html       ← Единственный UI
└── [прочее]

✓ Единое источник истины
✓ Один фронтенд
✓ Легко обновлять
✓ Ясная структура
```

---

## 🔄 Переход на новую структуру

Если вы работали с `/d/Raschety/`:
1. **Теперь используйте:** `/d/ai-institut/enghub-main/`
2. **Git репо:** https://github.com/andyrbek2709-tech/ai-institut/
3. **Ветка:** `main`

Старую папку можно:
- ❌ **Удалить** (весь код уже в ai-institut)
- 📦 **Архивировать** (оставить как backup истории разработки)

---

## ✨ Что внутри

### Тесты (все PASSED)
```bash
cd api/cable-calc
python3 test_phase1.py  # 5/5 ✓
python3 test_phase2.py  # 6/6 ✓
python3 test_phase3.py  # 7/7 ✓
```

### Парсинг документов
- **PDF** → распознавание текста, парсинг таблиц
- **Excel** → гибкое отображение столбцов, мультиязычная поддержка
- **Word** → парсинг таблиц и текста

### Отчёты
- **Excel** → результаты с форматированием
- **Word** → технический отчёт с формулами

---

## 📝 Следующие шаги

Если нужно что-то добавить/изменить:
1. **Редактируйте** файлы в `/d/ai-institut/enghub-main/`
2. **Тестируйте** локально (`python3 app.py`)
3. **Git push** → автоматический deploy на Vercel
4. **Результат** здесь: https://enghub-three.vercel.app/cable-calc.html

---

## 🗑️ Что с `/d/Raschety`?

**Рекомендация:**
- Оставить как архив истории разработки
- Или удалить если уверены что всё скопировано

Весь активный код теперь в `/d/ai-institut/enghub-main/` ✓

---

*Структура унифицирована: 2026-05-04*  
*Автор: Claude Haiku 4.5*
