"""
Flask приложение для API калькулятора кабеля.

Поддерживает три режима:
1. SINGLE - одиночный расчет (существующий)
2. BATCH - пакетная обработка Excel файлов (новый)
3. REVERSE - обратный расчет (новый)
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import logging

from excel.batch_endpoint import register_batch_routes
from engine.reverse_endpoint import register_reverse_routes
from models import ResultModel

# Конфигурация логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создать Flask приложение
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB
CORS(app)

# Регистрировать маршруты по модулям
register_batch_routes(app)
register_reverse_routes(app)


@app.route('/', methods=['GET'])
@app.route('/index.html', methods=['GET'])
def serve_index():
    """Служить главную страницу UI."""
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    return send_from_directory(static_dir, 'index.html')


@app.route('/static/<path:filename>', methods=['GET'])
def serve_static(filename):
    """Служить статические файлы."""
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    return send_from_directory(static_dir, filename)


@app.route('/api/cable-calc/health', methods=['GET'])
def health_check():
    """Проверка здоровья API."""
    return jsonify({
        'status': 'ok',
        'service': 'cable-calc-api',
        'modes': ['SINGLE', 'BATCH', 'REVERSE'],
        'ui_url': '/'
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
