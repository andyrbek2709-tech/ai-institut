"""Vercel serverless endpoint for cable calculation (SINGLE and BATCH processing).

POST /api/cable-calc/calc
Content-Type: application/json

Payload:
{
  "mode": "check" | "select" | "max_load",
  "phases": 3,
  "power_kw": 15.0,
  "cos_phi": 0.85,
  "length_m": 100.0,
  "section_mm2": 10.0,      # for check mode
  "material": "Cu",
  "insulation": "XLPE",
  "method": "E",
  "cables_nearby": 1,
  "ambient_temp_c": 30,
  "delta_u_pct_max": 5.0,
  "isc_a": 1000,            # short circuit current
  "isc_time_s": 0.1         # clearing time
}

Response:
{
  "section_mm2": 10.0,
  "i_allowable_a": 100.5,
  "delta_u_pct": 2.3,
  "status": "OK" | "WARN" | "FAIL",
  "validation": {...},
  "note": "..."
}
"""
import json
import sys
import os
import traceback
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))

from engine.calculation_engine import CalculationEngine
from engine.validation_engine import ValidationEngine
from engine.models import CableInput, SourceParams


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        self._send_json(200, {
            'ok': True,
            'service': 'cable-calc/calc',
            'version': '1.0',
            'modes': ['check', 'select', 'max_load'],
            'description': 'Cable section calculation'
        })

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0:
                return self._send_json(400, {'error': 'Empty body'})

            raw = self.rfile.read(length)
            body = json.loads(raw.decode('utf-8'))

            # Parse input parameters
            mode = body.get('mode', 'check')
            phases = int(body.get('phases', 3))
            power_kw = float(body.get('power_kw', 0))
            cos_phi = float(body.get('cos_phi', 0.85))
            length_m = float(body.get('length_m', 0))
            section_mm2 = body.get('section_mm2')
            if section_mm2:
                section_mm2 = float(section_mm2)
            material = body.get('material', 'Cu')
            insulation = body.get('insulation', 'XLPE')
            method = body.get('method', 'E')
            cables_nearby = int(body.get('cables_nearby', 1))
            ambient_temp_c = float(body.get('ambient_temp_c', 30))
            delta_u_pct_max = float(body.get('delta_u_pct_max', 5.0))
            isc_a = float(body.get('isc_a', 0))
            isc_time_s = float(body.get('isc_time_s', 0.1))

            if length_m <= 0:
                return self._send_json(400, {'error': 'Invalid length'})

            # Create input object
            source = SourceParams()
            inp = CableInput(
                phases=phases,
                power_kw=power_kw if power_kw > 0 else None,
                cos_phi=cos_phi,
                length_m=length_m,
                section_mm2=section_mm2,
                material=material,
                insulation=insulation,
                method=method,
                cables_nearby=cables_nearby,
                ambient_temp_c=ambient_temp_c,
                delta_u_pct_max=delta_u_pct_max,
                isc_a=isc_a if isc_a > 0 else None,
                isc_time_s=isc_time_s,
                source=source
            )

            # Calculate based on mode
            calc_engine = CalculationEngine()
            val_engine = ValidationEngine()
            result = None
            status = 'UNKNOWN'
            note = ''

            if mode == 'check':
                # Check if given section meets requirements
                if not section_mm2 or section_mm2 <= 0:
                    return self._send_json(400, {'error': 'section_mm2 required for check mode'})
                result = calc_engine.check_section(inp)
                validation = val_engine.validate_section(inp, result)
                if validation['all_passed']:
                    status = 'OK'
                    note = 'Сечение соответствует требованиям'
                else:
                    status = 'WARN'
                    note = 'Сечение не соответствует некоторым требованиям'

            elif mode == 'select':
                # Find minimum suitable section
                if not power_kw or power_kw <= 0:
                    return self._send_json(400, {'error': 'power_kw required for select mode'})
                result = calc_engine.select_section(inp)
                if result:
                    status = 'OK'
                    note = f'Найдено минимальное сечение {result.section_mm2} мм²'
                else:
                    status = 'FAIL'
                    note = 'Не найдено подходящее сечение'

            elif mode == 'max_load':
                # Calculate max load for given section
                if not section_mm2 or section_mm2 <= 0:
                    return self._send_json(400, {'error': 'section_mm2 required for max_load mode'})
                result = calc_engine.calc_max_load(inp)
                status = 'OK'
                note = f'Допустимая мощность {result.max_power_kw:.2f} кВт'

            else:
                return self._send_json(400, {'error': f'Unknown mode: {mode}'})

            if not result:
                return self._send_json(400, {'error': 'Calculation failed'})

            # Return result
            response = {
                'section_mm2': result.section_mm2,
                'i_allowable_a': result.i_allowable_a,
                'delta_u_pct': result.delta_u_pct,
                'status': status,
                'note': note,
                'mode': mode,
            }
            if hasattr(result, 'max_power_kw'):
                response['max_power_kw'] = result.max_power_kw

            self._send_json(200, response)

        except json.JSONDecodeError:
            self._send_json(400, {'error': 'Invalid JSON'})
        except Exception as e:
            self._send_json(500, {
                'error': str(e),
                'type': type(e).__name__,
                'traceback': traceback.format_exc().splitlines()[-5:]
            })
