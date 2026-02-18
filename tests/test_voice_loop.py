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
sys.modules["config.loader"] = MagicMock()
sys.modules["utils.logger"] = MagicMock()

# Mock web.backend.websocket_manager
mock_ws_manager = MagicMock()
sys.modules["web.backend.websocket_manager"] = mock_ws_manager

# Mock web.backend.interaction
mock_interaction = MagicMock()
sys.modules["web.backend.interaction"] = mock_interaction

# We need to set up sys.path
sys.path.append(os.getcwd())

# Import voice_loop module
try:
    from web.backend import voice_loop
except ImportError as e:
    print(f"Failed to import voice_loop: {e}")
    sys.exit(1)

@pytest.mark.asyncio
async def test_run_voice_loop_refactor_success():
    """
    Test that run_voice_loop properly calls wait_for_wake_word and listen
    using asyncio.to_thread and awaits process_user_request.
    """
    # Setup mock voice engine
    mock_voice_engine = MagicMock()
    # We need to set the global voice_engine in voice_loop module
    voice_loop.voice_engine = mock_voice_engine

    # We mock wait_for_wake_word to return True first, then raise CancelledError to stop the loop
    # Note: wait_for_wake_word is called in a thread, so side_effect works fine.
    # The loop calls it, gets True.
    # Then calls listen.
    # Then calls process_user_request.
    # Then loops back and calls wait_for_wake_word again -> CancelledError.
    mock_voice_engine.wait_for_wake_word.side_effect = [True, asyncio.CancelledError]
    mock_voice_engine.listen.return_value = "Hello World"

    # Patch process_user_request where it is imported in voice_loop
    # Since we mocked web.backend.interaction, voice_loop.process_user_request is already a Mock (attribute of mock_interaction)
    # But wait, voice_loop does `from web.backend.interaction import process_user_request`
    # So `voice_loop.process_user_request` IS `mock_interaction.process_user_request`.

    mock_process = mock_interaction.process_user_request
    # Make it awaitable
    mock_process.side_effect = AsyncMock()

    # Patch asyncio.sleep to avoid waiting
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        try:
            await voice_loop.run_voice_loop()
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
    voice_loop.voice_engine = mock_voice_engine

    # Raise exception first, then CancelledError
    mock_voice_engine.wait_for_wake_word.side_effect = [Exception("Test Error"), asyncio.CancelledError]

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        try:
            await voice_loop.run_voice_loop()
        except asyncio.CancelledError:
            pass

        # Verify asyncio.sleep(1) was called
        mock_sleep.assert_called_once_with(1)
