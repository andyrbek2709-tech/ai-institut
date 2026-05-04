from .models import CableJournalRow, ParseResult
from .pdf_parser import parse_pdf
from .excel_parser import parse_excel
from .word_parser import parse_word

def parse_file(path: str, start_page=None, end_page=None, row_num_start=1) -> "ParseResult":
    ext = path.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return parse_pdf(path, start_page=start_page, end_page=end_page, row_num_start=row_num_start)
    elif ext in ("xlsx", "xls", "xlsm"):
        return parse_excel(path, row_num_start=row_num_start)
    elif ext in ("docx", "doc"):
        return parse_word(path, row_num_start=row_num_start)
    raise ValueError(f"Неподдерживаемый формат: {ext}")
