"""
ValidationEngine - проверка результатов расчета.

Это слой валидации, который:
1. Принимает входные параметры и результаты расчета
2. Сравнивает результаты с требованиями
3. Возвращает список проблем

ВАЖНО: ValidationEngine НЕ ПЕРЕДЕЛАЕТ расчеты!
Он только сравнивает значения, полученные из engine/calc.py
"""
from typing import Dict, List, Tuple
from .calc import CableInput, CableResult


class ValidationEngine:
    """
    Валидация результатов расчета через сравнение.

    Проверяет:
    - Достаточность тока (i_calc <= i_allowable)
    - Падение напряжения (delta_u <= max)
    - Номинал защиты (cb_rating >= i_calc)
    - Токи КЗ (предупреждения)
    """

    @staticmethod
    def validate(inp: CableInput, result: CableResult) -> Dict:
        """
        Полная валидация результата.

        Возвращает dict:
        {
            "status": "OK" | "WARNING" | "ERROR",
            "issues": [список ошибок],
            "warnings": [список предупреждений],
            "checks": {
                "current": {...},
                "voltage": {...},
                "protection": {...},
                "kz": {...}
            }
        }
        """
        issues = []
        warnings = []
        checks = {}

        # Проверка 1: Ток нагрузки vs допустимый
        check_current = ValidationEngine._check_current(inp, result)
        checks["current"] = check_current
        if check_current["status"] == "ERROR":
            issues.extend(check_current["issues"])
        elif check_current["status"] == "WARNING":
            warnings.extend(check_current["warnings"])

        # Проверка 2: Падение напряжения
        check_voltage = ValidationEngine._check_voltage(inp, result)
        checks["voltage"] = check_voltage
        if check_voltage["status"] == "ERROR":
            issues.extend(check_voltage["issues"])
        elif check_voltage["status"] == "WARNING":
            warnings.extend(check_voltage["warnings"])

        # Проверка 3: Защита (АВ, предохранитель)
        check_protection = ValidationEngine._check_protection(inp, result)
        checks["protection"] = check_protection
        if check_protection["status"] == "ERROR":
            issues.extend(check_protection["issues"])
        elif check_protection["status"] == "WARNING":
            warnings.extend(check_protection["warnings"])

        # Проверка 4: КЗ (рекомендации)
        check_kz = ValidationEngine._check_kz(inp, result)
        checks["kz"] = check_kz
        if check_kz["status"] == "WARNING":
            warnings.extend(check_kz["warnings"])

        # Итоговый статус
        if issues:
            status = "ERROR"
        elif warnings:
            status = "WARNING"
        else:
            status = "OK"

        return {
            "status": status,
            "issues": issues,
            "warnings": warnings,
            "checks": checks,
        }

    @staticmethod
    def _check_current(inp: CableInput, result: CableResult) -> Dict:
        """Проверка: расчетный ток <= допустимый ток."""
        status = "OK"
        issues = []
        warnings = []

        # Если движок не рассчитал токи, пропускаем
        if result.i_calc_a <= 0 or result.i_allowable_a <= 0:
            return {"status": "OK", "issues": [], "warnings": []}

        # Основная проверка
        if result.i_calc_a > result.i_allowable_a * 1.05:
            # Превышение > 5% - это ошибка
            status = "ERROR"
            issues.append(
                f"Расчётный ток {result.i_calc_a:.1f}А превышает допустимый "
                f"{result.i_allowable_a:.1f}А"
            )
        elif result.i_calc_a > result.i_allowable_a:
            # Небольшое превышение - предупреждение
            status = "WARNING"
            warnings.append(
                f"Расчётный ток {result.i_calc_a:.1f}А близок к допустимому "
                f"{result.i_allowable_a:.1f}А (запас < 5%)"
            )

        # Проверка на запас
        if status == "OK" and result.i_allowable_a > 0:
            margin_pct = ((result.i_allowable_a - result.i_calc_a) / result.i_calc_a * 100) if result.i_calc_a > 0 else 0
            if margin_pct < 10:
                warnings.append(
                    f"Запас по току мал: {margin_pct:.0f}% "
                    f"(рекомендуется >= 10%)"
                )

        return {
            "status": status,
            "issues": issues,
            "warnings": warnings,
            "i_calc": result.i_calc_a,
            "i_allowable": result.i_allowable_a,
            "margin_pct": margin_pct if status == "OK" else 0,
        }

    @staticmethod
    def _check_voltage(inp: CableInput, result: CableResult) -> Dict:
        """Проверка: падение напряжения <= допустимое."""
        status = "OK"
        issues = []
        warnings = []

        # Если падение напряжения не рассчитано, пропускаем
        if result.delta_u_pct <= 0:
            return {"status": "OK", "issues": [], "warnings": []}

        max_delta = inp.delta_u_pct_max if inp.delta_u_pct_max > 0 else 5.0

        # Основная проверка
        if result.delta_u_pct > max_delta * 1.05:
            # Превышение > 5% - это ошибка
            status = "ERROR"
            issues.append(
                f"ΔU {result.delta_u_pct:.1f}% превышает допустимые "
                f"{max_delta:.1f}%"
            )
        elif result.delta_u_pct > max_delta:
            # Небольшое превышение - предупреждение
            status = "WARNING"
            warnings.append(
                f"ΔU {result.delta_u_pct:.1f}% близка к лимиту "
                f"{max_delta:.1f}% (запас < 5%)"
            )

        # Проверка на избыточное падение (признак неоптимального сечения)
        if status == "OK" and result.delta_u_pct > max_delta * 0.8:
            warnings.append(
                f"Большое падение напряжения ({result.delta_u_pct:.1f}%), "
                f"рассмотрите увеличение сечения"
            )

        return {
            "status": status,
            "issues": issues,
            "warnings": warnings,
            "delta_u_pct": result.delta_u_pct,
            "max_delta_u_pct": max_delta,
        }

    @staticmethod
    def _check_protection(inp: CableInput, result: CableResult) -> Dict:
        """Проверка: номинал защиты >= расчетный ток."""
        status = "OK"
        issues = []
        warnings = []

        # АВ (автоматический выключатель)
        if result.cb_rating_a > 0 and result.i_calc_a > 0:
            if result.cb_rating_a < result.i_calc_a:
                status = "ERROR"
                issues.append(
                    f"Номинал АВ {result.cb_rating_a:.0f}А < расчетного тока "
                    f"{result.i_calc_a:.1f}А"
                )
            elif result.cb_rating_a < result.i_calc_a * 1.25:
                status = "WARNING"
                warnings.append(
                    f"Номинал АВ {result.cb_rating_a:.0f}А близок к расчетному "
                    f"току {result.i_calc_a:.1f}А"
                )

        # Уставка теплового расцепителя
        if result.cb_thermal_a > 0 and result.i_calc_a > 0:
            if result.cb_thermal_a < result.i_calc_a:
                if status != "ERROR":
                    status = "WARNING"
                warnings.append(
                    f"Уставка теплового расцепителя {result.cb_thermal_a:.0f}А "
                    f"< расчетного тока {result.i_calc_a:.1f}А"
                )

        # Предохранитель (если используется)
        if result.fuse_rating_a > 0 and result.i_calc_a > 0:
            if result.fuse_rating_a < result.i_calc_a:
                status = "ERROR"
                issues.append(
                    f"Номинал предохранителя {result.fuse_rating_a:.0f}А "
                    f"< расчетного тока {result.i_calc_a:.1f}А"
                )

        return {
            "status": status,
            "issues": issues,
            "warnings": warnings,
            "cb_rating": result.cb_rating_a,
            "cb_thermal": result.cb_thermal_a,
            "fuse_rating": result.fuse_rating_a,
            "i_calc": result.i_calc_a,
        }

    @staticmethod
    def _check_kz(inp: CableInput, result: CableResult) -> Dict:
        """Проверка КЗ (рекомендации, не ошибки)."""
        warnings = []

        # Ток 1ф КЗ
        if result.i_kz_1ph_a > 0 and result.i_kz_1ph_a < 1000:
            warnings.append(
                f"Низкий ток однофазного КЗ ({result.i_kz_1ph_a:.0f}А) - "
                f"проверить настройки защиты"
            )

        # Ток 3ф КЗ
        if result.i_kz_3ph_a > 0 and result.i_kz_3ph_a < 1500:
            warnings.append(
                f"Низкий ток трёхфазного КЗ ({result.i_kz_3ph_a:.0f}А) - "
                f"могут быть проблемы с защитой"
            )

        return {
            "status": "WARNING" if warnings else "OK",
            "warnings": warnings,
            "i_kz_1ph": result.i_kz_1ph_a,
            "i_kz_3ph": result.i_kz_3ph_a,
        }

    @staticmethod
    def compare_with_standards(inp: CableInput, result: CableResult) -> Dict:
        """
        Дополнительная проверка: соответствие стандартам МЭК.

        Возвращает:
        - Если сечение в стандартной таблице
        - Рекомендации по защите
        """
        from .tables import STANDARD_SECTIONS

        issues = []
        warnings = []

        # Проверка, что сечение в стандартной таблице
        if result.section_mm2 > 0:
            if result.section_mm2 not in STANDARD_SECTIONS:
                warnings.append(
                    f"Сечение {result.section_mm2} мм² не в стандартной таблице МЭК. "
                    f"Ближайшие стандартные: "
                    f"{ValidationEngine._find_nearest_sections(result.section_mm2, 2)}"
                )

        return {
            "status": "WARNING" if warnings else "OK",
            "issues": issues,
            "warnings": warnings,
        }

    @staticmethod
    def _find_nearest_sections(section: float, count: int = 2) -> str:
        """Найти ближайшие стандартные сечения."""
        from .tables import STANDARD_SECTIONS

        sorted_sections = sorted(STANDARD_SECTIONS)
        smaller = [s for s in sorted_sections if s < section]
        larger = [s for s in sorted_sections if s > section]

        result = []
        if smaller:
            result.extend(smaller[-count:])
        if larger:
            result.extend(larger[:count])

        return ", ".join(f"{s} мм²" for s in sorted(set(result)))
