import pytest
from fastapi.testclient import TestClient
from web.backend.app import app, ALLOWED_MODELS, DEFAULT_MODEL
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_model_allowlist_fallback():
    from web.backend.app import get_validated_model
    assert get_validated_model("gemini-2.5-flash") == "gemini-2.5-flash"
    assert get_validated_model("hacker-model") == DEFAULT_MODEL
    
    retired_models = {"gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001"}
    assert DEFAULT_MODEL not in retired_models
    for model in ALLOWED_MODELS:
        assert model not in retired_models

def test_chat_simple_includes_history_and_images():
    from web.backend.app import require_valid_token
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        from unittest.mock import AsyncMock
        mock_response = MagicMock()
        mock_response.text = "Mocked reply"
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        
        response = client.post("/api/gemini/chat-simple", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "Sys prompt",
            "history": [{"role": "user", "text": "Hi"}],
            "newMessage": "Hello",
            "images": ["data:image/png;base64,iVBORw0KGgo"]
        })
        
        assert response.status_code == 200
        assert response.json()["text"] == "Mocked reply"
        
        called_kwargs = mock_client.aio.models.generate_content.call_args.kwargs
        contents = called_kwargs["contents"]
        assert len(contents) == 2
        assert contents[0]["role"] == "user"
        assert contents[0]["parts"][0]["text"] == "Hi"
        assert contents[1]["role"] == "user"
        assert contents[1]["parts"][0]["text"] == "Hello"
        assert contents[1]["parts"][1]["mime_type"] == "image/png"
    app.dependency_overrides.clear()

def test_503_when_client_is_none():
    from web.backend.app import require_valid_token
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client", new=None):
        
        response = client.post("/api/gemini/chat-simple", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "",
            "history": [],
            "newMessage": "Hello"
        })
        assert response.status_code == 503
        assert "AI service not configured" in response.json()["detail"]
    app.dependency_overrides.clear()
