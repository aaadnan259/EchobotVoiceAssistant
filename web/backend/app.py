from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import os
import base64
from pydantic import BaseModel
from google import genai

from config.loader import ConfigLoader
from utils.logger import logger

# New modules
from web.backend.services import plugin_manager
from web.backend.websocket_manager import manager
from web.backend.voice_loop import start_voice_loop, stop_voice_loop
from web.backend.interaction import process_user_request
from web.backend.static_utils import mount_static_files

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown."""
    voice_task = await start_voice_loop()
    
    yield  # App runs here
    
    await stop_voice_loop(voice_task)
    logger.info("Shutting down EchoBot...")

app = FastAPI(title="EchoBot Web UI", lifespan=lifespan)

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
    
    # Detect MIME type from data URI header
    mime_type = "image/jpeg"  # default
    if "base64," in base64_string:
        header = base64_string.split("base64,")[0]
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"
        elif "image/gif" in header:
            mime_type = "image/gif"
        base64_string = base64_string.split("base64,")[1]
    
    return {"mime_type": mime_type, "data": base64_string}

@app.post("/api/gemini/chat")
async def gemini_chat(request: ChatRequest):
    api_key = ConfigLoader.get("ai.google_api_key")
    if not api_key:
         raise HTTPException(status_code=500, detail="Google API Key not configured on server")
    
    # NEW SDK INITIALIZATION
    client = genai.Client(api_key=api_key)
    target_model = "gemini-2.0-flash"

    # Format history for Gemini SDK
    gemini_contents = []
    
    for msg in request.history:
        role = "user" if msg.get("role") == "user" else "model"
        parts = [{"text": msg.get("text", "")}]
        gemini_contents.append({"role": role, "parts": parts})
    
    # Process current message and images
    current_parts = [{"text": request.newMessage}]
    if request.images:
        for img_str in request.images:
            img_data = decode_image(img_str)
            if img_data:
                current_parts.append(img_data)
    
    gemini_contents.append({"role": "user", "parts": current_parts})
    
    async def event_generator():
        try:
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
    """Non-streaming request."""
    api_key = ConfigLoader.get("ai.google_api_key")
    if not api_key:
         raise HTTPException(status_code=500, detail="Google API Key not configured")
         
    client = genai.Client(api_key=api_key)
    target_model = "gemini-2.0-flash"

    response = client.models.generate_content(
        model=target_model,
        contents=[request.newMessage],
        config={'system_instruction': request.systemInstruction}
    )
    return {"text": response.text}


# CORS - Restrict to known origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite dev server
    "http://localhost:8000",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# --- Static Files & Template Configuration ---
dist_dir, templates = mount_static_files(app)

# --- Routes ---
@app.get("/")
async def serve_spa_root(request: Request):
    if dist_dir:
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    if templates:
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

@app.get("/{full_path:path}")
async def serve_spa_catchall(full_path: str, request: Request):
    if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not Found")
    if dist_dir:
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    if templates:
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
