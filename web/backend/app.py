from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
import uvicorn
import json
import asyncio
import threading
from typing import List, Optional, Dict, Any
import os
import base64
from pydantic import BaseModel
from google import genai  # NEW SDK

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

def decode_image(base64_string: str):
    """Convert base64 string to dict for Gemini."""
    if not base64_string:
        return None
    if "base64," in base64_string:
        base64_string = base64_string.split("base64,")[1]
    
    # Return as Part object format or just bytes if client handles it
    # Client.models.generate_content supports bytes directly usually
    return {"mime_type": "image/jpeg", "data": base64_string}

@app.post("/api/gemini/chat")
async def gemini_chat(request: ChatRequest):
    api_key = ConfigLoader.get("ai.google_api_key")
    if not api_key:
         raise HTTPException(status_code=500, detail="Google API Key not configured on server")
    
    # NEW SDK INITIALIZATION
    client = genai.Client(api_key=api_key)
    
    # FORCE MODEL
    target_model = "gemini-2.0-flash"
    
    # Prepare history
    # New SDK expects: contents=[{'role': '...', 'parts': [{'text': '...'}]}]
    gemini_contents = []
    
    for msg in request.history:
        role = "user" if msg.get("role") == "user" else "model"
        parts = [{"text": msg.get("text", "")}]
        gemini_contents.append({"role": role, "parts": parts})
    
    # Current Message
    current_parts = [{"text": request.newMessage}]
    if request.images:
        for img_str in request.images:
            img_data = decode_image(img_str)
            if img_data:
                # Assuming img_data is compatible dict
                current_parts.append(img_data)
                
    # Add current message to user role
    # Note: 'chat' structure in new SDK is managed differently (client.chats.create) 
    # OR we can just append to contents and generate response.
    # To support streaming, client.models.generate_content_stream(contents=...) is best if stateless.
    # If stateful chat wanted: chat = client.chats.create(...)
    # Let's use start_chat equivalents if we want history preservation context easy?
    # Actually, generate_content_stream with full history is stateless standard.
    
    gemini_contents.append({"role": "user", "parts": current_parts})
    
    async def event_generator():
        try:
            # NEW SDK STREAMING
            response = client.models.generate_content_stream(
                model=target_model,
                contents=gemini_contents,
                config={'system_instruction': request.systemInstruction}
            )
            
            for chunk in response:
                if chunk.text:
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
         
    client = genai.Client(api_key=api_key)
    
    # FORCE MODEL
    target_model = "gemini-2.0-flash"

    response = client.models.generate_content(
        model=target_model,
        contents=[request.newMessage], # simplified
        config={'system_instruction': request.systemInstruction}
    )
    return {"text": response.text}


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static Files & Template Configuration (Robust Fix) ---
current_dir = os.path.dirname(os.path.abspath(__file__)) # web/backend
web_dir = os.path.dirname(current_dir) # web
project_root = os.path.dirname(web_dir) # EchoBot root

logger.info(f"=== PATH DEBUG ===")
logger.info(f"Current Directory: {current_dir}")
logger.info(f"Project Root: {project_root}")

# Determine Dist Directory
possible_dist_dirs = [
    os.path.join(project_root, "build"),
    os.path.join(project_root, "dist"),
    "/app/build",  # Docker absolute path fallback
    "/app/dist"
]

dist_dir = None
for path in possible_dist_dirs:
    if os.path.exists(path) and os.path.isdir(path):
        dist_dir = path
        logger.info(f"Found dist directory at: {dist_dir}")
        break

if dist_dir:
    # Check for index.html
    index_path = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_path):
        logger.info(f"Found index.html at: {index_path}")
    else:
        logger.warning(f"Dist dir exists but index.html NOT found at: {index_path}")

    # Mount assets
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
         app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
         logger.info(f"Mounted /assets from {assets_dir}")
    else:
         logger.warning(f"Assets directory not found at {assets_dir}")

else:
    logger.warning("No build/dist directory found! Falling back to dev mode/templates.")
    # Fallback/Dev
    static_dir = os.path.join(web_dir, "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    templates_dir = os.path.join(web_dir, "templates")
    if os.path.exists(templates_dir):
        templates = Jinja2Templates(directory=templates_dir)

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
    global voice_engine
    if not voice_engine:
        return
    while True:
        try:
            if voice_engine.wait_for_wake_word():
                 text = voice_engine.listen()
                 if text:
                     asyncio.run_coroutine_threadsafe(process_user_request(text), loop)
        except Exception:
            import time
            time.sleep(1)

@app.on_event("startup")
async def startup_event():
    global voice_engine
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    def status_callback(status, **kwargs):
        payload = {"status": status, **kwargs}
        if manager.active_connections and loop:
             asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(payload)), loop)

    if ConfigLoader.get("voice.enabled", False):
        try:
            voice_engine = VoiceEngine(status_callback=status_callback)
            if loop:
                t = threading.Thread(target=run_voice_loop, args=(loop,), daemon=True)
                t.start()
                logger.info("Voice Input Thread Started")
        except Exception as e:
            logger.error(f"Failed to start voice engine: {e}")

# --- Core Processing Logic ---
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

    # Tool execution (omitted for brevity in this fix, assuming text flow for now)
    # If using tools, LLMService needs to handle tool calls in new SDK format.
    # Current LLMService implementation (previous step) returned MockMessage(content=text) only.
    # So we proceed with response_text.

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


# --- Routes ---
@app.get("/")
async def serve_spa_root(request: Request):
    if dist_dir:
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    if 'templates' in globals():
         return templates.TemplateResponse(request=request, name="index.html")
    return {"error": "Frontend build not found."}

@app.get("/api/plugins")
async def get_plugins():
    return plugin_manager.get_all_plugins()

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
    return {"status": "success", "settings": settings}

@app.get("/api/debug/static")
def debug_static():
    """Debug endpoint to check static file setup."""
    result = {
        "current_dir": current_dir,
        "project_root": project_root,
        "dist_dir": dist_dir,
        "dist_exists": os.path.exists(dist_dir) if dist_dir else False,
        "contents": [],
        "index_exists": False
    }
    if dist_dir and os.path.exists(dist_dir):
        try:
            result["contents"] = os.listdir(dist_dir)
            result["index_exists"] = os.path.exists(os.path.join(dist_dir, "index.html"))
        except Exception as e:
            result["error"] = str(e)
    return result

@app.get("/{full_path:path}")
async def serve_spa_catchall(full_path: str, request: Request):
    if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not Found")
    if dist_dir:
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    if 'templates' in globals():
         return templates.TemplateResponse(request=request, name="index.html")
    return {"error": "Spa route not found"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            user_text = await websocket.receive_text()
            logger.info(f"WebSocket Received: {user_text}")
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
