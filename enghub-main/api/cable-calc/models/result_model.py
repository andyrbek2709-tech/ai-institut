"""
Единый формат результата для всех режимов расчета.
Используется в SINGLE, BATCH и REVERSE режимах.
"""
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Optional
from datetime import datetime
import json


@dataclass
class ResultModel:
    """
    Единый формат результата расчета.

    Содержит:
    - Входные параметры
    - Расчетные результаты
    - Оригинальные данные (если из Excel)
    - Статус и список проблем
    """
    id: str  # Уникальный ID (C001, R123, etc)
    mode: str  # "SINGLE" | "BATCH" | "REVERSE"
    timestamp: str  # ISO format: 2026-05-04T12:34:56.789Z

    # Входные данные (CableInput.__dict__)
    input: Dict = field(default_factory=dict)

    # Выходные данные от движка (CableResult.__dict__)
    calculated: Dict = field(default_factory=dict)

    # Оригинальные данные из источника (Excel, журнал, и т.д.)
    original: Dict = field(default_factory=dict)

    # Статус и проблемы
    status: str = "OK"  # "OK" | "WARNING" | "ERROR"
    issues: List[str] = field(default_factory=list)  # Ошибки
    warnings: List[str] = field(default_factory=list)  # Предупреждения

    # Метаинформация
    calculation_time_ms: float = 0.0
    engine_version: str = "1.0"
    notes: str = ""

    @classmethod
    def from_calc_result(
        cls,
        result_id: str,
        mode: str,
        calc_input: Dict,
        calc_result: Dict,
        validation: Dict,
        original_data: Optional[Dict] = None,
        calc_time_ms: float = 0.0,
    ) -> "ResultModel":
        """Фабрика для создания ResultModel из результатов расчета."""
        return cls(
            id=result_id,
            mode=mode,
            timestamp=datetime.now().isoformat(),
            input=calc_input,
            calculated=calc_result,
            original=original_data or {},
            status=validation.get("status", "UNKNOWN"),
            issues=validation.get("issues", []),
            warnings=validation.get("warnings", []),
            calculation_time_ms=calc_time_ms,
        )

    def to_dict(self) -> Dict:
        """Преобразование в словарь."""
        return asdict(self)

    def to_json(self, indent: Optional[int] = 2) -> str:
        """Преобразование в JSON."""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @property
    def is_ok(self) -> bool:
        """True если статус OK."""
        return self.status == "OK"

    @property
    def has_issues(self) -> bool:
        """True если есть ошибки."""
        return len(self.issues) > 0

    @property
    def has_warnings(self) -> bool:
        """True если есть предупреждения."""
        return len(self.warnings) > 0


@dataclass
class BatchResultSummary:
    """Итоговая статистика для пакетной обработки."""
    total_processed: int = 0
    ok_count: int = 0
    warning_count: int = 0
    error_count: int = 0
    total_time_ms: float = 0.0

    @property
    def ok_percentage(self) -> float:
        """Процент OK результатов."""
        if self.total_processed == 0:
            return 0.0
        return (self.ok_count / self.total_processed) * 100

    @property
    def warning_percentage(self) -> float:
        """Процент WARNING результатов."""
        if self.total_processed == 0:
            return 0.0
        return (self.warning_count / self.total_processed) * 100

    @property
    def error_percentage(self) -> float:
        """Процент ERROR результатов."""
        if self.total_processed == 0:
            return 0.0
        return (self.error_count / self.total_processed) * 100

    def to_dict(self) -> Dict:
        """Преобразование в словарь."""
        return asdict(self)
