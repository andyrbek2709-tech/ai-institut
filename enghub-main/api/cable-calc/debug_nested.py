#!/usr/bin/env python3
"""Отладка nested regex для форматов типа 2х(1х20+1х70)"""
import re
import sys

# Копируем регулярные выражения из utils.py
NESTED_SECTION_RE = re.compile(
    r'(\d+)\s*[xхXХ]\s*\('  # "Nх("
    r'(\d+)\s*[xхXХ]\s*(\d+(?:[.,]\d+)?)'  # "Nх основное"
    r'(?:\s*[\+\-]\s*(\d+)\s*[xхXХ]\s*(\d+(?:[.,]\d+)?))?\s*\)',  # "Nх доп"
    re.UNICODE
)

SECTION_RE = re.compile(
    r'(?:(\d+)\s*[xхXХ]\s*)?'  # опциональное "Nх" (количество проводов)
    r'(\d+(?:[.,]\d+)?)'  # основное сечение (обязательное)
    r'(?:\s*[\+\-]\s*(\d+(?:[.,]\d+)?))?',  # опциональное доп сечение
    re.UNICODE
)

def _normalize_section_text(text: str) -> str:
    """Нормализует текст сечения перед парсингом."""
    text = text.replace('мм²', '').replace('мм', '')
    text = text.replace('Х', 'х').replace('х', 'x')
    text = re.sub(r'x\s+', 'x', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace(',', '.')
    return text

def _fix_ocr_section(text: str) -> str:
    """Исправляет частые OCR ошибки в сечениях кабеля."""
    text = _normalize_section_text(text)
    text = re.sub(r'(\d+x\d+\.?\d*)4(1x\d+)', r'\1+\2', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d)0(\d+\.?\d*)[+\-](\d)0(\d+)', r'\1x\2+\3x\4', text)
    return text

# Тестируем проблемные форматы
test_cases = [
    "2х(1х20+1х70)",
    "2х(1х20+1х70) мм²",
    "2х(10+15)",
    "2х(10+15) мм²",
    "4х(1х150+1х50)",
]

print("=" * 80)
print("ОТЛАДКА NESTED REGEX")
print("=" * 80)

for original in test_cases:
    print(f"\n📝 Оригинальный текст: '{original}'")
    normalized = _fix_ocr_section(original)
    print(f"   После нормализации: '{normalized}'")

    # Тестируем NESTED_SECTION_RE
    m_nested = NESTED_SECTION_RE.search(normalized)
    if m_nested:
        print(f"   ✅ NESTED_SECTION_RE MATCHED!")
        print(f"      Полное совпадение: '{m_nested.group(0)}'")
        print(f"      Группы: {m_nested.groups()}")
        print(f"      Group 1 (outer_n): {m_nested.group(1)}")
        print(f"      Group 2 (inner_n1): {m_nested.group(2)}")
        print(f"      Group 3 (main section): {m_nested.group(3)}")
        print(f"      Group 4 (inner_n2): {m_nested.group(4)}")
        print(f"      Group 5 (aux section): {m_nested.group(5)}")

        # Вычисляем результат как в parse_section()
        outer_n = int(m_nested.group(1))
        s = float(m_nested.group(3))
        zs = 0.0
        if m_nested.group(5):
            zs = float(m_nested.group(5))
        phases = outer_n if outer_n in (1, 2) else 3
        print(f"      ➜ Результат: phases={phases}, section={s}, zero_section={zs}")
    else:
        print(f"   ❌ NESTED_SECTION_RE НЕ СОВПАЛ")

    # Тестируем SECTION_RE
    m_simple = SECTION_RE.search(normalized)
    if m_simple:
        print(f"   SECTION_RE совпадение:")
        print(f"      Полное совпадение: '{m_simple.group(0)}'")
        print(f"      Группы: {m_simple.groups()}")
        n = int(m_simple.group(1)) if m_simple.group(1) else 3
        s = float(m_simple.group(2))
        zs = 0.0
        if m_simple.group(3):
            zs = float(m_simple.group(3))
        phases = n if n in (1, 2) else 3
        print(f"      ➜ Результат: phases={phases}, section={s}, zero_section={zs}")

print("\n" + "=" * 80)
