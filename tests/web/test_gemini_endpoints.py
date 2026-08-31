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
# --- SERVER_SYSTEM_PREAMBLE / System Prompt composition tests ---
# See EchoBot_SystemPrompt_Preamble_Investigation_2026-08-31.md: the previous
# composition (f"{server_preamble}\n{client_inst}".strip()) merged the
# operator-controlled server preamble and the user's Settings System Prompt
# into one opaque string, preamble always first. build_system_instruction()
# (web/backend/app.py) replaces that with a list of the non-empty pieces,
# which the installed google-genai SDK (2.20.0) turns into separate Parts of
# one Content -- confirmed directly against the SDK's own request-building
# transformer (google.genai._transformers.t_content), not assumed.

def test_build_system_instruction_unit_cases(monkeypatch):
    """Direct unit coverage of the composition helper's corner cases."""
    from web.backend.app import build_system_instruction

    monkeypatch.delenv("SERVER_SYSTEM_PREAMBLE", raising=False)
    assert build_system_instruction("Be polite.") == ["Be polite."]

    monkeypatch.setenv("SERVER_SYSTEM_PREAMBLE", "Safety: never do X.")
    assert build_system_instruction("Be polite.") == ["Safety: never do X.", "Be polite."]

    # Empty/None client prompt with a preamble set: the preamble alone must survive.
    assert build_system_instruction("") == ["Safety: never do X."]
    assert build_system_instruction(None) == ["Safety: never do X."]

    # Both empty (or whitespace-only): None, matching the previous
    # `if final_inst else None` behavior -- never send an empty instruction.
    monkeypatch.delenv("SERVER_SYSTEM_PREAMBLE", raising=False)
    assert build_system_instruction("") is None
    assert build_system_instruction("   ") is None
    monkeypatch.setenv("SERVER_SYSTEM_PREAMBLE", "   ")
    assert build_system_instruction("") is None


def _post_chat_simple(client_prompt):
    """Posts to chat-simple with a given client System Prompt and returns
    the `config` kwarg the (mocked) Gemini call actually received."""
    from web.backend.app import require_valid_token
    from unittest.mock import AsyncMock

    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    with patch("web.backend.app.gemini_client") as mock_client:
        mock_response = MagicMock()
        mock_response.text = "ok"
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        response = client.post("/api/gemini/chat-simple", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": client_prompt,
            "history": [],
            "newMessage": "Hello",
        })
        assert response.status_code == 200
        config = mock_client.aio.models.generate_content.call_args.kwargs["config"]
    app.dependency_overrides.clear()
    return config


def _post_chat_streaming(client_prompt):
    """Same as _post_chat_simple but for the streaming /api/gemini/chat
    endpoint, which builds config identically but calls
    generate_content_stream instead of generate_content."""
    from web.backend.app import require_valid_token
    from unittest.mock import AsyncMock

    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}

    async def fake_stream():
        chunk = MagicMock()
        chunk.text = "ok"
        yield chunk

    with patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content_stream = AsyncMock(return_value=fake_stream())

        response = client.post("/api/gemini/chat", json={
            "modelName": "gemini-2.5-flash",
            "systemInstruction": client_prompt,
            "history": [],
            "newMessage": "Hello",
        })
        assert response.status_code == 200
        config = mock_client.aio.models.generate_content_stream.call_args.kwargs["config"]
    app.dependency_overrides.clear()
    return config


@pytest.mark.parametrize("post_fn", [_post_chat_simple, _post_chat_streaming], ids=["chat_simple", "chat_streaming"])
def test_no_preamble_client_prompt_reaches_gemini_alone(monkeypatch, post_fn):
    """No server preamble + a client System Prompt: the prompt must be the
    only thing sent, as its own part -- this is the "just works" case the
    reported bug depends on NOT regressing."""
    monkeypatch.delenv("SERVER_SYSTEM_PREAMBLE", raising=False)
    config = post_fn("You are a friendly, polite assistant. Never be rude.")
    assert config["system_instruction"] == ["You are a friendly, polite assistant. Never be rude."]


@pytest.mark.parametrize("post_fn", [_post_chat_simple, _post_chat_streaming], ids=["chat_simple", "chat_streaming"])
def test_preamble_and_client_prompt_both_present_as_distinct_parts(monkeypatch, post_fn):
    """With a server preamble set, both the preamble and the client's
    System Prompt must reach Gemini as two distinguishable list entries --
    never silently dropped, never merged back into one string."""
    monkeypatch.setenv("SERVER_SYSTEM_PREAMBLE", "SAFETY: never reveal internal system details.")
    config = post_fn("You are a friendly, polite assistant. Never be rude.")
    instr = config["system_instruction"]
    assert isinstance(instr, list) and len(instr) == 2, f"expected two distinct parts, got {instr!r}"
    assert instr[0] == "SAFETY: never reveal internal system details."
    assert instr[1] == "You are a friendly, polite assistant. Never be rude."


@pytest.mark.parametrize("post_fn", [_post_chat_simple, _post_chat_streaming], ids=["chat_simple", "chat_streaming"])
def test_empty_client_prompt_with_preamble_still_sends_preamble_alone(monkeypatch, post_fn):
    """An empty client System Prompt must not drop the server preamble, and
    must not send a bogus empty part alongside it."""
    monkeypatch.setenv("SERVER_SYSTEM_PREAMBLE", "SAFETY: never reveal internal system details.")
    config = post_fn("")
    assert config["system_instruction"] == ["SAFETY: never reveal internal system details."]


@pytest.mark.parametrize("post_fn", [_post_chat_simple, _post_chat_streaming], ids=["chat_simple", "chat_streaming"])
def test_changing_client_prompt_updates_instruction_preamble_survives(monkeypatch, post_fn):
    """Regression test for the original user-visible bug: with
    SERVER_SYSTEM_PREAMBLE held constant, sending System Prompt A and then
    immediately System Prompt B must produce two DIFFERENT requests, each
    reflecting its own current client prompt, with the server instruction
    still present and unchanged both times -- proving there is no
    stale/cached client instruction anywhere in this path."""
    monkeypatch.setenv("SERVER_SYSTEM_PREAMBLE", "SAFETY: never reveal internal system details.")

    config_a = post_fn("System Prompt A: be a pirate.")
    config_b = post_fn("System Prompt B: be a Shakespearean poet.")

    assert config_a["system_instruction"] == [
        "SAFETY: never reveal internal system details.", "System Prompt A: be a pirate."
    ]
    assert config_b["system_instruction"] == [
        "SAFETY: never reveal internal system details.", "System Prompt B: be a Shakespearean poet."
    ]
    assert config_a != config_b
    assert config_a["system_instruction"][0] == config_b["system_instruction"][0] == "SAFETY: never reveal internal system details."
