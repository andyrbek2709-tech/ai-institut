"""
PDF-парсер кабельных журналов.
Стратегия:
  1. pdfplumber: попытка извлечь структурированные таблицы (для цифровых PDF).
  2. Если нет текста и доступен pytesseract — OCR (для сканов).
  3. Если pdfplumber вернул 0 строк и есть OPENAI_API_KEY — fallback на Vision.

Поддерживает диапазон страниц start_page/end_page (1-based, включительно)
для пакетной обработки больших журналов с UI-стороны.
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
    if not (_HAS_PIL and _HAS_TESSERACT):
        return ""
    try:
        import pytesseract as _pt
        from PIL import ImageEnhance

        img = page.to_image(resolution=300).original

        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)

        try:
            result = _pt.image_to_string(img, lang=lang, config="--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ВВГПКуАБГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя.,-–—()[] ")
            if result.strip():
                return result
        except Exception:
            pass

        try:
            return _pt.image_to_string(img, lang="rus", config="--psm 3")
        except Exception:
            return _pt.image_to_string(img, lang="eng", config="--psm 3")
    except Exception:
        return ""


def _row_from_cells(cells: List[str], row_num: int) -> Optional[CableJournalRow]:
    filled = [c for c in cells if c and c.strip()]
    if len(filled) < 2:
        return None

    row = CableJournalRow(row_num=row_num, source_line=" | ".join(cells))

    cleaned_cells = [clean_ocr(c) if c else "" for c in cells]

    for cleaned in cleaned_cells:
        if not cleaned:
            continue

        if not row.cable_mark:
            mark = parse_cable_mark(cleaned)
            if mark:
                row.cable_mark = mark
                continue

        if not row.section_str:
            phases, s, zs, raw = parse_section(cleaned)
            if raw and s > 0:
                row.phases = phases
                row.section_mm2 = s
                row.zero_section_mm2 = zs
                row.section_str = raw
                continue

        if row.length_m == 0.0:
            length = parse_length(cleaned)
            if length > 0:
                row.length_m = length
                continue

        voltage = parse_voltage(cleaned)
        if voltage != 0.4 and row.voltage_kv == 0.4:
            row.voltage_kv = voltage
            continue

    if not row.cable_id:
        for cell in cells:
            if cell and cell.strip():
                potential_id = cell.strip()[:50]
                if not any(x in potential_id.lower() for x in ['кв', 'мм', 'м ']):
                    row.cable_id = potential_id
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


def parse_pdf(path: str,
              start_page: Optional[int] = None,
              end_page: Optional[int] = None,
              row_num_start: int = 1) -> ParseResult:
    """
    start_page, end_page — 1-based, включительно. None = вся книга.
    row_num_start — стартовая нумерация строк (для UI-склейки батчей).
    """
    result = ParseResult(source_file=os.path.basename(path))
    row_num = row_num_start

    try:
        with pdfplumber.open(path) as pdf:
            result.total_pages = len(pdf.pages)
            sp = max(1, int(start_page or 1))
            ep = min(result.total_pages, int(end_page or result.total_pages))
            for page_idx in range(sp - 1, ep):
                page = pdf.pages[page_idx]
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
                            "Стр." + str(page_idx + 1) + ": текстового слоя нет, tesseract недоступен"
                        )
                        continue
                    txt = _ocr_page(page)
                    if not txt.strip():
                        result.warnings.append("Стр." + str(page_idx + 1) + ": OCR вернул пустой результат")
                        continue
                    new_rows = _parse_text_lines(txt, row_num)
                    result.rows.extend(new_rows)
                    row_num += len(new_rows)
    except Exception as e:
        result.warnings.append("pdfplumber failed: " + str(e))

    result.parsed_count = len(result.rows)

    # Vision fallback: если pdfplumber+tesseract вернули 0 строк, а есть OPENAI_API_KEY
    if result.parsed_count == 0 and os.environ.get("OPENAI_API_KEY", "").strip():
        try:
            from .pdf_vision_parser import parse_pdf_via_vision
            result.warnings.append(
                "pdfplumber+tesseract не извлекли строки -> fallback на OpenAI Vision"
            )
            vision_result = parse_pdf_via_vision(
                path,
                start_page=start_page,
                end_page=end_page,
                row_num_start=row_num_start,
            )
            if vision_result is not None:
                old_warnings = list(result.warnings)
                result = vision_result
                result.warnings = old_warnings + list(vision_result.warnings)
        except Exception as e:
            result.warnings.append("Vision fallback не сработал: " + str(e))

    return result
