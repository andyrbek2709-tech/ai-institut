"""
ReverseCalculator - обратный расчет для поиска минимального подходящего сечения.

Режим работы:
- На входе: нагрузка, ограничения (ΔU_max, I_min, и т.д.)
- Перебор: итерирует по стандартным сечениям
- Проверка: использует ValidationEngine для каждого сечения
- Результат: первое сечение, которое удовлетворяет всем требованиям

Используется "черный ящик" подход:
- Делегирует расчеты к CalculationEngine.check_section()
- Не меняет формулы
- Только сравнивает результаты с требованиями
"""
from typing import List, Optional, Dict, Tuple
from engine import CalculationEngine, ValidationEngine, CableInput, CableResult


# Стандартные сечения по МЭК 60364-5-52
STANDARD_SECTIONS = [
    0.5, 0.75, 1.0, 1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0,
    120.0, 150.0, 185.0, 240.0, 300.0, 400.0, 500.0, 630.0, 800.0, 1000.0
]


class ReverseCalculationResult:
    """Результат обратного расчета."""

    def __init__(
        self,
        section_mm2: float,
        i_allowable_a: float,
        delta_u_pct: float,
        status: str,
        validation: Dict,
        alternatives: List[Dict] = None,
    ):
        """
        Args:
            section_mm2: Найденное сечение (мм²)
            i_allowable_a: Допустимый ток для этого сечения (А)
            delta_u_pct: Падение напряжения (%)
            status: OK/WARNING/ERROR
            validation: Результаты валидации
            alternatives: Список альтернативных сечений
        """
        self.section_mm2 = section_mm2
        self.i_allowable_a = i_allowable_a
        self.delta_u_pct = delta_u_pct
        self.status = status
        self.validation = validation
        self.alternatives = alternatives or []
        self.search_iterations = 0
        self.search_time_ms = 0.0

    def to_dict(self) -> Dict:
        """Преобразовать в словарь."""
        return {
            'section_mm2': self.section_mm2,
            'i_allowable_a': self.i_allowable_a,
            'delta_u_pct': self.delta_u_pct,
            'status': self.status,
            'validation': self.validation,
            'alternatives': self.alternatives,
            'search_iterations': self.search_iterations,
            'search_time_ms': self.search_time_ms,
        }


class ReverseCalculator:
    """Обратный расчет - поиск минимального подходящего сечения."""

    def __init__(self):
        """Инициализация."""
        self.calc_engine = CalculationEngine()
        self.validator = ValidationEngine()

    def find_section(
        self,
        inp: CableInput,
        max_iterations: int = 100,
        include_alternatives: bool = True,
        num_alternatives: int = 3,
    ) -> ReverseCalculationResult:
        """
        Найти минимальное сечение, удовлетворяющее требованиям.

        Алгоритм:
        1. Итерировать через стандартные сечения (от меньшего к большему)
        2. Для каждого сечения: расчет + валидация
        3. Вернуть первое сечение, которое удовлетворяет требованиям
        4. Опционально: собрать альтернативные сечения

        Args:
            inp: CableInput с требуемыми параметрами
            max_iterations: Максимум итераций поиска
            include_alternatives: Собирать ли альтернативные сечения
            num_alternatives: Сколько альтернатив собрать

        Returns:
            ReverseCalculationResult с найденным сечением или ошибкой

        Требуемые параметры в inp:
            - power_kw: Мощность нагрузки (кВ)
            - delta_u_pct_max: Максимальное падение напряжения (%, опционально)
            - Все остальные параметры как в check_section()
        """
        import time
        t0 = time.time()

        # Валидировать входные параметры
        validation_error = CalculationEngine.validate_input(inp)
        if validation_error:
            t1 = time.time()
            return ReverseCalculationResult(
                section_mm2=0.0,
                i_allowable_a=0.0,
                delta_u_pct=0.0,
                status="ERROR",
                validation={
                    'status': 'ERROR',
                    'issues': [f"Ошибка входных данных: {validation_error}"],
                    'warnings': [],
                    'checks': {}
                }
            )

        # Итерировать через стандартные сечения
        suitable_sections = []

        for iteration, section in enumerate(STANDARD_SECTIONS):
            if iteration >= max_iterations:
                break

            # Установить сечение для проверки
            inp.section_mm2 = section

            try:
                # Выполнить расчет
                result = self.calc_engine.check_section(inp)

                # Валидировать результат
                validation = self.validator.validate(inp, result)

                # Проверить требования
                if validation['status'] != 'ERROR':
                    # Это подходящее сечение
                    suitable_sections.append({
                        'section_mm2': section,
                        'i_allowable_a': result.i_allowable_a,
                        'delta_u_pct': result.delta_u_pct,
                        'cb_rating_a': result.cb_rating_a,
                        'status': validation['status'],
                        'validation': validation,
                        'iteration': iteration,
                    })

                    # Если это первое подходящее и нам не нужны альтернативы, можем остановиться
                    if len(suitable_sections) == 1 and not include_alternatives:
                        break

                    # Если собрали достаточно альтернатив, остановиться
                    if len(suitable_sections) >= num_alternatives:
                        break

            except Exception as e:
                # Продолжить поиск при ошибке расчета
                continue

        t1 = time.time()

        # Обработать результаты поиска
        if not suitable_sections:
            return ReverseCalculationResult(
                section_mm2=0.0,
                i_allowable_a=0.0,
                delta_u_pct=0.0,
                status="ERROR",
                validation={
                    'status': 'ERROR',
                    'issues': ["Не найдено подходящее стандартное сечение"],
                    'warnings': [],
                    'checks': {}
                }
            )

        # Первое подходящее сечение
        best = suitable_sections[0]

        result = ReverseCalculationResult(
            section_mm2=best['section_mm2'],
            i_allowable_a=best['i_allowable_a'],
            delta_u_pct=best['delta_u_pct'],
            status=best['status'],
            validation=best['validation'],
            alternatives=[
                {
                    'section_mm2': s['section_mm2'],
                    'i_allowable_a': s['i_allowable_a'],
                    'delta_u_pct': s['delta_u_pct'],
                    'status': s['status'],
                }
                for s in suitable_sections[1:]
            ] if include_alternatives else [],
        )

        result.search_iterations = len(STANDARD_SECTIONS[:iteration + 1])
        result.search_time_ms = (t1 - t0) * 1000

        return result

    def find_section_batch(
        self,
        inputs: List[CableInput],
        **kwargs
    ) -> Tuple[List[ReverseCalculationResult], Dict]:
        """
        Найти сечения для пакета входных параметров.

        Args:
            inputs: Список CableInput
            **kwargs: Параметры для find_section()

        Returns:
            (список результатов, статистика)
        """
        import time

        t0 = time.time()
        results = []
        stats = {
            'total': len(inputs),
            'success': 0,
            'error': 0,
            'total_iterations': 0,
            'total_time_ms': 0.0,
        }

        for inp in inputs:
            result = self.find_section(inp, **kwargs)
            results.append(result)

            if result.status != 'ERROR':
                stats['success'] += 1
            else:
                stats['error'] += 1

            stats['total_iterations'] += result.search_iterations

        t1 = time.time()
        stats['total_time_ms'] = (t1 - t0) * 1000

        return results, stats
