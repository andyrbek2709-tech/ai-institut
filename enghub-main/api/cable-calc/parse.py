"""
Vercel Python serverless function — парсинг кабельных журналов.

POST /api/cable-calc/parse
Content-Type: multipart/form-data
Поля:
  file (required) — Excel/PDF/Word
  material (optional) — Cu | Al   (default Cu)
  insulation (optional) — PVC | XLPE  (default PVC)
  method (optional) — A1..G  (default C)
  ambient_temp_c (optional) — float  (default 30)

Ответ:
{
  "ok": true,
  "source_file": "...",
  "parsed_count": 12,
  "skipped_count": 0,
  "warnings": [...],
  "lines": [
    {
      "row_num": 1,
      "cable_id": "...",
      "cable_name": "...",
      "from_point": "...",
      "to_point": "...",
      "cable_mark": "АВВГнг",
      "section_str": "4x16",
      "section_mm2": 16.0,
      "zero_section_mm2": 0,
      "length_m": 50,
      "i_allowable_a": 84.0,        # для справки
      "status": "OK" | "WARN" | "UNKNOWN",
      "note": "..."
    },
    ...
  ]
}
"""
import json
import os
import re
import sys
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import CableInput, SourceParams  # noqa: E402
from engine.calc import _get_iz0, _get_k_temp, _get_k_group, _get_k_soil  # noqa: E402

from parsers import parse_file  # noqa: E402


def _parse_multipart(body: bytes, content_type: str):
    """Очень простой multipart парсер. Возвращает (fields_dict, filename, file_bytes)."""
    m = re.search(r'boundary=(?:"([^"]+)"|([^;\s]+))', content_type)
    if not m:
        return {}, None, None
    boundary = (m.group(1) or m.group(2)).encode()
    delim = b"--" + boundary
    fields = {}
    filename = None
    file_bytes = None
    parts = body.split(delim)
    for part in parts:
        if not part:
            continue
        part = part.lstrip(b"\r\n")
        if part.startswith(b"--"):
            continue
        if part.endswith(b"\r\n"):
            part = part[:-2]
        sep = part.find(b"\r\n\r\n")
        if sep == -1:
            continue
        headers_blob = part[:sep].decode("utf-8", errors="replace")
        body_blob = part[sep + 4:]
        cd = re.search(r'Content-Disposition:\s*form-data;\s*([^\r\n]+)', headers_blob, re.I)
        if not cd:
            continue
        params = cd.group(1)
        name_m = re.search(r'name="([^"]*)"', params)
        fname_m = re.search(r'filename="([^"]*)"', params)
        if not name_m:
            continue
        name = name_m.group(1)
        if fname_m and fname_m.group(1):
            filename = fname_m.group(1)
            file_bytes = body_blob
        else:
            try:
                fields[name] = body_blob.decode("utf-8", errors="replace").strip()
            except Exception:
                fields[name] = ""
    return fields, filename, file_bytes


def _verify_row(row, defaults: dict) -> dict:
    """Базовая верификация: достаём I_доп для секции/метода/материала и сравниваем с ожидаемым током.
       В кабельном журнале обычно нет мощности — поэтому возвращаем справочно I_доп.
       Статус UNKNOWN если нет данных, OK если строка распознана."""
    note = ""
    status = "UNKNOWN"
    i_allow = 0.0

    if row.section_mm2 and row.section_mm2 > 0:
        try:
            inp = CableInput(
                phases=row.phases or 3,
                length_m=row.length_m or 1.0,
                material=defaults.get("material", "Cu"),
                insulation=defaults.get("insulation", "PVC"),
                method=defaults.get("method", "C"),
                cables_nearby=int(defaults.get("cables_nearby", 1)),
                cable_count=1,
                section_mm2=row.section_mm2,
                ambient_temp_c=float(defaults.get("ambient_temp_c", 30.0)),
                source=SourceParams(),
            )
            iz0 = _get_iz0(inp, row.section_mm2)
            if iz0 is None:
                status = "WARN"
                note = f"Сечение {row.section_mm2} мм² нет в таблицах для метода {inp.method}/{inp.material}/{inp.insulation}"
            else:
                k_t = _get_k_temp(inp)
                k_g = _get_k_group(inp)
                k_s = _get_k_soil(inp)
                i_allow = round(iz0 * k_t * k_g * k_s, 1)
                status = "OK"
                note = f"I_доп = {i_allow} А (с поправками)"
        except Exception as e:
            status = "WARN"
            note = f"Ошибка проверки: {e}"
    else:
        if row.cable_mark:
            status = "WARN"
            note = "Сечение не распознано"
        else:
            status = "WARN"
            note = "Строка не содержит данных кабеля"

    return {"status": status, "i_allowable_a": i_allow, "note": note}


def _row_to_dict(row, verification: dict) -> dict:
    return {
        "row_num": row.row_num,
        "cable_id": row.cable_id,
        "cable_name": row.cable_name,
        "from_point": row.from_point,
        "to_point": row.to_point,
        "cable_mark": row.cable_mark,
        "section_str": row.section_str,
        "section_mm2": row.section_mm2,
        "zero_section_mm2": row.zero_section_mm2,
        "phases": row.phases,
        "length_m": row.length_m,
        "voltage_kv": row.voltage_kv,
        "i_allowable_a": verification["i_allowable_a"],
        "status": verification["status"],
        "note": verification["note"],
    }


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        self._send_json(200, {
            "ok": True,
            "service": "cable-calc/parse",
            "version": "1.0",
            "accepts": ["xlsx", "xlsm", "pdf", "docx"],
        })

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            ct = self.headers.get("Content-Type", "")
            if length <= 0:
                return self._send_json(400, {"error": "Empty body"})
            raw = self.rfile.read(length)
            fields, filename, file_bytes = _parse_multipart(raw, ct)
            if not filename or file_bytes is None:
                return self._send_json(400, {"error": "Файл не найден в multipart"})

            ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
            if ext not in ("xlsx", "xls", "xlsm", "pdf", "docx", "doc"):
                return self._send_json(400, {"error": f"Неподдерживаемый формат: .{ext}"})

            tmp_dir = tempfile.gettempdir()
            tmp_path = os.path.join(tmp_dir, f"cc_upload_{os.getpid()}_{filename}")
            try:
                with open(tmp_path, "wb") as f:
                    f.write(file_bytes)

                pr = parse_file(tmp_path)
            finally:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

            defaults = {
                "material": fields.get("material", "Cu"),
                "insulation": fields.get("insulation", "PVC"),
                "method": fields.get("method", "C"),
                "ambient_temp_c": float(fields.get("ambient_temp_c", "30") or 30),
                "cables_nearby": int(fields.get("cables_nearby", "1") or 1),
            }

            lines = []
            ok_cnt = 0
            warn_cnt = 0
            for row in pr.rows:
                v = _verify_row(row, defaults)
                lines.append(_row_to_dict(row, v))
                if v["status"] == "OK":
                    ok_cnt += 1
                elif v["status"] == "WARN":
                    warn_cnt += 1

            self._send_json(200, {
                "ok": True,
                "source_file": pr.source_file,
                "parsed_count": pr.parsed_count,
                "skipped_count": pr.skipped_count,
                "warnings": list(pr.warnings),
                "ok_count": ok_cnt,
                "warn_count": warn_cnt,
                "defaults": defaults,
                "lines": lines,
            })
        except Exception as e:
            self._send_json(500, {
                "error": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc().splitlines()[-8:],
            })
