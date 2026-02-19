import asyncio
import base64
import json
from utils.logger import logger
from web.backend.managers.connection_manager import manager
from services.llm.llm_service import LLMService
from services.audio.tts import TTSEngine
from services.plugin_manager import PluginManager

async def handle_plugin_notification(text: str):
    """Handle notifications from plugins (e.g., reminders)."""
    logger.info(f"PLUGIN NOTIFICATION: {text}")

    # Broadcast to frontend
    payload = {
        "type": "notification",
        "text": text,
        "level": "info"
    }
    await manager.broadcast(json.dumps(payload))

    # Speak if TTS is available
    if tts_engine and tts_engine.is_available:
        try:
            # Announce it
            await manager.broadcast(json.dumps({"status": "speaking"}))
            audio_bytes = await asyncio.to_thread(tts_engine.generate_audio_bytes, text)
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                await manager.broadcast(json.dumps({
                    "type": "audio",
                    "text": text,
                    "audio": audio_b64
                }))
            await manager.broadcast(json.dumps({"status": "idle"}))
        except Exception as e:
            logger.error(f"TTS Error in notification: {e}")

# Initialize Services
llm_service = LLMService()
tts_engine = TTSEngine()
plugin_manager = PluginManager()
plugin_manager.load_plugins()

async def process_user_request(user_text: str):
    logger.info(f"=== PROCESSING REQUEST: {user_text} ===")
    
    # 1. Prepare Context (RAG)
    memory_context = ""
    if hasattr(llm_service, 'memory_service') and llm_service.memory_service:
        try:
             relevant_memories = await asyncio.to_thread(llm_service.memory_service.query, user_text)
             if relevant_memories:
                 memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
        except Exception as e:
            logger.error(f"Memory Retrieval Error: {e}")

    # 2. Construct Messages
    messages = [
        {"role": "system", "content": f"You are EchoBot, a helpful and witty AI assistant.{memory_context}"},
        {"role": "user", "content": user_text}
    ]
    
    tools = plugin_manager.get_tool_definitions()
    
    # Run LLM
    try:
        response_message = await asyncio.to_thread(llm_service.get_response, messages, tools=tools)
    except Exception as e:
        await manager.broadcast(json.dumps({"type": "error", "text": str(e)}))
        return
    
    if isinstance(response_message, str):
        # Fallback if get_response returns string (mock message or error)
        # The new provider returns objects but we should handle it safely
        response_text = response_message
    else:
        response_text = getattr(response_message, 'content', "")

    if not response_text:
        response_text = "I'm sorry, I couldn't generate a response."

    # Memory Store
    if hasattr(llm_service, 'memory_service') and llm_service.memory_service:
        try:
            full_exchange = f"User: {user_text}\nAssistant: {response_text}"
            llm_service.memory_service.add(full_exchange)
        except Exception:
            pass
    
    # 3. TTS & Audio Response
    audio_b64 = None
    if tts_engine and tts_engine.is_available:
        try:
             await manager.broadcast(json.dumps({"status": "speaking"}))
             audio_bytes = await asyncio.to_thread(tts_engine.generate_audio_bytes, response_text)
             if audio_bytes:
                 audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as e:
             logger.error(f"TTS Error: {e}")

    payload = {
            "type": "audio",
            "text": response_text,
            "audio": audio_b64
    }
    await manager.broadcast(json.dumps(payload))
    
    if not audio_b64:
        await manager.broadcast(json.dumps({"status": "idle"}))
