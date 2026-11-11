import pytest
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-services"

def test_embedding_endpoint():
    response = client.post("/api/v1/embeddings", json={"text": "Hello robot"})
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert len(data["embedding"]) > 0

def test_chat_endpoint():
    response = client.post("/api/v1/chat", json={"prompt": "Say hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "text" in data
