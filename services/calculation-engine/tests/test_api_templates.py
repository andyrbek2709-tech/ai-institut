import pytest


@pytest.mark.api
def test_list_templates(client):
    """Test list templates endpoint"""
    response = client.get('/templates/')
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # We should have at least one template (pipe_stress)
    assert len(data) > 0
    # Check template structure
    template = data[0]
    assert 'id' in template
    assert 'name' in template
    assert 'description' in template
    assert 'category' in template


@pytest.mark.api
def test_get_template(client):
    """Test get specific template"""
    response = client.get('/templates/pipe_stress')
    assert response.status_code == 200
    data = response.json()
    assert 'metadata' in data
    assert 'inputs' in data
    assert 'outputs' in data
    assert 'formulas' in data


@pytest.mark.api
def test_get_template_not_found(client):
    """Test get non-existent template"""
    response = client.get('/templates/nonexistent')
    assert response.status_code == 404
    data = response.json()
    assert 'error' in data
    assert 'message' in data
