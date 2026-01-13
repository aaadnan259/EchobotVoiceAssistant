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
    modelName: str = "gemini-2.0-flash-exp"
    systemInstruction: str
    history: List[Dict[str, Any]]
    newMessage: str
    images: Optional[List[str]] = None

def decode_image(base64_string: str):
    """Convert base64 string to dict for Gemini."""
    if not base64_string:
        return None
    
    # Remove header if present (data:image/png;base64,...)
    if "base64," in base64_string:
        base64_string = base64_string.split("base64,")[1]
    
    # Simple mime type assumption (can be improved)
    return {
        "mime_type": "image/jpeg", 
        "data": base64_string
    }

@app.post("/api/gemini/chat")
async def gemini_chat(request: ChatRequest):
    api_key = ConfigLoader.get("ai.google_api_key")
    if not api_key:
         raise HTTPException(status_code=500, detail="Google API Key not configured on server")
    
    genai.configure(api_key=api_key)
    
    # Prepare history
    gemini_history = []
    
    # Filter and format history
    # System instruction is handled by model param, but we might want to manually prepend if needed
    # Gemini API supports system_instruction in GenerativeModel constructor
    
    # Transform history
    for msg in request.history:
        role = "user" if msg.get("role") == "user" else "model"
        parts = [msg.get("text", "")]
        
        # Handle images in history if they exist (Gemini supports mixed content)
        # Note: Sending previous images might be heavy. 
        # For this implementation, we might skip historical images to save bandwidth/tokens
        # unless strictly required. User only sends text/role in typical history.
        # But 'msg.images' might exist.
        
        gemini_history.append({"role": role, "parts": parts})
    
    # Current Message
    current_parts = [request.newMessage]
    if request.images:
        for img_str in request.images:
            img_data = decode_image(img_str)
            if img_data:
                current_parts.append(img_data)
                
    model = genai.GenerativeModel(
        model_name=request.modelName,
        system_instruction=request.systemInstruction
    )
    
    chat = model.start_chat(history=gemini_history)
    
    async def event_generator():
        try:
            # We use send_message_async with stream=True
            response = await chat.send_message_async(current_parts, stream=True)
            
            async for chunk in response:
                if chunk.text:
                    # SSE format: data: {...} \n\n
                    payload = json.dumps({"text": chunk.text})
                    yield f"data: {payload}\n\n"
                    
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            logger.error(f"Gemini Streaming Error: {e}")
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/gemini/chat-simple")
async def gemini_chat_simple(request: ChatRequest):
    """Non-streaming fallback"""
    api_key = ConfigLoader.get("ai.google_api_key")
    if not api_key:
         raise HTTPException(status_code=500, detail="Google API Key not configured")
         
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(
        model_name=request.modelName,
        system_instruction=request.systemInstruction
    )
    
    # Simplify for one-shot (ignoring history for brevity in simple mode or constructing it same as above)
    # Ideally should share logic.
    response = model.generate_content([request.newMessage])
    return {"text": response.text}


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static & Templates
current_dir = os.path.dirname(os.path.abspath(__file__)) # web/backend
web_dir = os.path.dirname(current_dir) # web
project_root = os.path.dirname(web_dir) # EchoBot root
dist_dir = os.path.join(project_root, "build") # Vite outputs to 'build' by default?? Or dist?
# Note: User instructions said 'dist/' usually. Checking Step 4, build dir exists.
# Vite default is dist, but user might have changed it. 
# Step 4 showed 'build' dir. I'll assume 'build' or 'dist'.
# Let's check if 'dist' exists in root? Step 4 only showed 'build' folder.
# So I'll stick to 'build' if passing to checking.
if not os.path.exists(dist_dir):
    dist_dir = os.path.join(project_root, "dist") # Fallback

if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")
else:
    # Fallback/Dev
    app.mount("/static", StaticFiles(directory=os.path.join(web_dir, "static")), name="static")
    templates = Jinja2Templates(directory=os.path.join(web_dir, "templates"))

# Global Managers
plugin_manager = PluginManager()
plugin_manager.load_plugins()

# Initialize AI Services
llm_service = LLMService()
tts_engine = TTSEngine()
voice_engine = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# --- Voice Loop Integration ---

def run_voice_loop(loop):
    """Refactored voice loop to run in thread."""
    global voice_engine
    if not voice_engine:
        return

    while True:
        try:
            if voice_engine.wait_for_wake_word():
                 # Status 'listening' emitted by engine callback
                 text = voice_engine.listen()
                 if text:
                     # Status 'processing' emitted by engine callback
                     
                     # Process Command
                     asyncio.run_coroutine_threadsafe(process_user_request(text), loop)
        except Exception as e:
            logger.error(f"Voice Loop Error: {e}")
            # Prevent rapid loop on error
            import time
            time.sleep(1)

@app.on_event("startup")
async def startup_event():
    global voice_engine
    loop = asyncio.get_running_loop()

    def status_callback(status, **kwargs):
        payload = {"status": status, **kwargs}
        if manager.active_connections:
             # Broadcast status to UI
             asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(payload)), loop)

    try:
        voice_engine = VoiceEngine(status_callback=status_callback)
        # Start Voice Thread
        t = threading.Thread(target=run_voice_loop, args=(loop,), daemon=True)
        t.start()
        logger.info("Voice Input Thread Started")
    except Exception as e:
        logger.error(f"Failed to start voice engine: {e}")

# --- Core Processing Logic ---

async def process_user_request(user_text: str):
    logger.info(f"Processing: {user_text}")
    
    # 1. Prepare Context (RAG)
    memory_context = ""
    if llm_service.memory_service:
        try:
            relevant_memories = await asyncio.to_thread(llm_service.memory_service.query, user_text)
            if relevant_memories:
                memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
                # logger.info(f"Retrieved Memory: {relevant_memories[:50]}...")
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
    response_message = await asyncio.to_thread(llm_service.get_response, messages, tools=tools)
    
    # Handle Error
    if isinstance(response_message, str):
        await manager.broadcast(json.dumps({
            "type": "error",
            "text": response_message
        }))
        return

    response_text = response_message.content

    # 5. Handle Tool Calls
    if response_message.tool_calls:
        messages.append(response_message)
        
        for tool_call in response_message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            
            logger.info(f"Executing tool: {function_name} with args: {arguments}")
            result = await asyncio.to_thread(plugin_manager.execute_tool, function_name, arguments)
            
            messages.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": function_name,
                "content": str(result)
            })
        
        # 6. Second LLM Call
        final_response = await asyncio.to_thread(llm_service.get_response, messages)
        if isinstance(final_response, str):
            response_text = final_response
        else:
            response_text = final_response.content

    # 7. Store Interaction (Memory)
    if llm_service.memory_service and response_text:
        try:
            full_exchange = f"User: {user_text}\nAssistant: {response_text}"
            # await asyncio.to_thread(llm_service.memory_service.add, full_exchange) 
            # Assuming sync memory service
            llm_service.memory_service.add(full_exchange)
        except Exception as e:
            logger.error(f"Memory Storage Error: {e}")
    
    # 8. Send Response with Audio
    if response_text:
        audio_b64 = None
        if tts_engine and tts_engine.is_available:
                try:
                    # Notify UI we are speaking (pre-buffer)
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
        # After audio sent, frontend handles 'idle' when playback finishes
        # But we can also set idle here if no audio?
        if not audio_b64:
             await manager.broadcast(json.dumps({"status": "idle"}))

# --- Routes ---

@app.get("/")
async def get(request: Request):
    if os.path.exists(os.path.join(dist_dir, "index.html")):
        from fastapi.responses import FileResponse
        return FileResponse(os.path.join(dist_dir, "index.html"))
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/api/plugins")
async def get_plugins():
    return plugin_manager.get_all_plugins()

from pydantic import BaseModel

class SettingsUpdate(BaseModel):
    google_api_key: str = ""
    voice_speed: float = 1.0
    wake_word_sensitivity: float = 0.5

@app.get("/api/settings")
async def get_settings():
    return ConfigLoader._settings

@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    settings_safe = settings.dict()
    settings_safe["google_api_key"] = "REDACTED"
    logger.info(f"Settings updated: {settings_safe}")
    return {"status": "success", "settings": settings}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            user_text = await websocket.receive_text()
            logger.info(f"Web User: {user_text}")
            await process_user_request(user_text)
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

def run_web_server():
    host = ConfigLoader.get("web.host", "0.0.0.0")
    port = ConfigLoader.get("web.port", 8000)
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_web_server()
