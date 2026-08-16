from app.main import app


def test_health():
    from fastapi.testclient import TestClient
    response = TestClient(app).get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'healthy'
