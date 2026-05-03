#!/usr/bin/env python3
"""Тестирование KЖ.PDF"""
import sys
sys.path.insert(0, 'd:\\Raschety\\cable_calc')

try:
    import pdfplumber

    print("=== Читаем PDF ===")
    with pdfplumber.open('d:\\Raschety\\KЖ.PDF') as pdf:
        print(f"Страниц: {len(pdf.pages)}")

        page = pdf.pages[0]
        text = page.extract_text()
        print("\n=== ТЕКСТ СО СТРАНИЦЫ 1 (первые 1000 символов) ===")
        print(text[:1000] if text else "Нет текста - это скан")

        tables = page.extract_tables()
        if tables:
            print(f"\n=== НАЙДЕНО ТАБЛИЦ: {len(tables)} ===")
            for t_idx, table in enumerate(tables):
                print(f"\nТаблица {t_idx+1}: {len(table)} строк x {len(table[0]) if table else 0} колонок")
                for row_idx, row in enumerate(table[:3]):
                    print(f"  Строка {row_idx}: {row}")
        else:
            print("\n=== ТАБЛИЦ НЕ НАЙДЕНО - используется OCR ===")

except Exception as e:
    print(f"Ошибка: {e}")
    import traceback
    traceback.print_exc()
