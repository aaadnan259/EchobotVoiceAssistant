from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import json
import asyncio
import threading
from typing import List, Optional, Dict, Any
import os
import base64
from pydantic import BaseModel
import google.generativeai as genai

from config.loader import ConfigLoader
from services.plugin_manager import PluginManager
from services.audio.tts import TTSEngine
from services.audio.voice_engine import VoiceEngine
from utils.logger import logger
from services.llm.llm_service import LLMService

app = FastAPI(title="EchoBot Web UI")

class ChatRequest(BaseModel):
    modelName: str = "gemini-2.0-flash"
    systemInstruction: str
    history: List[Dict[str, Any]]
    newMessage: str
    images: Optional[List[str]] = None

# ... (omitted decode_image and endpoints for brevity) ...

# --- Core Processing Logic ---

async def process_user_request(user_text: str):
    logger.info(f"=== PROCESSING REQUEST ===")
    logger.info(f"User Text: {user_text}")
    
    # 1. Prepare Context (RAG)
    memory_context = ""
    # ... (memory logic same as before) ...
    if llm_service.memory_service:
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
    
    # 3. Get Tools
    tools = plugin_manager.get_tool_definitions()
    
    # 4. First LLM Call
    logger.info("Calling LLM Service (Round 1)...")
    response_message = await asyncio.to_thread(llm_service.get_response, messages, tools=tools)
    
    # Handle Error
    if isinstance(response_message, str):
        logger.error(f"LLM Error Response: {response_message}")
        await manager.broadcast(json.dumps({
            "type": "error",
            "text": response_message
        }))
        return

    response_text = getattr(response_message, 'content', "")
    logger.info(f"LLM Round 1 Response Type: {type(response_message)}")
    logger.info(f"LLM Round 1 Content: {response_text[:100]}...")

    # 5. Handle Tool Calls
    if hasattr(response_message, 'tool_calls') and response_message.tool_calls:
        logger.info(f"Tool calls detected: {len(response_message.tool_calls)}")
        messages.append(response_message)
        
        for tool_call in response_message.tool_calls:
            function_name = tool_call.function.name
            try:
                arguments = json.loads(tool_call.function.arguments)
            except:
                arguments = {}
            
            logger.info(f"Executing tool: {function_name} with args: {arguments}")
            result = await asyncio.to_thread(plugin_manager.execute_tool, function_name, arguments)
            
            messages.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": function_name,
                "content": str(result)
            })
        
        # 6. Second LLM Call
        logger.info("Calling LLM Service (Round 2 via Tool Output)...")
        final_response = await asyncio.to_thread(llm_service.get_response, messages)
        if isinstance(final_response, str):
            response_text = final_response
        else:
            response_text = final_response.content
        logger.info(f"LLM Round 2 Content: {response_text[:100]}...")

    # Check for empty response
    if not response_text:
        logger.warning("LLM returned empty response!")
        response_text = "I'm sorry, I couldn't generate a response."

    # 7. Store Interaction (Memory)
    # ... (memory storage logic same as before) ...

    # 8. Send Response to Frontend
    logger.info(f"Sending final response to frontend: {response_text[:50]}...")
    
    # Audio Logic
    audio_b64 = None
    if tts_engine and tts_engine.is_available:
             # ... (tts logic) ...
             try:
                await manager.broadcast(json.dumps({"status": "speaking"}))
                audio_bytes = await asyncio.to_thread(tts_engine.generate_audio_bytes, response_text)
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
             except Exception as e:
                logger.error(f"TTS Error: {e}")
    
    payload = {
            "type": "audio", # This type implies Text + Audio in frontend logic? or just 'response'? 
                             # Frontend implementation expects 'audio' type for bot response usually.
            "text": response_text,
            "audio": audio_b64
    }
    await manager.broadcast(json.dumps(payload))
    
    if not audio_b64:
            await manager.broadcast(json.dumps({"status": "idle"}))

# ... (Routes) ...

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We assume text messages for chat
            user_text = await websocket.receive_text()
            logger.info(f"WebSocket Received: {user_text}")
            
            # Start processing
            await process_user_request(user_text)
            
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

def run_web_server():
    host = ConfigLoader.get("web.host", "0.0.0.0")
    port = ConfigLoader.get("web.port", 8000)
    logger.info(f"Starting Web Server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_web_server()
