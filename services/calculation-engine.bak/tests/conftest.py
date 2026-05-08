import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def valid_calculation_input():
    """Valid calculation input for testing"""
    return {
        'template_id': 'pipe_stress',
        'variables': {
            'pressure': 10.0,
            'outer_diameter': 100.0,
            'wall_thickness': 5.0,
            'yield_strength': 450.0,
        }
    }


@pytest.fixture
def invalid_calculation_input():
    """Invalid calculation input for testing"""
    return {
        'template_id': 'pipe_stress',
        'variables': {
            'pressure': -10.0,  # Invalid: negative pressure
            'outer_diameter': 100.0,
            'wall_thickness': 5.0,
            'yield_strength': 450.0,
        }
    }
