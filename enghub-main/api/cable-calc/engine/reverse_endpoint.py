"""
Reverse Endpoint - HTTP API для обратного расчета.

Регистрирует маршруты для Flask приложения.
"""
import json
import logging
from flask import request, jsonify

logger = logging.getLogger(__name__)


def register_reverse_routes(app):
    """
    Регистрировать маршруты для обратного расчета.

    Args:
        app: Flask приложение
    """

    @app.route('/api/cable-calc/reverse/find-section', methods=['POST'])
    def reverse_find_section():
        """
        Найти минимальное подходящее сечение по требованиям.

        Request (JSON):
            {
                "power_kw": 15.0,
                "length_m": 100.0,
                "phases": 3,
                "cos_phi": 0.85,
                "material": "Cu",
                "insulation": "PVC",
                "method": "C",
                "delta_u_pct_max": 5.0,
                "ambient_temp_c": 30.0,
                "cables_nearby": 1,
                "cable_count": 1,
                "include_alternatives": true,
                "num_alternatives": 3
            }

        Response:
            {
                "status": "ok|error",
                "data": {
                    "section_mm2": 16.0,
                    "i_allowable_a": 123.5,
                    "delta_u_pct": 3.2,
                    "status": "OK",
                    "alternatives": [...],
                    "search_iterations": 8,
                    "search_time_ms": 45.2
                },
                "error": "error message"
            }
        """
        try:
            # Получить JSON из request
            data = request.get_json()
            if not data:
                return jsonify({
                    'status': 'error',
                    'error': 'Request body должен быть JSON'
                }), 400

            # Импортировать здесь чтобы избежать циклических импортов
            from engine import ReverseCalculator, CableInput, SourceParams

            # Подготовить входные параметры
            src = SourceParams()
            inp = CableInput(
                line_id=data.get('line_id', ''),
                line_name=data.get('line_name', ''),
                phases=int(data.get('phases', 3)),
                power_kw=float(data.get('power_kw', 0)),
                cos_phi=float(data.get('cos_phi', 0.85)),
                length_m=float(data.get('length_m', 50.0)),
                material=str(data.get('material', 'Cu')).upper(),
                insulation=str(data.get('insulation', 'PVC')).upper(),
                method=str(data.get('method', 'C')).upper(),
                cables_nearby=int(data.get('cables_nearby', 1)),
                cable_count=int(data.get('cable_count', 1)),
                section_mm2=None,  # Не устанавливаем для reverse
                ambient_temp_c=float(data.get('ambient_temp_c', 30.0)),
                delta_u_pct_max=data.get('delta_u_pct_max'),
                source=src,
            )

            # Получить параметры поиска
            include_alternatives = data.get('include_alternatives', True)
            num_alternatives = int(data.get('num_alternatives', 3))

            # Выполнить обратный расчет
            calculator = ReverseCalculator()
            result = calculator.find_section(
                inp,
                include_alternatives=include_alternatives,
                num_alternatives=num_alternatives,
            )

            # Преобразовать результат
            return jsonify({
                'status': 'ok',
                'data': result.to_dict()
            })

        except ValueError as e:
            logger.error(f"Ошибка парсинга значения: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'error': f'Ошибка парсинга параметров: {str(e)}'
            }), 400

        except Exception as e:
            logger.error(f"Ошибка в reverse_find_section: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'error': f'Ошибка расчета: {str(e)}'
            }), 500

    @app.route('/api/cable-calc/reverse/find-batch', methods=['POST'])
    def reverse_find_batch():
        """
        Найти сечения для пакета параметров.

        Request (JSON):
            {
                "inputs": [
                    {"power_kw": 15.0, ...},
                    {"power_kw": 22.0, ...}
                ],
                "include_alternatives": true
            }

        Response:
            {
                "status": "ok|error",
                "data": {
                    "results": [...],
                    "stats": {
                        "total": 2,
                        "success": 2,
                        "error": 0,
                        "total_iterations": 15,
                        "total_time_ms": 87.3
                    }
                },
                "error": "error message"
            }
        """
        try:
            data = request.get_json()
            if not data or 'inputs' not in data:
                return jsonify({
                    'status': 'error',
                    'error': 'Request должен содержать "inputs" массив'
                }), 400

            from engine import ReverseCalculator, CableInput, SourceParams

            # Преобразовать inputs в CableInput объекты
            cable_inputs = []
            for item in data['inputs']:
                src = SourceParams()
                inp = CableInput(
                    line_id=item.get('line_id', ''),
                    line_name=item.get('line_name', ''),
                    phases=int(item.get('phases', 3)),
                    power_kw=float(item.get('power_kw', 0)),
                    cos_phi=float(item.get('cos_phi', 0.85)),
                    length_m=float(item.get('length_m', 50.0)),
                    material=str(item.get('material', 'Cu')).upper(),
                    insulation=str(item.get('insulation', 'PVC')).upper(),
                    method=str(item.get('method', 'C')).upper(),
                    cables_nearby=int(item.get('cables_nearby', 1)),
                    cable_count=int(item.get('cable_count', 1)),
                    section_mm2=None,
                    ambient_temp_c=float(item.get('ambient_temp_c', 30.0)),
                    delta_u_pct_max=item.get('delta_u_pct_max'),
                    source=src,
                )
                cable_inputs.append(inp)

            # Выполнить пакетный обратный расчет
            include_alternatives = data.get('include_alternatives', True)
            num_alternatives = int(data.get('num_alternatives', 3))

            calculator = ReverseCalculator()
            results, stats = calculator.find_section_batch(
                cable_inputs,
                include_alternatives=include_alternatives,
                num_alternatives=num_alternatives,
            )

            # Преобразовать результаты
            results_json = [r.to_dict() for r in results]

            return jsonify({
                'status': 'ok',
                'data': {
                    'results': results_json,
                    'stats': stats,
                }
            })

        except ValueError as e:
            logger.error(f"Ошибка парсинга значения: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'error': f'Ошибка парсинга параметров: {str(e)}'
            }), 400

        except Exception as e:
            logger.error(f"Ошибка в reverse_find_batch: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'error': f'Ошибка расчета: {str(e)}'
            }), 500

    @app.route('/api/cable-calc/reverse/status', methods=['GET'])
    def reverse_status():
        """Получить статус reverse-обработчика."""
        return jsonify({
            'status': 'ok',
            'service': 'reverse-calculator',
            'mode': 'REVERSE',
            'capabilities': [
                'Find minimum suitable section',
                'Batch reverse calculation',
                'Alternative sections',
                'Search statistics'
            ]
        })
