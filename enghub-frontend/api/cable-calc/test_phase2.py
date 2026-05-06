#!/usr/bin/env python3
"""
Тестирование Фазы 2: ExcelBatchProcessor и BatchEndpoint

Это быстрый тест, чтобы убедиться, что:
1. ExcelBatchProcessor корректно обрабатывает Excel файлы
2. Создает ResultModel для каждой строки
3. Возвращает BatchResultSummary
4. Обработка продолжается несмотря на ошибки отдельных строк
"""
import sys
import os
import json
import tempfile
import time

# Добавить текущую папку в path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openpyxl import Workbook
from excel.batch_processor import ExcelBatchProcessor
from engine import CalculationEngine
from models import ResultModel


def create_test_excel_file(filename, rows):
    """
    Создать тестовый Excel файл.

    Args:
        filename: Путь для сохранения файла
        rows: Список строк (dict)

    Returns:
        Путь к файлу
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Data"

    # Заголовки
    headers = [
        "ID",
        "Название",
        "Сечение (мм²)",
        "Длина (м)",
        "Мощность (кВ)",
        "Фазы",
        "cos φ",
        "Материал",
        "Изоляция",
        "Способ прокладки",
        "Температура (°C)",
        "В группе",
        "Параллельные",
    ]

    ws.append(headers)

    # Данные
    for row in rows:
        ws.append(row)

    wb.save(filename)
    return filename


def test_batch_processor_basic():
    """Тест 1: Базовая обработка Excel файла"""
    print("\n=== Тест 1: Базовая обработка ExcelBatchProcessor ===")

    # Создать тестовый Excel файл
    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_basic.xlsx")

    rows = [
        # ID, Name, Section, Length, Power, Phases, cos_phi, Material, Insulation, Method, Temp, Nearby, Count
        [1, "Линия 1", 16, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
        [2, "Линия 2", None, 100, 22, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],  # No section - select mode
        [3, "Линия 3", 10, 75, None, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],  # No power - check mode
    ]

    create_test_excel_file(test_file, rows)
    print(f"  ✓ Создан тестовый файл: {test_file}")

    try:
        # Обработать файл
        processor = ExcelBatchProcessor()
        t0 = time.time()
        results, summary = processor.process_batch(test_file, sheet_name="Data")
        t1 = time.time()

        print(f"  ✓ Обработка завершена за {(t1 - t0) * 1000:.1f} мс")
        print(f"  - Обработано строк: {summary.total_processed}")
        print(f"  - OK: {summary.ok_count} ({summary.ok_percentage:.1f}%)")
        print(f"  - WARNING: {summary.warning_count} ({summary.warning_percentage:.1f}%)")
        print(f"  - ERROR: {summary.error_count} ({summary.error_percentage:.1f}%)")

        # Проверить что все строки обработаны
        if summary.total_processed != 3:
            print(f"  ✗ Ожидалось 3 результата, получено {summary.total_processed}")
            return False

        # Проверить типы результатов
        for i, result in enumerate(results):
            if not isinstance(result, ResultModel):
                print(f"  ✗ Результат {i} не является ResultModel")
                return False

        print("  ✓ Все результаты являются ResultModel")
        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def test_batch_processor_with_errors():
    """Тест 2: Обработка файла с ошибочными строками"""
    print("\n=== Тест 2: Обработка файла с ошибками ===")

    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_errors.xlsx")

    rows = [
        [1, "OK строка", 16, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
        [2, "Ошибка: нет ничего", None, None, None, None, None, None, None, None, None, 1, 1],  # Все None
        [3, "OK строка 2", 10, 100, 22, 3, 0.85, "Cu", "XLPE", "C", 30, 1, 1],
        [4, "Плохой материал", 16, 50, 15, 3, 0.85, "INVALID", "PVC", "C", 30, 1, 1],
        [5, "OK строка 3", 25, 200, 30, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
    ]

    create_test_excel_file(test_file, rows)
    print(f"  ✓ Создан файл с ошибочными строками")

    try:
        processor = ExcelBatchProcessor()
        results, summary = processor.process_batch(test_file, sheet_name="Data")

        print(f"  ✓ Обработка завершена несмотря на ошибки")
        print(f"  - Всего обработано: {summary.total_processed}")
        print(f"  - OK: {summary.ok_count}")
        print(f"  - WARNING: {summary.warning_count}")
        print(f"  - ERROR: {summary.error_count}")

        # Проверить что обработка продолжилась
        if summary.total_processed < 3:
            print(f"  ✗ Обработка остановилась на ошибке (обработано {summary.total_processed})")
            return False

        # Должны быть результаты с ошибками
        error_count = sum(1 for r in results if r.status == "ERROR")
        if error_count == 0:
            print(f"  ✗ Ошибочные строки не были помечены как ERROR")
            return False

        print(f"  ✓ Найдено {error_count} ошибочных строк")
        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def test_batch_processor_column_mapping():
    """Тест 3: Гибкое соответствие столбцов (COLUMN_MAPPING)"""
    print("\n=== Тест 3: Гибкое соответствие столбцов (multilingual) ===")

    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_columns.xlsx")

    wb = Workbook()
    ws = wb.active

    # Использовать русские названия вместо English
    headers = [
        "№",  # вместо ID
        "название",  # вместо Name
        "сечение",  # вместо Section
        "длина",  # вместо Length
        "мощность",  # вместо Power
        "фазность",  # вместо Phases
        "коспи",  # вместо cos_phi
        "провод",  # вместо Material
        "изоляция",  # вместо Insulation
        "способ",  # вместо Method
        "температура",  # вместо Temperature
    ]

    ws.append(headers)
    ws.append([101, "Линия", 16, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30])

    wb.save(test_file)
    print(f"  ✓ Создан файл с русскими заголовками")

    try:
        processor = ExcelBatchProcessor()
        results, summary = processor.process_batch(test_file, sheet_name=ws.title)

        if summary.total_processed != 1:
            print(f"  ✗ Файл не обработан")
            return False

        result = results[0]
        if result.status == "ERROR":
            print(f"  ✗ Ошибка при обработке: {result.issues}")
            return False

        print(f"  ✓ Русские заголовки успешно распознаны")
        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def test_batch_processor_select_vs_check():
    """Тест 4: Автоматический выбор режима (select vs check)"""
    print("\n=== Тест 4: Автоматический выбор режима ===")

    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_modes.xlsx")

    rows = [
        [1, "Подбор сечения", None, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
        [2, "Проверка сечения", 16, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
        [3, "Подбор с большой мощностью", None, 200, 45, 3, 0.85, "Cu", "XLPE", "C", 30, 1, 1],
    ]

    create_test_excel_file(test_file, rows)
    print(f"  ✓ Создан файл со смешанными режимами")

    try:
        processor = ExcelBatchProcessor()
        results, summary = processor.process_batch(test_file, sheet_name="Data")

        if summary.total_processed != 3:
            print(f"  ✗ Ожидалось 3 результата")
            return False

        # Проверить режимы
        select_count = sum(1 for r in results if "Подбор" in (r.notes or ""))
        check_count = sum(1 for r in results if "Проверка" in (r.notes or ""))

        if select_count != 2:
            print(f"  ✗ Ожидалось 2 режима подбора, найдено {select_count}")
            return False

        if check_count != 1:
            print(f"  ✗ Ожидалось 1 режим проверки, найдено {check_count}")
            return False

        print(f"  ✓ Режим подбора: {select_count} строк")
        print(f"  ✓ Режим проверки: {check_count} строк")
        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def test_batch_result_json_conversion():
    """Тест 5: Преобразование результатов в JSON"""
    print("\n=== Тест 5: Преобразование результатов в JSON ===")

    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_json.xlsx")

    rows = [
        [1, "JSON тест", 16, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1],
    ]

    create_test_excel_file(test_file, rows)

    try:
        processor = ExcelBatchProcessor()
        results, summary = processor.process_batch(test_file, sheet_name="Data")

        if not results:
            print(f"  ✗ Нет результатов")
            return False

        result = results[0]

        # Тест to_dict()
        dict_result = result.to_dict()
        if not isinstance(dict_result, dict):
            print(f"  ✗ to_dict() вернул не dict")
            return False

        print(f"  ✓ to_dict() работает, ключей: {len(dict_result)}")

        # Тест to_json()
        json_result = result.to_json()
        try:
            json.loads(json_result)
            print(f"  ✓ to_json() работает, размер: {len(json_result)} символов")
        except Exception as e:
            print(f"  ✗ JSON ошибка: {e}")
            return False

        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def test_batch_summary_percentages():
    """Тест 6: Проверка расчета процентов в BatchResultSummary"""
    print("\n=== Тест 6: BatchResultSummary percentages ===")

    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, "test_batch_summary.xlsx")

    # Создать 100 строк для проверки процентов
    rows = [
        [i, f"Линия {i}", 16 if i % 2 == 0 else None, 50, 15, 3, 0.85, "Cu", "PVC", "C", 30, 1, 1]
        for i in range(1, 11)
    ]

    create_test_excel_file(test_file, rows)
    print(f"  ✓ Создан файл с 10 строками")

    try:
        processor = ExcelBatchProcessor()
        results, summary = processor.process_batch(test_file, sheet_name="Data")

        print(f"  - Всего: {summary.total_processed}")
        print(f"  - OK: {summary.ok_count} ({summary.ok_percentage:.1f}%)")
        print(f"  - WARNING: {summary.warning_count} ({summary.warning_percentage:.1f}%)")
        print(f"  - ERROR: {summary.error_count} ({summary.error_percentage:.1f}%)")

        # Проверить что проценты складываются в 100%
        total_pct = (
            summary.ok_percentage + summary.warning_percentage + summary.error_percentage
        )

        if abs(total_pct - 100.0) > 0.1:
            print(f"  ✗ Проценты не складываются в 100: {total_pct:.1f}%")
            return False

        print(f"  ✓ Проценты корректны: {total_pct:.1f}%")
        return True

    finally:
        if os.path.exists(test_file):
            os.remove(test_file)


def main():
    """Запустить все тесты"""
    print("=" * 60)
    print("ТЕСТИРОВАНИЕ ФАЗЫ 2")
    print("=" * 60)
    print()

    tests = [
        ("Базовая обработка", test_batch_processor_basic),
        ("Обработка ошибок", test_batch_processor_with_errors),
        ("Гибкие столбцы", test_batch_processor_column_mapping),
        ("Выбор режима", test_batch_processor_select_vs_check),
        ("JSON конверсия", test_batch_result_json_conversion),
        ("Статистика", test_batch_summary_percentages),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Тест '{name}' упал с ошибкой:")
            print(f"  {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))

    # Итоги
    print("\n" + "=" * 60)
    print("ИТОГИ ТЕСТИРОВАНИЯ")
    print("=" * 60)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")

    print()
    print(f"Результат: {passed}/{total} тестов пройдено")

    if passed == total:
        print("\n✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ - Фаза 2 готова к использованию!")
        return 0
    else:
        print(f"\n✗ ОШИБКИ ОБНАРУЖЕНЫ - {total - passed} тест(ов) не пройдено")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
