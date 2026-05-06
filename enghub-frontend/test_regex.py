#!/usr/bin/env python3
"""Тестирование regex SECTION_RE против форматов из KЖ.PDF"""
import re

# Текущий regex из utils.py
SECTION_RE = re.compile(
    r'(?:(\d+)\s*[xхXХ]\s*)?'  # опциональное "Nх" (количество проводов)
    r'\(?\s*(?:(?:\d+\s*[xхXХ]\s*)*)?(\d+(?:[.,]\d+)?)'  # основное сечение
    r'(?:\s*[\+\-]\s*\(?\s*(?:(?:\d+\s*[xхXХ]\s*)*)?(\d+(?:[.,]\d+)?))?\s*\)?',  # опциональное доп сечение
    re.UNICODE
)

def _fix_ocr_section(text: str) -> str:
    """Исправляет частые OCR ошибки в сечениях кабеля."""
    text = text.replace('мм²', '').replace('(', '').replace(')', '')
    text = re.sub(r'(\d+[xхXХ]\d+?)4(1[xхXХ]\d+)', r'\g<1>+\2', text)
    text = text.replace(',', '.')
    return text

def parse_section(text: str) -> tuple:
    """Парсит сечение кабеля"""
    text = _fix_ocr_section(text)
    m = SECTION_RE.search(text)
    if not m:
        return 3, 0.0, 0.0, ""

    n = int(m.group(1)) if m.group(1) else 3
    s_str = m.group(2).replace(',', '.')
    s = float(s_str)
    zs = 0.0
    if m.group(3):
        zs_str = m.group(3).replace(',', '.')
        zs = float(zs_str)
    phases = n if n in (1, 2) else 3
    return phases, s, zs, m.group(0).strip()

# Форматы которые должны работать (из IMPROVEMENTS.md)
test_cases = [
    ("4x95", (3, 95.0, 0.0, "95")),  # простая формула
    ("4,95", (3, 4.95, 0.0, "4.95")),  # запятая
    ("4.95", (3, 4.95, 0.0, "4.95")),  # точка
    ("4x95+1x50", (4, 95.0, 50.0, "4x95+1x50")),  # плюс
    ("4x95-1x50", (4, 95.0, 50.0, "4x95-1x50")),  # минус
    ("2х (101 мм²)", (2, 101.0, 0.0, "101")),  # со скобками
    ("2х (101+1х50 мм²)", (2, 101.0, 50.0, None)),  # со скобками и доп сечением
    ("2х320", (2, 320.0, 0.0, "2х320")),  # простое число без скобок
    ("2x(1х20+1х70) мм²", (2, 20.0, 70.0, None)),  # вложенное
    ("2.5 мм²", (3, 2.5, 0.0, "2.5")),  # просто число БЕЗ х
    ("0.75", (3, 0.75, 0.0, "0.75")),  # просто число без единиц
    ("3х1,5 мм²", (3, 1.5, 0.0, "1.5")),  # запятая с х
    ("2х95", (2, 95.0, 0.0, "2х95")),  # киррилица х
]

print("=" * 80)
print("ТЕСТИРОВАНИЕ REGEX SECTION_RE")
print("=" * 80)

failed = []
for test_input, expected in test_cases:
    phases, s, zs, raw = parse_section(test_input)

    # Проверяем основные значения (не проверяем raw, т.к. он может отличаться)
    success = phases == expected[0] and s == expected[1] and zs == expected[2]

    status = "✓ OK" if success else "✗ FAIL"
    print(f"\n{status} | Вход: '{test_input}'")
    print(f"       Expected: phases={expected[0]}, s={expected[1]}, zs={expected[2]}")
    print(f"       Got:      phases={phases}, s={s}, zs={zs}")
    print(f"       Raw:      '{raw}'")

    if not success:
        failed.append(test_input)
        # Debug: показываем что поймал regex
        fixed = _fix_ocr_section(test_input)
        m = SECTION_RE.search(fixed)
        if m:
            print(f"       DEBUG: Fixed='{fixed}' | Match groups: {m.groups()}")
        else:
            print(f"       DEBUG: Fixed='{fixed}' | NO MATCH!")

print("\n" + "=" * 80)
if failed:
    print(f"FAILED: {len(failed)} из {len(test_cases)} тестов")
    print("Не прошли:")
    for f in failed:
        print(f"  - '{f}'")
else:
    print(f"SUCCESS: все {len(test_cases)} тестов прошли!")
print("=" * 80)
