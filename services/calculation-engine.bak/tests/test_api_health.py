import pytest


@pytest.mark.api
def test_health_check(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ok'
    assert 'version' in data
    assert 'app' in data


@pytest.mark.api
def test_root_endpoint(client):
    """Test root endpoint"""
    response = client.get('/')
    assert response.status_code == 200
    data = response.json()
    assert 'name' in data
    assert 'version' in data
    assert 'endpoints' in data
