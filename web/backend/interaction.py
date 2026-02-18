import asyncio
import json
import base64
from utils.logger import logger
from web.backend.websocket_manager import manager
from web.backend.services import llm_service, tts_engine, plugin_manager

async def process_user_request(user_text: str):
    logger.info(f"=== PROCESSING REQUEST: {user_text} ===")

    # 1. Prepare Context (RAG)
    memory_context = ""
    if llm_service.memory_service:
        try:
             relevant_memories = await asyncio.to_thread(llm_service.memory_service.query, user_text)
             if relevant_memories:
                 memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
        except Exception as e:
            logger.error(f"Memory Retrieval Error: {e}")

    # 2. Construct Messages
    # Note: LLMService is now using new SDK but get_response signature handles formatting
    messages = [
        {"role": "system", "content": f"You are EchoBot, a helpful and witty AI assistant.{memory_context}"},
        {"role": "user", "content": user_text}
    ]

    tools = plugin_manager.get_tool_definitions()

    response_message = await asyncio.to_thread(llm_service.get_response, messages, tools=tools)

    if isinstance(response_message, str):
        await manager.broadcast(json.dumps({"type": "error", "text": response_message}))
        return

    response_text = getattr(response_message, 'content', "")

    # Proceed with text response


    if not response_text:
        response_text = "I'm sorry, I couldn't generate a response."

    # Memory
    if llm_service.memory_service:
        try:
            full_exchange = f"User: {user_text}\nAssistant: {response_text}"
            llm_service.memory_service.add(full_exchange)
        except Exception:
            pass

    # Response
    audio_b64 = None
    if tts_engine and tts_engine.is_available:
        try:
             await manager.broadcast(json.dumps({"status": "speaking"}))
             audio_bytes = await asyncio.to_thread(tts_engine.generate_audio_bytes, response_text)
             if audio_bytes:
                 audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        except Exception:
             pass

    payload = {
            "type": "audio",
            "text": response_text,
            "audio": audio_b64
    }
    await manager.broadcast(json.dumps(payload))
    if not audio_b64:
        await manager.broadcast(json.dumps({"status": "idle"}))
