"""
Vercel Python serverless function — расчёт кабелей 1кВ.

POST /api/cable-calc/calc
JSON body: {
  "mode": "select" | "check" | "max_load",
  "phases": 1 | 3,
  "power_kw": float,
  "cos_phi": float,
  "length_m": float,
  "material": "Cu" | "Al",
  "insulation": "PVC" | "XLPE",
  "method": "A1"|"A2"|"B1"|"B2"|"C"|"D1"|"D2"|"E"|"F"|"G",
  "cables_nearby": int,
  "cable_count": int,
  "ambient_temp_c": float,
  "soil_resistivity": float,
  "section_mm2": float | null,
  "delta_u_pct_max": float,
  "start_current_ratio": float,
  "u_nom_v": float,
  "z_t_mohm": float
}
"""
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler

# Подключаем engine из соседней папки
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import (  # noqa: E402
    select_section,
    check_section,
    calc_max_load,
    CableInput,
    SourceParams,
)


def _to_input(payload: dict) -> CableInput:
    src = SourceParams(
        source_type=payload.get("source_type", "transformer"),
        z_t_mohm=float(payload.get("z_t_mohm", 54.0)),
        r_t_mohm=float(payload.get("r_t_mohm", 16.8)),
        x_t_mohm=float(payload.get("x_t_mohm", 51.32)),
        u_nom_v=float(payload.get("u_nom_v", 380.0)),
        s_nom_kva=float(payload.get("s_nom_kva", 3000.0)),
    )
    section = payload.get("section_mm2")
    if section in ("", None):
        section_val = None
    else:
        section_val = float(section)
    return CableInput(
        line_id=str(payload.get("line_id", "")),
        line_name=str(payload.get("line_name", "")),
        phases=int(payload.get("phases", 3)),
        power_kw=float(payload["power_kw"]) if payload.get("power_kw") not in (None, "") else None,
        cos_phi=float(payload.get("cos_phi", 0.85)),
        start_current_ratio=float(payload.get("start_current_ratio", 1.0)),
        length_m=float(payload.get("length_m", 50.0)),
        delta_u_pct_max=float(payload.get("delta_u_pct_max", 5.0)),
        material=str(payload.get("material", "Cu")),
        insulation=str(payload.get("insulation", "PVC")),
        method=str(payload.get("method", "C")),
        cables_nearby=int(payload.get("cables_nearby", 1)),
        cable_count=int(payload.get("cable_count", 1)),
        section_mm2=section_val,
        ambient_temp_c=float(payload.get("ambient_temp_c", 30.0)),
        soil_resistivity=float(payload.get("soil_resistivity", 2.5)),
        k_safety=float(payload.get("k_safety", 1.0)),
        source=src,
    )


def _result_to_dict(r) -> dict:
    return {
        "line_id": r.line_id,
        "line_name": r.line_name,
        "i_calc_a": round(r.i_calc_a, 2),
        "i_allowable_a": round(r.i_allowable_a, 2),
        "i_kz_1ph_a": round(r.i_kz_1ph_a, 1),
        "i_kz_3ph_a": round(r.i_kz_3ph_a, 1),
        "section_mm2": r.section_mm2,
        "section_zero_mm2": r.section_zero_mm2,
        "delta_u_pct": round(r.delta_u_pct, 3),
        "cb_rating_a": r.cb_rating_a,
        "cb_thermal_a": r.cb_thermal_a,
        "cb_mag_a": r.cb_mag_a,
        "fuse_rating_a": r.fuse_rating_a,
        "k_temp": round(r.k_temp, 3),
        "k_group": round(r.k_group, 3),
        "k_soil": round(r.k_soil, 3),
        "check_current": r.check_current,
        "check_voltage": r.check_voltage,
        "check_kz": r.check_kz,
        "status": r.status,
        "hints": list(r.hints),
        "methodology": r.methodology,
    }


def _calculate(payload: dict) -> dict:
    mode = payload.get("mode", "select")
    inp = _to_input(payload)
    if mode == "check":
        if inp.section_mm2 is None:
            raise ValueError("section_mm2 обязателен для режима 'check'")
        return _result_to_dict(check_section(inp))
    if mode == "max_load":
        if inp.section_mm2 is None:
            raise ValueError("section_mm2 обязателен для режима 'max_load'")
        return _result_to_dict(calc_max_load(inp))
    return _result_to_dict(select_section(inp))


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        # Health-check
        self._send_json(200, {
            "ok": True,
            "service": "cable-calc",
            "version": "1.0",
            "modes": ["select", "check", "max_load"],
        })

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            payload = json.loads(raw.decode("utf-8") or "{}")
            result = _calculate(payload)
            self._send_json(200, result)
        except ValueError as e:
            self._send_json(400, {"error": str(e)})
        except Exception as e:
            self._send_json(500, {
                "error": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc().splitlines()[-5:],
            })
