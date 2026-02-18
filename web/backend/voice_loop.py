import asyncio
import json
from config.loader import ConfigLoader
from utils.logger import logger
from services.audio.voice_engine import VoiceEngine
from web.backend.websocket_manager import manager
from web.backend.interaction import process_user_request

voice_engine = None

async def run_voice_loop():
    global voice_engine
    if not voice_engine:
        return
    logger.info("Voice Input Loop Started")
    try:
        while True:
            try:
                # wait_for_wake_word blocks, run in thread
                detected = await asyncio.to_thread(voice_engine.wait_for_wake_word)
                if detected:
                     # listen blocks, run in thread
                     text = await asyncio.to_thread(voice_engine.listen)
                     if text:
                         # process_user_request is async, run directly
                         await process_user_request(text)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Error in voice loop: {e}")
                # Non-blocking sleep
                await asyncio.sleep(1)
    except asyncio.CancelledError:
        logger.info("Voice Input Loop Cancelled")

async def start_voice_loop():
    global voice_engine

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.error("No running event loop found")
        return None

    def status_callback(status, **kwargs):
        payload = {"status": status, **kwargs}
        if manager.active_connections:
            # We use run_coroutine_threadsafe because this callback might be called
            # from a thread if VoiceEngine spawns threads (though here it seems to run in loop executor)
            # But wait, VoiceEngine methods are called via asyncio.to_thread, so they run in a separate thread.
            # So we MUST use run_coroutine_threadsafe.
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(payload)), loop)

    if ConfigLoader.get("voice.enabled", False):
        try:
            voice_engine = VoiceEngine(status_callback=status_callback)
            # Start as asyncio Task instead of thread
            task = asyncio.create_task(run_voice_loop())
            logger.info("Voice Input Task Started")
            return task
        except Exception as e:
            logger.error(f"Failed to start voice engine: {e}")
            return None
    return None

async def stop_voice_loop(task):
    if task:
        logger.info("Cancelling Voice Input Task...")
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
