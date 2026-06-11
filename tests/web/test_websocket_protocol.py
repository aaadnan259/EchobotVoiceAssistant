import pytest
from fastapi.testclient import TestClient
from web.backend.app import app
from unittest.mock import patch

client = TestClient(app)

def test_ws_auth_ping_malformed_unknown():
    with patch("web.backend.app.validate_session_token") as mock_validate:
        mock_validate.return_value = {"sid": "test-session"}
        
        with client.websocket_connect("/ws") as websocket:
            # T1: auth->auth_response
            websocket.send_json({"type": "auth", "token": "good_token"})
            response = websocket.receive_json()
            assert response["type"] == "auth_response"
            assert response["success"] is True

            # T1: ping->pong
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            assert response["type"] == "pong"

            # T1: malformed JSON survives with error frame
            websocket.send_text("not json")
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert response["text"] == "invalid message format"

            # T1: unknown type->error frame
            websocket.send_json({"type": "random_type"})
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "unknown message type" in response["text"]
