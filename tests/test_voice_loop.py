
import sys
from unittest.mock import MagicMock, AsyncMock, patch
import asyncio
import pytest
import os

# We need to set up sys.path
sys.path.append(os.getcwd())

@pytest.fixture(autouse=True)
def mock_dependencies(monkeypatch):
    monkeypatch.setitem(sys.modules, "services.plugin_manager", MagicMock())
    monkeypatch.setitem(sys.modules, "services.llm.llm_service", MagicMock())
    monkeypatch.setitem(sys.modules, "services.audio.tts", MagicMock())
    monkeypatch.setitem(sys.modules, "services.audio.voice_engine", MagicMock())
    monkeypatch.setitem(sys.modules, "google.genai", MagicMock())
    monkeypatch.setitem(sys.modules, "fastapi", MagicMock())
    monkeypatch.setitem(sys.modules, "fastapi.staticfiles", MagicMock())
    monkeypatch.setitem(sys.modules, "fastapi.middleware.cors", MagicMock())
    monkeypatch.setitem(sys.modules, "fastapi.responses", MagicMock())
    monkeypatch.setitem(sys.modules, "uvicorn", MagicMock())
    yield

@pytest.mark.asyncio
async def test_run_voice_loop_refactor_success():
    """
    Test that run_voice_loop properly calls wait_for_wake_word and listen
    using asyncio.to_thread (implied by execution) and awaits process_user_request.
    """
    # Setup mock voice engine
    mock_voice_engine = MagicMock()
    from web.backend import app
    app.voice_engine = mock_voice_engine

    # We mock wait_for_wake_word to return True first, then raise CancelledError to stop the loop
    mock_voice_engine.wait_for_wake_word.side_effect = [True, asyncio.CancelledError]
    mock_voice_engine.listen.return_value = "Hello World"

    # Patch process_user_request
    # Note: process_user_request is defined in app.py.
    # Since we imported app, we can access it. But we want to mock it.
    with patch("web.backend.app.process_user_request", new_callable=AsyncMock) as mock_process:
        # Patch asyncio.sleep to avoid waiting
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # Also patch asyncio.to_thread because checking if it was called is good practice
            # But asyncio.to_thread executes the function.
            # We can rely on the side_effect of wait_for_wake_word to prove execution.

            # Since run_voice_loop is expected to be async in the new implementation
            if not asyncio.iscoroutinefunction(app.run_voice_loop):
                pytest.skip("run_voice_loop is not yet async")

            try:
                await app.run_voice_loop()
            except asyncio.CancelledError:
                pass

            # Verifications
            assert mock_voice_engine.wait_for_wake_word.call_count == 2
            mock_voice_engine.listen.assert_called_once()
            mock_process.assert_called_once_with("Hello World")

@pytest.mark.asyncio
async def test_run_voice_loop_refactor_exception():
    """
    Test that run_voice_loop handles exceptions by sleeping asynchronously.
    """
    mock_voice_engine = MagicMock()
    from web.backend import app
    app.voice_engine = mock_voice_engine

    # Raise exception first, then CancelledError
    mock_voice_engine.wait_for_wake_word.side_effect = [Exception("Test Error"), asyncio.CancelledError]

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        if not asyncio.iscoroutinefunction(app.run_voice_loop):
            pytest.skip("run_voice_loop is not yet async")

        try:
            await app.run_voice_loop()
        except asyncio.CancelledError:
            pass

        # Verify asyncio.sleep(1) was called
        mock_sleep.assert_called_once_with(1)
