"""HTTP-level tests for /api/gemini/chat with FEATURES_PLUGINS off and on."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from web.backend.app import app, require_valid_token
from tests.web.test_tool_loop import FakeClient, call_part, chunk, make_registry, text_part

client = TestClient(app)

BODY = {
    "modelName": "gemini-2.5-flash",
    "systemInstruction": "",
    "history": [{"role": "user", "text": "earlier"}],
    "newMessage": "Hello",
}


@pytest.fixture(autouse=True)
def _isolate():
    app.state.limiter._storage.storage.clear()
    app.dependency_overrides[require_valid_token] = lambda: {"sid": "test"}
    yield
    app.dependency_overrides.clear()
    app.state.limiter._storage.storage.clear()


def parse_sse(text):
    return [json.loads(f[6:]) for f in text.split("\n\n") if f.startswith("data: ")]


def test_flag_off_stream_is_unchanged_byte_for_byte():
    async def fake_stream():
        c = MagicMock()
        c.text = "hi"
        yield c

    with patch("web.backend.app.tool_registry", new=None), \
         patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content_stream = AsyncMock(return_value=fake_stream())
        response = client.post("/api/gemini/chat", json=BODY)

        assert response.status_code == 200
        assert response.text == 'data: {"text": "hi"}\n\ndata: {"done": true}\n\n'

        kwargs = mock_client.aio.models.generate_content_stream.call_args.kwargs
        assert kwargs == {
            "model": "gemini-2.5-flash",
            "contents": [
                {"role": "user", "parts": [{"text": "earlier"}]},
                {"role": "user", "parts": [{"text": "Hello"}]},
            ],
            "config": None,  # no tools, no tool_config
        }


def test_flag_off_with_system_prompt_config_has_no_tool_keys():
    async def fake_stream():
        c = MagicMock()
        c.text = "ok"
        yield c

    with patch("web.backend.app.tool_registry", new=None), \
         patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content_stream = AsyncMock(return_value=fake_stream())
        client.post("/api/gemini/chat", json={**BODY, "systemInstruction": "Be brief"})
        config = mock_client.aio.models.generate_content_stream.call_args.kwargs["config"]
        assert config == {"system_instruction": ["Be brief"]}


def test_flag_on_streams_tool_events_then_text_then_done():
    fake = FakeClient([
        [chunk(text_part("One sec. ")), chunk(call_part("lookup", {"q": "paris"}, "c1"))],
        [chunk(text_part("Paris: sunny."))],
    ])
    registry = make_registry()

    with patch("web.backend.app.tool_registry", new=registry), \
         patch("web.backend.app.gemini_client", new=fake):
        response = client.post("/api/gemini/chat", json={**BODY, "systemInstruction": "Be brief"})

    assert response.status_code == 200
    events = parse_sse(response.text)
    assert [list(e)[0] for e in events] == ["text", "tool_call", "tool_result", "text", "done"]
    assert events[1]["tool_call"] == {"id": "c1", "name": "lookup", "args": {"q": "paris"}}
    assert events[2]["tool_result"]["ok"] is True
    assert events[-1] == {"done": True}
    assert fake.requests[0]["config"]["system_instruction"] == ["Be brief"]


def test_flag_on_gemini_failure_still_sends_sanitized_error():
    class Boom:
        aio = MagicMock()

    Boom.aio.models.generate_content_stream = AsyncMock(side_effect=Exception("429 quota exceeded secret"))

    with patch("web.backend.app.tool_registry", new=make_registry()), \
         patch("web.backend.app.gemini_client", new=Boom()):
        response = client.post("/api/gemini/chat", json=BODY)

    events = parse_sse(response.text)
    assert events == [{"error": "rate_limit"}]
    assert "secret" not in response.text


def test_chat_simple_never_gets_tools():
    mock_response = MagicMock()
    mock_response.text = "plain"
    with patch("web.backend.app.tool_registry", new=make_registry()), \
         patch("web.backend.app.gemini_client") as mock_client:
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        response = client.post("/api/gemini/chat-simple", json=BODY)
        assert response.json() == {"text": "plain"}
        assert mock_client.aio.models.generate_content.call_args.kwargs["config"] is None
