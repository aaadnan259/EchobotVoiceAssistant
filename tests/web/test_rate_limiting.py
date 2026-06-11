import pytest
from fastapi.testclient import TestClient
from web.backend.app import app, require_valid_token
from unittest.mock import patch

def test_rate_limiting():
    # app.state.limiter.reset() does not exist, we just use a unique IP
    client = TestClient(app)
    headers = {"X-Forwarded-For": "10.0.0.99"}
    app.state.limiter._storage.storage.clear()
    
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    
    with patch("web.backend.app.gemini_client", new=None): # To get fast 503 responses instead of 200
        for _ in range(10):
            response = client.post("/api/gemini/chat-simple", json={
                "modelName": "gemini-2.5-flash",
                "systemInstruction": "",
                "history": [],
                "newMessage": "Hello"
            }, headers=headers)
            assert response.status_code == 503 # Passed rate limit

        # 11th request should be 429
        response_11 = client.post("/api/gemini/chat-simple", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "",
            "history": [],
            "newMessage": "Hello"
        }, headers=headers)
        
        assert response_11.status_code == 429
        assert "Retry-After" in response_11.headers
        
    app.dependency_overrides.clear()
