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


def test_chat_simple_records_success_for_health_signal():
    """F6: a successful non-streaming call must update the cached health signal."""
    from web.backend.app import require_valid_token
    import web.backend.app as app_module
    from unittest.mock import AsyncMock

    app_module._llm_last_attempt = None
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        mock_response = MagicMock()
        mock_response.text = "ok"
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        response = client.post("/api/gemini/chat-simple", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "",
            "history": [],
            "newMessage": "Hello"
        })
        assert response.status_code == 200

    assert app_module._llm_last_attempt is not None
    _, ok = app_module._llm_last_attempt
    assert ok is True
    app.dependency_overrides.clear()
    app_module._llm_last_attempt = None


def test_chat_simple_error_response_unchanged_and_records_failure():
    """F4 is fixed for the streaming endpoint (see
    test_chat_streaming_sanitizes_error_and_maps_to_safe_category below); this
    non-streaming endpoint's behavior was already correct and is the reference
    that fix was designed to match. Its exception must still propagate
    completely unchanged -- same type, same message -- proving the F6
    instrumentation is a bare record-then-raise and did not wrap, swallow, or
    alter it, and that F4's streaming-only fix did not touch this endpoint.
    TestClient's default raise_server_exceptions=True surfaces the original
    exception directly here, which is the strongest possible proof it wasn't
    touched."""
    from web.backend.app import require_valid_token
    import web.backend.app as app_module
    from unittest.mock import AsyncMock

    app_module._llm_last_attempt = None
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content = AsyncMock(
            side_effect=RuntimeError("boom: simulated Gemini failure")
        )

        with pytest.raises(RuntimeError, match="boom: simulated Gemini failure"):
            client.post("/api/gemini/chat-simple", json={
                "modelName": "gemini-2.5-flash",
                "systemInstruction": "",
                "history": [],
                "newMessage": "Hello"
            })

    assert app_module._llm_last_attempt is not None
    _, ok = app_module._llm_last_attempt
    assert ok is False
    app.dependency_overrides.clear()
    app_module._llm_last_attempt = None


def test_chat_streaming_records_success():
    """F6: a streaming call that completes without raising must record success."""
    from web.backend.app import require_valid_token
    import web.backend.app as app_module
    from unittest.mock import AsyncMock

    async def fake_stream():
        chunk = MagicMock()
        chunk.text = "hi"
        yield chunk

    app_module._llm_last_attempt = None
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content_stream = AsyncMock(return_value=fake_stream())

        response = client.post("/api/gemini/chat", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "",
            "history": [],
            "newMessage": "Hello"
        })
        assert response.status_code == 200
        assert '"done": true' in response.text

    assert app_module._llm_last_attempt is not None
    _, ok = app_module._llm_last_attempt
    assert ok is True
    app.dependency_overrides.clear()
    app_module._llm_last_attempt = None


@pytest.mark.parametrize(
    "raw_exception_message,expected_category",
    [
        ("429 Too Many Requests: quota exceeded", "rate_limit"),
        ("Content blocked by safety filters", "safety"),
        ("Invalid API key: not configured", "no_api_key"),
        ("boom: simulated stream failure", "generic"),
    ],
)
def test_chat_streaming_sanitizes_error_and_maps_to_safe_category(raw_exception_message, expected_category):
    """F4: the streamed error event must never contain the raw exception text
    (or any other internal detail) -- only one of the four fixed, safe
    categories produced by _categorize_llm_error. The real exception must
    still be recorded via _record_llm_attempt(False) exactly as before --
    server-side observability (this signal, and logger.error, which is
    covered by the live-server reproduction rather than a unit test) is
    unchanged; only what reaches the client is sanitized."""
    from web.backend.app import require_valid_token
    import web.backend.app as app_module
    from unittest.mock import AsyncMock

    app_module._llm_last_attempt = None
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content_stream = AsyncMock(
            side_effect=RuntimeError(raw_exception_message)
        )

        response = client.post("/api/gemini/chat", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": "",
            "history": [],
            "newMessage": "Hello"
        })
        assert response.status_code == 200  # StreamingResponse already started
        assert f'"error": "{expected_category}"' in response.text
        assert raw_exception_message not in response.text

    assert app_module._llm_last_attempt is not None
    _, ok = app_module._llm_last_attempt
    assert ok is False
    app.dependency_overrides.clear()
    app_module._llm_last_attempt = None
