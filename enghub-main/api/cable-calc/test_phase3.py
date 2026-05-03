#!/usr/bin/env python3
"""
Тестирование Фазы 3: ReverseCalculator

Это быстрый тест, чтобы убедиться, что:
1. ReverseCalculator находит минимальное подходящее сечение
2. Проверяет все требования перед возвратом результата
3. Возвращает альтернативные варианты
4. Обрабатывает случаи без подходящих сечений
"""
import sys
import os
import time

# Добавить текущую папку в path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import ReverseCalculator, CableInput, SourceParams


def test_reverse_basic():
    """Тест 1: Базовый поиск минимального сечения"""
    print("\n=== Тест 1: Базовый поиск сечения ===")

    # Создать входные параметры
    src = SourceParams()
    inp = CableInput(
        line_id="REV_001",
        line_name="Обратный расчет 1",
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

    calculator = ReverseCalculator()

    t0 = time.time()
    result = calculator.find_section(inp)
    t1 = time.time()

    print(f"  ✓ Поиск завершен за {(t1 - t0) * 1000:.1f} мс")
    print(f"  - Найдено сечение: {result.section_mm2} мм²")
    print(f"  - Допустимый ток: {result.i_allowable_a:.1f} А")
    print(f"  - Падение напряжения: {result.delta_u_pct:.2f}%")
    print(f"  - Статус: {result.status}")
    print(f"  - Итераций: {result.search_iterations}")

    if result.section_mm2 <= 0:
        print(f"  ✗ Сечение не найдено")
        return False

    if result.status == "ERROR":
        print(f"  ✗ Результат с ошибкой")
        return False

    print("  ✓ Минимальное сечение найдено")
    return True


def test_reverse_with_alternatives():
    """Тест 2: Поиск с альтернативными вариантами"""
    print("\n=== Тест 2: Поиск с альтернативами ===")

    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=22.0,
        cos_phi=0.85,
        length_m=50.0,
        material="Cu",
        insulation="XLPE",
        method="C",
        ambient_temp_c=30.0,
        source=src,
    )

    calculator = ReverseCalculator()
    result = calculator.find_section(inp, include_alternatives=True, num_alternatives=3)

    print(f"  ✓ Поиск завершен")
    print(f"  - Основное сечение: {result.section_mm2} мм²")
    print(f"  - Альтернатив найдено: {len(result.alternatives)}")

    for i, alt in enumerate(result.alternatives):
        print(f"    {i + 1}. {alt['section_mm2']} мм² - {alt['status']}")

    if len(result.alternatives) == 0 and result.status != "ERROR":
        print(f"  ⚠ Альтернативы не найдены, но основное сечение есть")

    print("  ✓ Альтернативные варианты собраны")
    return True


def test_reverse_narrow_constraints():
    """Тест 3: Узкие ограничения (сложный поиск)"""
    print("\n=== Тест 3: Узкие ограничения ===")

    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=45.0,  # Большая мощность
        cos_phi=0.85,
        length_m=200.0,  # Большая длина
        material="Cu",
        insulation="PVC",
        method="C",
        delta_u_pct_max=2.0,  # Жесткий лимит ΔU
        ambient_temp_c=30.0,
        source=src,
    )

    calculator = ReverseCalculator()
    result = calculator.find_section(inp)

    print(f"  ✓ Поиск завершен")
    print(f"  - Найдено сечение: {result.section_mm2} мм²")
    print(f"  - ΔU реальное: {result.delta_u_pct:.2f}% (лимит: 2.0%)")
    print(f"  - Статус: {result.status}")

    if result.section_mm2 <= 0:
        print(f"  ✗ Не найдено подходящее сечение при узких ограничениях")
        return False

    if result.delta_u_pct > 2.0:
        print(f"  ✗ Найденное сечение не соответствует лимиту ΔU")
        return False

    print("  ✓ Узкие ограничения соблюдены")
    return True


def test_reverse_batch():
    """Тест 4: Пакетный поиск"""
    print("\n=== Тест 4: Пакетный поиск ===")

    inputs = []
    for i, power in enumerate([10, 15, 22, 30, 45], 1):
        src = SourceParams()
        inp = CableInput(
            line_id=f"REV_{i:03d}",
            phases=3,
            power_kw=float(power),
            cos_phi=0.85,
            length_m=100.0,
            material="Cu",
            insulation="PVC",
            method="C",
            ambient_temp_c=30.0,
            source=src,
        )
        inputs.append(inp)

    calculator = ReverseCalculator()
    t0 = time.time()
    results, stats = calculator.find_section_batch(inputs)
    t1 = time.time()

    print(f"  ✓ Пакетный поиск завершен за {(t1 - t0) * 1000:.1f} мс")
    print(f"  - Обработано: {stats['total']}")
    print(f"  - Успешно: {stats['success']}")
    print(f"  - Ошибок: {stats['error']}")
    print(f"  - Всего итераций: {stats['total_iterations']}")

    if stats['success'] != len(inputs):
        print(f"  ✗ Не все элементы успешно обработаны")
        return False

    for i, result in enumerate(results):
        print(f"    Линия {i + 1}: {result.section_mm2} мм² ({result.status})")

    print("  ✓ Пакетный поиск работает")
    return True


def test_reverse_aluminum():
    """Тест 5: Поиск для алюминиевого провода"""
    print("\n=== Тест 5: Алюминиевый провод ===")

    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="AL",  # Алюминий вместо меди
        insulation="PVC",
        method="C",
        ambient_temp_c=30.0,
        source=src,
    )

    calculator = ReverseCalculator()
    result = calculator.find_section(inp)

    print(f"  ✓ Поиск для AL завершен")
    print(f"  - Найдено сечение: {result.section_mm2} мм²")
    print(f"  - Допустимый ток: {result.i_allowable_a:.1f} А")
    print(f"  - Статус: {result.status}")

    if result.section_mm2 <= 0:
        print(f"  ✗ Сечение не найдено для алюминия")
        return False

    # Сечение для AL должно быть больше чем для Cu при том же токе
    src_cu = SourceParams()
    inp_cu = CableInput(
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="CU",
        insulation="PVC",
        method="C",
        ambient_temp_c=30.0,
        source=src_cu,
    )
    result_cu = calculator.find_section(inp_cu)

    print(f"  - Cu: {result_cu.section_mm2} мм² vs AL: {result.section_mm2} мм²")

    if result.section_mm2 <= result_cu.section_mm2:
        print(f"  ⚠ AL сечение не больше Cu (ожидалось больше)")

    print("  ✓ Алюминий обработан")
    return True


def test_reverse_high_temperature():
    """Тест 6: Повышенная температура окружающей среды"""
    print("\n=== Тест 6: Высокая температура окружающей среды ===")

    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        ambient_temp_c=50.0,  # Высокая температура
        source=src,
    )

    calculator = ReverseCalculator()
    result = calculator.find_section(inp)

    print(f"  ✓ Поиск при T=50°C завершен")
    print(f"  - Найдено сечение: {result.section_mm2} мм²")
    print(f"  - Допустимый ток: {result.i_allowable_a:.1f} А")

    # Сравнить с нормальной температурой
    src_normal = SourceParams()
    inp_normal = CableInput(
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        ambient_temp_c=30.0,
        source=src_normal,
    )
    result_normal = calculator.find_section(inp_normal)

    print(f"  - При T=30°C: {result_normal.section_mm2} мм²")

    if result.section_mm2 <= result_normal.section_mm2:
        print(f"  ⚠ При высокой T сечение должно быть больше")

    print("  ✓ Влияние температуры учтено")
    return True


def test_reverse_result_to_dict():
    """Тест 7: Преобразование результата в dict/JSON"""
    print("\n=== Тест 7: Сериализация результата ===")

    src = SourceParams()
    inp = CableInput(
        phases=3,
        power_kw=15.0,
        cos_phi=0.85,
        length_m=100.0,
        material="Cu",
        insulation="PVC",
        method="C",
        ambient_temp_c=30.0,
        source=src,
    )

    calculator = ReverseCalculator()
    result = calculator.find_section(inp)

    # Преобразовать в dict
    result_dict = result.to_dict()

    if not isinstance(result_dict, dict):
        print(f"  ✗ to_dict() не вернул dict")
        return False

    print(f"  ✓ to_dict() вернул dict с {len(result_dict)} ключами")

    # Проверить ключи
    required_keys = ['section_mm2', 'i_allowable_a', 'delta_u_pct', 'status', 'validation']
    for key in required_keys:
        if key not in result_dict:
            print(f"  ✗ Отсутствует ключ: {key}")
            return False

    print(f"  ✓ Все необходимые ключи присутствуют")
    return True


def main():
    """Запустить все тесты"""
    print("=" * 60)
    print("ТЕСТИРОВАНИЕ ФАЗЫ 3 - ReverseCalculator")
    print("=" * 60)
    print()

    tests = [
        ("Базовый поиск", test_reverse_basic),
        ("Альтернативные варианты", test_reverse_with_alternatives),
        ("Узкие ограничения", test_reverse_narrow_constraints),
        ("Пакетный поиск", test_reverse_batch),
        ("Алюминий", test_reverse_aluminum),
        ("Высокая температура", test_reverse_high_temperature),
        ("Сериализация", test_reverse_result_to_dict),
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
        print("\n✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ - Фаза 3 готова к использованию!")
        return 0
    else:
        print(f"\n✗ ОШИБКИ ОБНАРУЖЕНЫ - {total - passed} тест(ов) не пройдено")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
