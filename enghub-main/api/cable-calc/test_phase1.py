#!/usr/bin/env python3
"""
Тестирование Фазы 1: CalculationEngine, ValidationEngine, ResultModel

Это быстрый тест, чтобы убедиться, что:
1. Модули импортируются без ошибок
2. CalculationEngine корректно вызывает engine/calc.py
3. ValidationEngine корректно проверяет результаты
4. ResultModel правильно форматирует результаты
"""
import sys
import os
import time
import json

# Добавить текущую папку в path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import (
    CalculationEngine,
    ValidationEngine,
    CableInput,
    SourceParams,
)
from models import ResultModel, BatchResultSummary


def test_imports():
    """Тест 1: Импорты работают"""
    print("✓ Импорты успешны")
    print(f"  - CalculationEngine: {CalculationEngine}")
    print(f"  - ValidationEngine: {ValidationEngine}")
    print(f"  - ResultModel: {ResultModel}")
    return True


def test_calculation_engine():
    """Тест 2: CalculationEngine корректно вызывает calc.py"""
    print("\n=== Тест CalculationEngine ===")

    # Создать входные параметры
    src = SourceParams()
    inp = CableInput(
        line_id="TEST_001",
        line_name="Тестовая линия",
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        cables_nearby=1,
        cable_count=1,
        ambient_temp_c=30.0,
        source=src,
    )

    # Валидировать входные параметры
    validation_error = CalculationEngine.validate_input(inp)
    if validation_error:
        print(f"✗ Ошибка валидации: {validation_error}")
        return False

    print("✓ Входные параметры валидны")

    # Тест 1: select_section (подбор сечения)
    print("\n  Режим 1: select_section (подбор по мощности)...")
    t0 = time.time()
    result1 = CalculationEngine.select_section(inp)
    t1 = time.time()

    print(f"  ✓ Подобрано сечение: {result1.section_mm2} мм²")
    print(
        f"  - Допустимый ток: {result1.i_allowable_a:.1f} А"
    )
    print(f"  - Падение напряжения: {result1.delta_u_pct:.2f}%")
    print(f"  - Время расчета: {(t1 - t0) * 1000:.1f} мс")

    # Тест 2: check_section (проверка заданного сечения)
    print("\n  Режим 2: check_section (проверка сечения)...")
    inp.section_mm2 = 16.0
    t0 = time.time()
    result2 = CalculationEngine.check_section(inp)
    t1 = time.time()

    print(f"  ✓ Проверено сечение: {result2.section_mm2} мм²")
    print(f"  - Допустимый ток: {result2.i_allowable_a:.1f} А")
    print(
        f"  - Расчетный ток: {result2.i_calc_a:.1f} А"
    )
    print(f"  - Статус: {result2.status}")
    print(f"  - Время расчета: {(t1 - t0) * 1000:.1f} мс")

    # Тест 3: calc_max_load (макс нагрузка)
    print("\n  Режим 3: calc_max_load (макс нагрузка)...")
    t0 = time.time()
    result3 = CalculationEngine.calc_max_load(inp)
    t1 = time.time()

    print(f"  ✓ Расчет завершен")
    print(
        f"  - Макс допустимый ток: {result3.i_allowable_a:.1f} А"
    )
    print(f"  - АВ номинал: {result3.cb_rating_a:.0f} А")
    print(f"  - Время расчета: {(t1 - t0) * 1000:.1f} мс")

    return True


def test_validation_engine():
    """Тест 3: ValidationEngine корректно проверяет результаты"""
    print("\n=== Тест ValidationEngine ===")

    # Подготовить тестовые данные
    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=15.0,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        delta_u_pct_max=5.0,
        ambient_temp_c=30.0,
        source=src,
    )

    # Сделать расчет
    result = CalculationEngine.check_section(inp)

    # Валидировать результат
    print("  Валидация результатов...")
    validation = ValidationEngine.validate(inp, result)

    print(f"  ✓ Статус: {validation['status']}")
    print(f"  - Ошибок: {len(validation['issues'])}")
    print(f"  - Предупреждений: {len(validation['warnings'])}")

    if validation["issues"]:
        print("  Ошибки:")
        for issue in validation["issues"]:
            print(f"    • {issue}")

    if validation["warnings"]:
        print("  Предупреждения:")
        for warning in validation["warnings"]:
            print(f"    • {warning}")

    # Проверить структуру
    expected_checks = ["current", "voltage", "protection", "kz"]
    for check in expected_checks:
        if check in validation["checks"]:
            print(f"  ✓ Проверка '{check}' выполнена")
        else:
            print(f"  ✗ Проверка '{check}' отсутствует!")
            return False

    return True


def test_result_model():
    """Тест 4: ResultModel правильно форматирует результаты"""
    print("\n=== Тест ResultModel ===")

    # Подготовить данные
    src = SourceParams()
    inp = CableInput(
        line_id="C001",
        phases=3,
        power_kw=15.0,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        source=src,
    )

    result = CalculationEngine.check_section(inp)
    validation = ValidationEngine.validate(inp, result)

    # Создать ResultModel
    print("  Создание ResultModel...")
    t0 = time.time()
    model = ResultModel.from_calc_result(
        result_id="R001",
        mode="SINGLE",
        calc_input=inp.__dict__,
        calc_result=result.__dict__,
        validation=validation,
        original_data={"source": "manual_input"},
        calc_time_ms=(time.time() - t0) * 1000,
    )
    print("  ✓ ResultModel создан")

    # Проверить поля
    print(f"  - ID: {model.id}")
    print(f"  - Mode: {model.mode}")
    print(f"  - Status: {model.status}")
    print(f"  - Timestamp: {model.timestamp[:19]}")
    print(f"  - Calc time: {model.calculation_time_ms:.1f} мс")

    # Тест to_dict
    dict_result = model.to_dict()
    print(f"  ✓ to_dict() работает, ключей: {len(dict_result)}")

    # Тест to_json
    json_result = model.to_json()
    try:
        json.loads(json_result)
        print(f"  ✓ to_json() работает, размер: {len(json_result)} символов")
    except Exception as e:
        print(f"  ✗ JSON ошибка: {e}")
        return False

    # Тест свойств
    print(f"  ✓ is_ok: {model.is_ok}")
    print(f"  ✓ has_issues: {model.has_issues}")
    print(f"  ✓ has_warnings: {model.has_warnings}")

    return True


def test_batch_summary():
    """Тест 5: BatchResultSummary работает"""
    print("\n=== Тест BatchResultSummary ===")

    summary = BatchResultSummary(
        total_processed=100,
        ok_count=80,
        warning_count=15,
        error_count=5,
        total_time_ms=2500.0,
    )

    print(f"  ✓ Обработано: {summary.total_processed}")
    print(f"  - OK: {summary.ok_count} ({summary.ok_percentage:.1f}%)")
    print(f"  - WARNING: {summary.warning_count} ({summary.warning_percentage:.1f}%)")
    print(f"  - ERROR: {summary.error_count} ({summary.error_percentage:.1f}%)")
    print(f"  - Общее время: {summary.total_time_ms:.0f} мс")

    return True


def main():
    """Запустить все тесты"""
    print("=" * 60)
    print("ТЕСТИРОВАНИЕ ФАЗЫ 1")
    print("=" * 60)
    print()

    tests = [
        ("Импорты", test_imports),
        ("CalculationEngine", test_calculation_engine),
        ("ValidationEngine", test_validation_engine),
        ("ResultModel", test_result_model),
        ("BatchResultSummary", test_batch_summary),
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
        print("\n✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ - Фаза 1 готова к использованию!")
        return 0
    else:
        print(f"\n✗ ОШИБКИ ОБНАРУЖЕНЫ - {total - passed} тест(ов) не пройдено")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
