import base64
import io
import json
import re
from typing import Dict, List


def _extract_text(data: bytes) -> str:
    # Prefer PyMuPDF, fallback to pdfplumber if available.
    try:
        import fitz  # type: ignore

        doc = fitz.open(stream=data, filetype="pdf")
        chunks: List[str] = []
        for page in doc:
            chunks.append(page.get_text("text") or "")
        return "\n".join(chunks)
    except Exception:
        pass

    try:
        import pdfplumber  # type: ignore

        chunks = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        return "\n".join(chunks)
    except Exception:
        return ""


def _parse_catalog(text: str) -> List[Dict]:
    # Heuristic parser: section -> group -> item(code,name,unit,standard)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    code_re = re.compile(r"(?P<code>\d{3}-\d{3}-\d{4})\s+(?P<name>.+)")
    unit_re = re.compile(r"\b(шт|м|м2|м3|кг|компл|л|пм|упак)\b", re.IGNORECASE)
    std_re = re.compile(r"\b(ГОСТ|ТУ|СТО|СП)\b[^\n]*", re.IGNORECASE)

    sections: List[Dict] = []
    cur_section = {"name": "Общий раздел", "groups": []}
    cur_group = {"name": "Без группы", "items": []}
    cur_section["groups"].append(cur_group)
    sections.append(cur_section)

    for ln in lines:
        if re.match(r"^(РАЗДЕЛ|SECTION)\b", ln, re.IGNORECASE):
            cur_section = {"name": ln, "groups": []}
            cur_group = {"name": "Без группы", "items": []}
            cur_section["groups"].append(cur_group)
            sections.append(cur_section)
            continue
        if re.match(r"^(ГРУППА|GROUP)\b", ln, re.IGNORECASE):
            cur_group = {"name": ln, "items": []}
            cur_section["groups"].append(cur_group)
            continue

        m = code_re.search(ln)
        if not m:
            continue

        code = m.group("code")
        name = m.group("name").strip()
        unit_match = unit_re.search(ln)
        std_match = std_re.search(ln)
        cur_group["items"].append(
            {
                "code": code,
                "name": name,
                "unit": unit_match.group(0) if unit_match else "",
                "standard": std_match.group(0) if std_match else "",
            }
        )

    # Remove empty groups/sections
    cleaned_sections: List[Dict] = []
    for s in sections:
        groups = []
        for g in s["groups"]:
            if g["items"]:
                groups.append(g)
        if groups:
            cleaned_sections.append({"name": s["name"], "groups": groups})

    return cleaned_sections


def handler(request, response):
    if request.method == "OPTIONS":
        response.status_code = 200
        return response.send("")
    if request.method != "POST":
        response.status_code = 405
        return response.send(json.dumps({"error": "Method Not Allowed"}))

    try:
        body = request.get_json() or {}
        file_base64 = body.get("file_base64")
        if not file_base64:
            response.status_code = 400
            return response.send(json.dumps({"error": "file_base64 required"}))

        raw = base64.b64decode(file_base64)
        text = _extract_text(raw)
        if not text.strip():
            response.status_code = 200
            return response.send(json.dumps({"sections": [], "warning": "Не удалось извлечь текст из PDF"}))

        sections = _parse_catalog(text)
        response.status_code = 200
        return response.send(json.dumps({"sections": sections}))
    except Exception as ex:
        response.status_code = 500
        return response.send(json.dumps({"error": str(ex)}))
