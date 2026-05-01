"""
Vision-based PDF parser для кабельных журналов AutoCAD/PScript-экспорта.

Этот парсер используется как fallback когда:
  - pdfplumber не нашёл текстовый слой (PDF — векторная графика, шрифты не embedded);
  - tesseract недоступен или не справился;
  - есть OPENAI_API_KEY в окружении.

Стратегия:
  1. PyMuPDF render каждой страницы в PNG 220 DPI.
  2. Каждая страница base64 → OpenAI chat/completions (gpt-4o) с image_url + json_schema.
  3. Объединение всех строк в ParseResult.

ВАЖНО: response_format=json_schema (strict=true) — гарантирует структуру.
Используем gpt-4o-mini для экономии (рекомендованный default OpenAI cookbook'а).
"""
import base64
import io
import json
import os
import re
import urllib.request
import urllib.error
from typing import List, Optional

from .models import CableJournalRow, ParseResult
from .utils import parse_section, parse_length, parse_cable_mark, parse_voltage

OPENAI_API_BASE = "https://api.openai.com/v1"
DEFAULT_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini")

# JSON schema для структурированного ответа
CABLE_JOURNAL_SCHEMA = {
    "name": "cable_journal",
    "schema": {
        "type": "object",
        "properties": {
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "line_id": {"type": ["string", "null"]},
                        "start_point": {"type": ["string", "null"]},
                        "end_point": {"type": ["string", "null"]},
                        "cable_brand": {"type": ["string", "null"]},
                        "section_str": {"type": ["string", "null"]},
                        "length_m": {"type": ["number", "null"]},
                        "voltage_kv": {"type": ["number", "null"]},
                    },
                    "required": [
                        "line_id", "start_point", "end_point",
                        "cable_brand", "section_str", "length_m", "voltage_kv"
                    ],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["lines"],
        "additionalProperties": False,
    },
    "strict": True,
}

PROMPT_RU = (
    "Это страница кабельного журнала из проекта электроснабжения "
    "(экспорт из AutoCAD). Извлеки ВСЕ строки таблицы. "
    "Колонки таблицы: обозначение кабеля/провода, трасса (начало → конец), "
    "марка кабеля, количество и сечение жил, длина (м). "
    "Захвати все строки, включая продолжения секций. Если ячейка пустая — null. "
    "Распознавай русские/международные обозначения кабелей: ВВГнг, АВВГ, КВВГ, КГ, "
    "N2XSEY, N2XV, ZA-N2XV, ZA-N2XV22, NYY, NYM, ВБбШв и т.п. "
    "Сечения вида 3x70, 4x95+1x50, 2(3x150), 5x10 — записывай как есть в section_str. "
    "Если страница не содержит таблицы кабельного журнала (заглавный лист, штамп, "
    "примечания) — верни пустой массив lines."
)


def _has_openai_key() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def _render_pages_to_png(path: str, dpi: int = 220) -> List[bytes]:
    """PyMuPDF: вернуть список PNG-байтов для каждой страницы."""
    import fitz
    pages = []
    with fitz.open(path) as pdf:
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        for p in pdf:
            pix = p.get_pixmap(matrix=mat, alpha=False)
            pages.append(pix.tobytes("png"))
    return pages


def _post_openai_vision(png_bytes: bytes, model: str, timeout: int = 60) -> dict:
    """Один запрос к chat/completions с одной картинкой и json_schema."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    b64 = base64.b64encode(png_bytes).decode("ascii")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT_RU},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64}",
                            "detail": "high",
                        },
                    },
                ],
            }
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": CABLE_JOURNAL_SCHEMA,
        },
        "temperature": 0,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OPENAI_API_BASE}/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"OpenAI HTTP {e.code}: {err_body}")
    except Exception as e:
        raise RuntimeError(f"OpenAI request failed: {e}")


def _row_from_vision(item: dict, row_num: int) -> Optional[CableJournalRow]:
    """Конвертирует один dict из json_schema-ответа в CableJournalRow."""
    if not item:
        return None
    line_id = (item.get("line_id") or "").strip()
    start_p = (item.get("start_point") or "").strip()
    end_p = (item.get("end_point") or "").strip()
    cable_brand = (item.get("cable_brand") or "").strip()
    section_str = (item.get("section_str") or "").strip()
    length_m = item.get("length_m")
    voltage_kv = item.get("voltage_kv")

    if not (cable_brand or section_str or length_m):
        return None

    row = CableJournalRow(
        row_num=row_num,
        cable_id=line_id[:80] if line_id else "",
        from_point=start_p[:200] if start_p else "",
        to_point=end_p[:200] if end_p else "",
        cable_mark=cable_brand[:60] if cable_brand else "",
        section_str=section_str[:60] if section_str else "",
    )

    # Распарсим сечение в числа через утилиту проекта
    if section_str:
        try:
            phases, s, zs, _raw = parse_section(section_str)
            if s:
                row.phases = phases or 3
                row.section_mm2 = float(s)
                row.zero_section_mm2 = float(zs or 0)
        except Exception:
            pass

    if length_m is not None:
        try:
            row.length_m = float(length_m)
        except (TypeError, ValueError):
            pass

    if voltage_kv is not None:
        try:
            v = float(voltage_kv)
            if 0.05 < v < 35:
                row.voltage_kv = v
        except (TypeError, ValueError):
            pass

    row.source_line = f"vision: {line_id} | {start_p} | {end_p} | {cable_brand} {section_str} L={length_m}"
    return row


def parse_pdf_via_vision(path: str, model: str = None) -> ParseResult:
    """
    Полноценный парсер через OpenAI Vision.

    Поднимает RuntimeError если нет OPENAI_API_KEY или PyMuPDF недоступен.
    """
    if not _has_openai_key():
        raise RuntimeError("OPENAI_API_KEY не задан")

    try:
        import fitz  # noqa: F401
    except ImportError:
        raise RuntimeError("PyMuPDF не установлен")

    model = model or DEFAULT_MODEL
    result = ParseResult(source_file=os.path.basename(path))

    page_pngs = _render_pages_to_png(path, dpi=220)
    result.total_pages = len(page_pngs)

    row_num = 1
    for page_idx, png in enumerate(page_pngs):
        try:
            response = _post_openai_vision(png, model=model, timeout=60)
        except Exception as e:
            result.warnings.append(f"Стр.{page_idx + 1}: Vision API error: {e}")
            continue

        try:
            content = response["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            lines = parsed.get("lines", []) or []
        except Exception as e:
            result.warnings.append(
                f"Стр.{page_idx + 1}: не удалось разобрать ответ Vision: {e}"
            )
            continue

        page_rows = 0
        for item in lines:
            row = _row_from_vision(item, row_num)
            if row:
                result.rows.append(row)
                row_num += 1
                page_rows += 1
            else:
                result.skipped_count += 1
        if page_rows == 0:
            result.warnings.append(
                f"Стр.{page_idx + 1}: Vision вернул 0 строк (возможно, заглавный лист)"
            )

    result.parsed_count = len(result.rows)
    return result
