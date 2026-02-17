
import sys
from unittest.mock import MagicMock, AsyncMock, patch
import asyncio
import pytest
import os

# Mock dependencies to avoid side effects during import
sys.modules["services.plugin_manager"] = MagicMock()
sys.modules["services.llm.llm_service"] = MagicMock()
sys.modules["services.audio.tts"] = MagicMock()
sys.modules["services.audio.voice_engine"] = MagicMock()
sys.modules["google.genai"] = MagicMock()
sys.modules["fastapi"] = MagicMock()
sys.modules["fastapi.staticfiles"] = MagicMock()
sys.modules["fastapi.templating"] = MagicMock()
sys.modules["fastapi.middleware.cors"] = MagicMock()
sys.modules["fastapi.responses"] = MagicMock()
sys.modules["uvicorn"] = MagicMock()

# We need to make sure we can import app
# Since app.py imports these, we need to mock them properly.
# The `app` object in app.py is FastAPI(). We mocked FastAPI, so app will be a MagicMock.

# We need to set up sys.path
sys.path.append(os.getcwd())

# Import app
try:
    from web.backend import app
except ImportError as e:
    print(f"Failed to import app: {e}")
    sys.exit(1)

@pytest.mark.asyncio
async def test_run_voice_loop_refactor_success():
    """
    Test that run_voice_loop properly calls wait_for_wake_word and listen
    using asyncio.to_thread (implied by execution) and awaits process_user_request.
    """
    # Setup mock voice engine
    mock_voice_engine = MagicMock()
    # We need to set the global voice_engine in app
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
