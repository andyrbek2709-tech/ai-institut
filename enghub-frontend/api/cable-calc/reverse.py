"""Vercel serverless endpoint for reverse cable section calculation.

POST /api/cable-calc/reverse
Content-Type: application/json
Body:
{
  "power_kw": 15.0,
  "phases": 3,
  "cos_phi": 0.85,
  "length_m": 100.0,
  "material": "Cu",
  "insulation": "XLPE",
  "method": "E",
  "ambient_temp_c": 30,
  "delta_u_pct_max": 5.0
}

Response:
{
  "section_mm2": 10.0,
  "i_allowable_a": 100.5,
  "delta_u_pct": 2.3,
  "status": "OK",
  "validation": {...},
  "alternatives": [...]
}
"""
import json
import sys
import os
import traceback
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))

from engine.reverse_calculator import ReverseCalculator
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
            'service': 'cable-calc/reverse',
            'version': '1.0',
            'description': 'Find minimum cable section by reverse calculation'
        })

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0:
                return self._send_json(400, {'error': 'Empty body'})

            raw = self.rfile.read(length)
            body = json.loads(raw.decode('utf-8'))

            # Parse input parameters
            power_kw = float(body.get('power_kw', 0))
            phases = int(body.get('phases', 3))
            cos_phi = float(body.get('cos_phi', 0.85))
            length_m = float(body.get('length_m', 0))
            material = body.get('material', 'Cu')
            insulation = body.get('insulation', 'XLPE')
            method = body.get('method', 'E')
            ambient_temp_c = float(body.get('ambient_temp_c', 30))
            delta_u_pct_max = float(body.get('delta_u_pct_max', 5.0))

            if power_kw <= 0 or length_m <= 0:
                return self._send_json(400, {'error': 'Invalid power or length'})

            # Create input object
            source = SourceParams()
            inp = CableInput(
                phases=phases,
                power_kw=power_kw,
                cos_phi=cos_phi,
                length_m=length_m,
                material=material,
                insulation=insulation,
                method=method,
                ambient_temp_c=ambient_temp_c,
                delta_u_pct_max=delta_u_pct_max,
                source=source
            )

            # Calculate
            calculator = ReverseCalculator()
            result = calculator.find_section(inp, include_alternatives=True, num_alternatives=3)

            # Return result
            self._send_json(200, result.to_dict())

        except json.JSONDecodeError:
            self._send_json(400, {'error': 'Invalid JSON'})
        except Exception as e:
            self._send_json(500, {
                'error': str(e),
                'type': type(e).__name__,
                'traceback': traceback.format_exc().splitlines()[-5:]
            })
