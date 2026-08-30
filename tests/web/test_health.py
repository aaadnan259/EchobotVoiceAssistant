import time
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

import web.backend.app as app_module
from web.backend.app import app, LLM_HEALTH_RECENCY_WINDOW_SECONDS

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_llm_health_state():
    """The cached signal is module-level state (web.backend.app._llm_last_attempt),
    matching this file's existing pattern for shared server globals (gemini_client,
    voice_engine). Reset it before and after every test so tests in this file --
    and any other test module that imports web.backend.app -- can't leak state into
    each other, the same concern already handled for ConfigLoader._settings in
    tests/config/test_loader.py."""
    app_module._llm_last_attempt = None
    yield
    app_module._llm_last_attempt = None


def test_fresh_process_no_attempt_yet_llm_true_when_client_present():
    """Unchanged legacy behavior: before any chat attempt this process lifetime,
    the field falls back exactly to the old startup-time proxy."""
    with patch("web.backend.app.gemini_client", new=object()):
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["services"]["llm"] is True


def test_fresh_process_no_attempt_yet_llm_false_when_client_absent():
    """Unchanged legacy behavior, the other branch: no attempt yet and no client
    constructed at startup -> false, exactly as before this change."""
    with patch("web.backend.app.gemini_client", new=None):
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["services"]["llm"] is False


def test_recent_success_overrides_absent_client():
    """A fresh successful attempt is trusted over the startup proxy, even when the
    startup proxy alone would say false -- proves the fresh signal, not the old
    proxy, is driving the result."""
    app_module._record_llm_attempt(True)
    with patch("web.backend.app.gemini_client", new=None):
        response = client.get("/api/health")
    assert response.json()["services"]["llm"] is True


def test_recent_failure_overrides_present_client():
    """A fresh failed attempt is trusted over the startup proxy, even when the
    startup proxy alone would say true -- this is the core F6 fix: a call that
    actually failed after startup is now visible."""
    app_module._record_llm_attempt(False)
    with patch("web.backend.app.gemini_client", new=object()):
        response = client.get("/api/health")
    assert response.json()["services"]["llm"] is False


def test_stale_failure_falls_back_to_startup_proxy_not_stuck_forever():
    """An old failure outside the recency window must not haunt the field forever
    once Gemini/the process itself looks fine again -- falls back to the startup
    proxy exactly as the fresh-process case does."""
    stale_at = time.monotonic() - LLM_HEALTH_RECENCY_WINDOW_SECONDS - 1
    app_module._llm_last_attempt = (stale_at, False)
    with patch("web.backend.app.gemini_client", new=object()):
        response = client.get("/api/health")
    assert response.json()["services"]["llm"] is True


def test_failure_just_inside_window_is_still_reported():
    """The boundary case in the other direction: a very recent failure must not be
    forgotten too quickly."""
    recent_at = time.monotonic() - (LLM_HEALTH_RECENCY_WINDOW_SECONDS - 1)
    app_module._llm_last_attempt = (recent_at, False)
    with patch("web.backend.app.gemini_client", new=object()):
        response = client.get("/api/health")
    assert response.json()["services"]["llm"] is False


def test_tts_and_voice_fields_unaffected():
    """Only the llm field's computation changed -- tts/voice must be identical to
    before this workstream."""
    with patch("web.backend.app.gemini_client", new=object()), \
         patch("web.backend.app.tts_engine", new=None), \
         patch("web.backend.app.voice_engine", new=None):
        response = client.get("/api/health")
    body = response.json()
    assert body["services"]["tts"] is False
    assert body["services"]["voice"] is False
    assert response.status_code == 200
    assert body["status"] == "healthy"
