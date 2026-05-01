"""
Vision-based PDF parser для кабельных журналов AutoCAD/PScript-экспорта.
Использует OpenAI Vision (gpt-4o-mini) с json_schema strict.
"""
import base64
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple

from .models import CableJournalRow, ParseResult
from .utils import parse_section

OPENAI_API_BASE = "https://api.openai.com/v1"
DEFAULT_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini")

MAX_VISION_PAGES = int(os.environ.get("MAX_VISION_PAGES", "2"))
VISION_DPI = int(os.environ.get("VISION_DPI", "110"))
VISION_MAX_WORKERS = int(os.environ.get("VISION_MAX_WORKERS", "3"))
VISION_TIMEOUT_S = int(os.environ.get("VISION_TIMEOUT_S", "25"))

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
    "Колонки: обозначение кабеля, трасса (начало - конец), марка, "
    "количество и сечение жил, длина (м). "
    "Распознавай: ВВГнг, АВВГ, КВВГ, КГ, N2XSEY, N2XV, NYY, NYM и т.п. "
    "Сечения 3x70, 4x95+1x50 — записывай как есть. "
    "Если страница не таблица — верни пустой массив lines."
)


def _has_openai_key() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def _render_pages_to_png(path: str, dpi: int, max_pages: int) -> List[bytes]:
    import fitz
    pages = []
    with fitz.open(path) as pdf:
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        n = min(len(pdf), max_pages)
        for i in range(n):
            pix = pdf[i].get_pixmap(matrix=mat, alpha=False)
            pages.append(pix.tobytes("png"))
    return pages


def _post_openai_vision(png_bytes: bytes, model: str, timeout: int) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    b64 = base64.b64encode(png_bytes).decode("ascii")
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT_RU},
                {"type": "image_url", "image_url": {
                    "url": "data:image/png;base64," + b64,
                    "detail": "high",
                }},
            ],
        }],
        "response_format": {"type": "json_schema", "json_schema": CABLE_JOURNAL_SCHEMA},
        "temperature": 0,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_API_BASE + "/chat/completions",
        data=data,
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError("OpenAI HTTP " + str(e.code) + ": " + err_body)
    except Exception as e:
        raise RuntimeError("OpenAI request failed: " + str(e))


def _row_from_vision(item: dict, row_num: int) -> Optional[CableJournalRow]:
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

    row.source_line = "vision: " + line_id + " | " + cable_brand + " " + section_str
    return row


def _process_page(page_idx: int, png: bytes, model: str, timeout: int) -> Tuple[int, List[dict], Optional[str]]:
    try:
        response = _post_openai_vision(png, model=model, timeout=timeout)
        content = response["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        lines = parsed.get("lines", []) or []
        return page_idx, lines, None
    except Exception as e:
        return page_idx, [], str(e)


def parse_pdf_via_vision(path: str, model: str = None) -> ParseResult:
    if not _has_openai_key():
        raise RuntimeError("OPENAI_API_KEY не задан")

    try:
        import fitz  # noqa: F401
    except ImportError:
        raise RuntimeError("PyMuPDF не установлен")

    model = model or DEFAULT_MODEL
    result = ParseResult(source_file=os.path.basename(path))

    import fitz as _fitz
    with _fitz.open(path) as pdf_obj:
        result.total_pages = len(pdf_obj)

    pages_to_process = min(result.total_pages, MAX_VISION_PAGES)
    if pages_to_process < result.total_pages:
        result.warnings.append(
            "Vision: обработано первых " + str(pages_to_process) + " из " +
            str(result.total_pages) + " стр. (лимит MAX_VISION_PAGES=" +
            str(MAX_VISION_PAGES) + ")"
        )

    page_pngs = _render_pages_to_png(path, dpi=VISION_DPI, max_pages=pages_to_process)

    page_results = []
    workers = max(1, min(VISION_MAX_WORKERS, len(page_pngs)))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(_process_page, i, png, model, VISION_TIMEOUT_S): i for i, png in enumerate(page_pngs)}
        for fut in as_completed(futures):
            page_results.append(fut.result())

    page_results.sort(key=lambda x: x[0])

    row_num = 1
    for page_idx, lines, err in page_results:
        if err:
            result.warnings.append("Стр." + str(page_idx + 1) + ": Vision API error: " + err)
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
            result.warnings.append("Стр." + str(page_idx + 1) + ": Vision вернул 0 строк")

    result.parsed_count = len(result.rows)
    return result
