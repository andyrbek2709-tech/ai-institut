"""
PDF-парсер кабельных журналов.
Стратегия:
  1. pdfplumber: попытка извлечь структурированные таблицы (для цифровых PDF)
  2. Если нет текста и доступен pytesseract — OCR (для сканов).
     На Vercel tesseract отсутствует — OCR будет пропущен с warning.
  3. Если pdfplumber+tesseract вернули 0 строк И есть OPENAI_API_KEY —
     fallback на pdf_vision_parser (OpenAI Vision).
"""
import os
import re
from typing import List, Optional

import pdfplumber

try:
    from PIL import Image  # noqa: F401
    _HAS_PIL = True
except Exception:
    _HAS_PIL = False

try:
    import pytesseract  # noqa: F401
    _HAS_TESSERACT = True
except Exception:
    _HAS_TESSERACT = False

from .models import CableJournalRow, ParseResult
from .utils import parse_section, parse_length, parse_cable_mark, parse_voltage, clean_ocr


def _has_text(page) -> bool:
    txt = page.extract_text() or ""
    return len(txt.strip()) > 20


def _ocr_page(page, lang: str = "rus+eng") -> str:
    """OCR одной страницы. Если pytesseract недоступен — возвращает пустую строку."""
    if not (_HAS_PIL and _HAS_TESSERACT):
        return ""
    try:
        import pytesseract as _pt
        img = page.to_image(resolution=200).original  # PIL Image
        try:
            return _pt.image_to_string(img, lang=lang, config="--psm 6")
        except Exception:
            return _pt.image_to_string(img, lang="eng", config="--psm 6")
    except Exception:
        return ""


def _row_from_cells(cells: List[str], row_num: int) -> Optional[CableJournalRow]:
    """Строим CableJournalRow из списка ячеек одной строки таблицы."""
    filled = [c for c in cells if c and c.strip()]
    if len(filled) < 2:
        return None

    row = CableJournalRow(row_num=row_num, source_line=" | ".join(cells))

    for cell in cells:
        if not cell:
            continue
        c = clean_ocr(cell)

        if not row.cable_mark:
            mark = parse_cable_mark(c)
            if mark:
                row.cable_mark = mark

        if not row.section_str:
            phases, s, zs, raw = parse_section(c)
            if raw:
                row.phases = phases
                row.section_mm2 = s
                row.zero_section_mm2 = zs
                row.section_str = raw

        if row.length_m == 0.0:
            length = parse_length(c)
            if length:
                row.length_m = length

        if parse_voltage(c) != 0.4:
            row.voltage_kv = parse_voltage(c)

    for cell in cells:
        if cell and cell.strip():
            row.cable_id = cell.strip()[:40]
            break

    if not row.cable_mark and not row.section_str and row.length_m == 0:
        return None
    return row


def _parse_text_lines(text: str, start_row: int) -> List[CableJournalRow]:
    rows = []
    row_num = start_row
    for line in text.splitlines():
        line = clean_ocr(line)
        if len(line) < 5:
            continue
        cells = re.split(r'\s{2,}|\|', line)
        row = _row_from_cells(cells, row_num)
        if row:
            rows.append(row)
            row_num += 1
    return rows


def parse_pdf(path: str) -> ParseResult:
    result = ParseResult(source_file=os.path.basename(path))
    row_num = 1

    try:
        with pdfplumber.open(path) as pdf:
            result.total_pages = len(pdf.pages)
            for page_idx, page in enumerate(pdf.pages):
                if _has_text(page):
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            for cells in table:
                                cells_str = [str(c or "").strip() for c in cells]
                                row = _row_from_cells(cells_str, row_num)
                                if row:
                                    result.rows.append(row)
                                    row_num += 1
                                else:
                                    result.skipped_count += 1
                    else:
                        txt = page.extract_text() or ""
                        new_rows = _parse_text_lines(txt, row_num)
                        result.rows.extend(new_rows)
                        row_num += len(new_rows)
                else:
                    if not (_HAS_PIL and _HAS_TESSERACT):
                        result.warnings.append(
                            f"Стр.{page_idx + 1}: текстового слоя нет, tesseract недоступен"
                        )
                        continue
                    txt = _ocr_page(page)
                    if not txt.strip():
                        result.warnings.append(f"Стр.{page_idx + 1}: OCR вернул пустой результат")
                        continue
                    new_rows = _parse_text_lines(txt, row_num)
                    result.rows.extend(new_rows)
                    row_num += len(new_rows)
    except Exception as e:
        result.warnings.append(f"pdfplumber failed: {e}")

    result.parsed_count = len(result.rows)

    # Vision fallback: если pdfplumber+tesseract вернули 0 строк, а есть OPENAI_API_KEY,
    # запускаем OpenAI Vision (для AutoCAD-PDF без шрифтов и текстового слоя).
    if result.parsed_count == 0 and os.environ.get("OPENAI_API_KEY", "").strip():
        try:
            from .pdf_vision_parser import parse_pdf_via_vision
            result.warnings.append(
                "pdfplumber+tesseract не извлекли строки -> fallback на OpenAI Vision"
            )
            vision_result = parse_pdf_via_vision(path)
            if vision_result is not None:
                old_warnings = list(result.warnings)
                result = vision_result
                result.warnings = old_warnings + list(vision_result.warnings)
        except Exception as e:
            result.warnings.append(f"Vision fallback не сработал: {e}")

    return result
