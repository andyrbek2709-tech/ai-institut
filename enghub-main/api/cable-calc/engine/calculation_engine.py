"""
CalculationEngine - обертка над расчетным движком engine/calc.py

Это "черный ящик", который просто делегирует вызовы к существующим функциям
select_section(), check_section(), calc_max_load().

Формулы НЕ менять, только передавать параметры и получать результаты.
"""
from typing import Optional
from .calc import (
    select_section,
    check_section,
    calc_max_load,
    CableInput,
    CableResult,
)


class CalculationEngine:
    """
    Оборочка над расчетным движком.

    Используется для:
    - Унификации вызовов
    - Добавления логирования (опционально)
    - Будущих расширений без изменения основного кода

    ВАЖНО: Формулы расчета находятся в engine/calc.py и НЕ МЕНЯЮТСЯ здесь!
    """

    @staticmethod
    def select_section(inp: CableInput) -> CableResult:
        """
        Режим 1: Подбор сечения по расчётному току.

        Входы:
        - Мощность (кВт)
        - Длина (м)
        - Материал (Cu/Al)
        - Способ прокладки (A1..G)
        - Условия (температура, кол-во кабелей, и т.д.)

        Выход:
        - Подходящее сечение
        - Допустимый ток
        - Падение напряжения
        - Защита (АВ, предохранитель)

        Делегация: engine.calc.select_section(inp)
        """
        return select_section(inp)

    @staticmethod
    def check_section(inp: CableInput) -> CableResult:
        """
        Режим 2: Проверка заданного сечения.

        Входы:
        - Сечение (мм²)
        - Все прочие параметры

        Выход:
        - Допустимый ток
        - Падение напряжения
        - Статус проверок

        Делегация: engine.calc.check_section(inp)
        """
        return check_section(inp)

    @staticmethod
    def calc_max_load(inp: CableInput) -> CableResult:
        """
        Режим 3: Расчет максимальной нагрузки по сечению.

        Входы:
        - Сечение (мм²)
        - Материал, способ прокладки
        - Условия

        Выход:
        - Максимальный допустимый ток
        - Максимальная нагрузка (кВт)
        - Защита

        Делегация: engine.calc.calc_max_load(inp)
        """
        return calc_max_load(inp)

    @staticmethod
    def validate_input(inp: CableInput) -> Optional[str]:
        """
        Предварительная валидация входных параметров.
        Проверяет только формальные ошибки, не расчеты.

        Возвращает: сообщение об ошибке или None если OK
        """
        if inp.phases not in (1, 3):
            return "phases должна быть 1 или 3"

        if inp.material not in ("Cu", "Al"):
            return "material должен быть Cu или Al"

        if inp.insulation not in ("PVC", "XLPE"):
            return "insulation должна быть PVC или XLPE"

        if inp.method not in (
            "A1", "A2", "B1", "B2", "C", "D1", "D2", "E", "F", "G"
        ):
            return f"method '{inp.method}' не поддерживается"

        if inp.length_m <= 0:
            return "length_m должна быть > 0"

        if inp.ambient_temp_c < -40 or inp.ambient_temp_c > 70:
            return "ambient_temp_c вне разумных пределов"

        # Для select_section требуется power_kw
        if inp.power_kw is not None and inp.power_kw <= 0:
            return "power_kw должна быть > 0"

        # Для check_section требуется section_mm2
        if inp.section_mm2 is not None and inp.section_mm2 <= 0:
            return "section_mm2 должна быть > 0"

        return None
