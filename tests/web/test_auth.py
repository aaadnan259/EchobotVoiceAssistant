import pytest
from fastapi.testclient import TestClient
from web.backend.app import app
from web.backend.auth import create_session_token
import web.backend.auth

client = TestClient(app)

def test_auth_no_token():
    response = client.post("/api/gemini/chat-simple", json={
        "modelName": "gemini-2.5-flash",
        "systemInstruction": "",
        "history": [],
        "newMessage": "Hello"
    })
    assert response.status_code == 401

def test_auth_expired_token(monkeypatch):
    monkeypatch.setattr(web.backend.auth, "validate_session_token", lambda t: None)
    response = client.post("/api/gemini/chat-simple", json={
        "modelName": "gemini-2.5-flash",
        "systemInstruction": "",
        "history": [],
        "newMessage": "Hello"
    }, headers={"Authorization": "Bearer bad_token"})
    assert response.status_code == 401

def test_auth_valid_token():
    token = create_session_token()
    response = client.post("/api/gemini/chat-simple", json={
        "modelName": "gemini-2.5-flash",
        "systemInstruction": "",
        "history": [],
        "newMessage": "Hello"
    }, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code in [200, 503]

def test_ws_bad_token():
    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"type": "auth", "token": "invalid_token"})
        response = websocket.receive_json()
        assert response["type"] == "auth_response"
        assert response["success"] is False
        assert response["message"] == "invalid token"
