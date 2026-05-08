import pytest


@pytest.mark.api
def test_calculate_valid_input(client, valid_calculation_input):
    """Test calculation with valid input"""
    response = client.post('/calculations/calculate', json=valid_calculation_input)
    assert response.status_code == 200
    data = response.json()
    assert 'output_variables' in data
    assert isinstance(data['output_variables'], dict)


@pytest.mark.api
def test_calculate_invalid_input(client, invalid_calculation_input):
    """Test calculation with invalid input"""
    response = client.post('/calculations/calculate', json=invalid_calculation_input)
    assert response.status_code >= 400
    data = response.json()
    assert 'error' in data or 'detail' in data


@pytest.mark.api
def test_validate_calculation_valid(client, valid_calculation_input):
    """Test validation with valid input"""
    response = client.post('/calculations/validate', json=valid_calculation_input)
    assert response.status_code == 200
    data = response.json()
    assert 'valid' in data
    assert isinstance(data['valid'], bool)


@pytest.mark.api
def test_validate_calculation_invalid(client, invalid_calculation_input):
    """Test validation with invalid input"""
    response = client.post('/calculations/validate', json=invalid_calculation_input)
    assert response.status_code == 200
    data = response.json()
    assert 'valid' in data
    assert 'errors' in data
    assert data['valid'] is False


@pytest.mark.api
def test_calculate_missing_template(client):
    """Test calculation with non-existent template"""
    response = client.post('/calculations/calculate', json={
        'template_id': 'nonexistent',
        'variables': {'x': 1}
    })
    assert response.status_code == 404
    data = response.json()
    assert 'error' in data
