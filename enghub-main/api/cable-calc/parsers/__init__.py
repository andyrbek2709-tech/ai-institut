from typing import Optional
from .models import CableJournalRow, ParseResult
from .pdf_parser import parse_pdf
from .excel_parser import parse_excel
from .word_parser import parse_word


def parse_file(path: str,
               start_page: Optional[int] = None,
               end_page: Optional[int] = None,
               row_num_start: int = 1) -> "ParseResult":
    """
    Унифицированный вход. Для PDF поддержан диапазон страниц start_page/end_page (1-based).
    Для Excel/Word диапазон игнорируется (целиковая обработка).
    """
    ext = path.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return parse_pdf(path, start_page=start_page, end_page=end_page,
                         row_num_start=row_num_start)
    elif ext in ("xlsx", "xls", "xlsm"):
        return parse_excel(path)
    elif ext in ("docx", "doc"):
        return parse_word(path)
    raise ValueError("Неподдерживаемый формат: " + ext)
