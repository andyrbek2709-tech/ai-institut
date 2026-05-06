"""
Batch Endpoint - HTTP API для пакетной обработки Excel файлов.

Регистрирует маршруты для Flask приложения.
"""
import os
import json
import tempfile
import logging
from flask import request, jsonify

logger = logging.getLogger(__name__)


def register_batch_routes(app):
    """
    Регистрировать маршруты для пакетной обработки.

    Args:
        app: Flask приложение
    """

    @app.route('/api/cable-calc/batch/check-excel', methods=['POST'])
    def batch_check_excel():
        """
        Пакетная проверка Excel файла.

        Request (multipart/form-data):
            - file: Excel файл (.xlsx или .xls)
            - sheet_name: (опционально) имя листа
            - start_row: (опционально) начальная строка (по умолчанию 2)
            - defaults: (опционально) JSON с значениями по умолчанию

        Response:
            {
                "status": "ok|error",
                "data": {
                    "results": [ResultModel, ...],
                    "summary": {
                        "total_processed": int,
                        "ok_count": int,
                        "warning_count": int,
                        "error_count": int,
                        "ok_percentage": float,
                        "warning_percentage": float,
                        "error_percentage": float,
                        "total_time_ms": float
                    }
                },
                "error": "error message"
            }
        """
        try:
            # Проверить наличие файла
            if 'file' not in request.files:
                return jsonify({
                    'status': 'error',
                    'error': 'Файл не загружен'
                }), 400

            file = request.files['file']
            if file.filename == '':
                return jsonify({
                    'status': 'error',
                    'error': 'Выбран пустой файл'
                }), 400

            if not file.filename.endswith(('.xlsx', '.xls')):
                return jsonify({
                    'status': 'error',
                    'error': 'Требуется Excel файл (.xlsx или .xls)'
                }), 400

            # Сохранить временный файл
            temp_dir = tempfile.gettempdir()
            temp_path = os.path.join(temp_dir, file.filename)
            file.save(temp_path)

            try:
                # Получить параметры из request
                sheet_name = request.form.get('sheet_name') or None
                start_row = int(request.form.get('start_row', 2))
                defaults_json = request.form.get('defaults', '{}')

                # Парсить JSON с значениями по умолчанию
                defaults = {}
                if defaults_json:
                    try:
                        defaults = json.loads(defaults_json)
                    except json.JSONDecodeError:
                        return jsonify({
                            'status': 'error',
                            'error': 'Невалидный JSON в параметре defaults'
                        }), 400

                # Импортировать обработчик
                from batch_processor import ExcelBatchProcessor

                # Обработать файл
                processor = ExcelBatchProcessor()
                results, summary = processor.process_batch(
                    excel_path=temp_path,
                    sheet_name=sheet_name,
                    start_row=start_row,
                    defaults=defaults
                )

                # Преобразовать результаты в JSON
                results_json = [r.to_dict() for r in results]

                return jsonify({
                    'status': 'ok',
                    'data': {
                        'results': results_json,
                        'summary': {
                            'total_processed': summary.total_processed,
                            'ok_count': summary.ok_count,
                            'warning_count': summary.warning_count,
                            'error_count': summary.error_count,
                            'ok_percentage': summary.ok_percentage,
                            'warning_percentage': summary.warning_percentage,
                            'error_percentage': summary.error_percentage,
                            'total_time_ms': summary.total_time_ms,
                        }
                    }
                })

            finally:
                # Удалить временный файл
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception as e:
                        logger.warning(f"Не удалось удалить временный файл: {e}")

        except Exception as e:
            logger.error(f"Ошибка в batch_check_excel: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'error': f'Ошибка обработки файла: {str(e)}'
            }), 500

    @app.route('/api/cable-calc/batch/status', methods=['GET'])
    def batch_status():
        """Получить статус batch-обработчика."""
        return jsonify({
            'status': 'ok',
            'service': 'batch-processor',
            'mode': 'BATCH',
            'capabilities': [
                'Excel parsing',
                'Flexible column mapping',
                'Row-by-row processing',
                'Error resilience',
                'Detailed validation'
            ]
        })
