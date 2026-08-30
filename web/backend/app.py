from fastapi import FastAPI, WebSocket, Request, HTTPException, WebSocketDisconnect, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
import uvicorn
import json
import uuid
import asyncio
import time
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import os
import base64
from pydantic import BaseModel
from google import genai  # NEW SDK
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request as StarletteRequest
from fastapi.responses import JSONResponse

from config.loader import ConfigLoader
from services.plugin_manager import PluginManager
from services.audio.tts import TTSEngine
from services.audio.voice_engine import VoiceEngine
from utils.logger import logger
from services.llm.llm_service import LLMService

# Global state
voice_engine = None
gemini_client = None

# Cached "last known good" LLM signal (F6). Updated opportunistically by the two
# real chat endpoints (gemini_chat, gemini_chat_simple) whenever they call the real
# gemini_client -- no new outbound call is made solely for health-checking purposes.
# NOT updated by llm_service/process_user_request: that path is never reached by the
# deployed web server (see Workstream 5 investigation), so tracking it would track a
# signal that never fires. A single tuple is used (not two separate variables) so
# each update is one atomic Python statement, with no intervening `await` -- see the
# Workstream 4 implementation report for the full concurrency reasoning.
_llm_last_attempt: Optional[tuple] = None  # (monotonic_timestamp: float, succeeded: bool)
LLM_HEALTH_RECENCY_WINDOW_SECONDS = 300  # 5 minutes

def _record_llm_attempt(success: bool) -> None:
    """Record the outcome of a real Gemini call from the live chat endpoints only.
    Must only ever be called from the awaiting coroutine (never from inside a
    callable passed to asyncio.to_thread) so this mutation always happens on the
    single event-loop thread."""
    global _llm_last_attempt
    _llm_last_attempt = (time.monotonic(), success)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown."""
    global voice_engine, gemini_client
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    # Initialize Gemini Client
    api_key = ConfigLoader.get("ai.google_api_key")
    if api_key:
        try:
             gemini_client = genai.Client(api_key=api_key)
             logger.info("Shared Gemini Client Initialized")
        except Exception as e:
             logger.error(f"Failed to initialize Shared Gemini Client: {e}")

    def status_callback(status, **kwargs):
        payload = {"status": status, **kwargs}
        if manager.active_connections and loop:
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(payload)), loop)

    def plugin_callback_wrapper(event_type, data):
        if event_type == "notification" and loop:
            text = data.get("text")
            if text:
                asyncio.run_coroutine_threadsafe(handle_plugin_notification(text), loop)

    if plugin_manager:
        plugin_manager.set_plugin_callback(plugin_callback_wrapper)

    voice_task = None
    if ConfigLoader.get("voice.enabled", False):
        try:
            voice_engine = VoiceEngine(status_callback=status_callback)
            # Start as asyncio Task instead of thread
            voice_task = asyncio.create_task(run_voice_loop())
            logger.info("Voice Input Task Started")
        except Exception as e:
            logger.error(f"Failed to start voice engine: {e}")
    
    yield  # App runs here
    
    # Shutdown cleanup
    if voice_task:
        logger.info("Cancelling Voice Input Task...")
        voice_task.cancel()
        try:
            await voice_task
        except asyncio.CancelledError:
            pass

    logger.info("Shutting down EchoBot...")

app = FastAPI(title="EchoBot Web UI", lifespan=lifespan)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: StarletteRequest, exc: RateLimitExceeded):
    retry_after = getattr(exc, 'retry_after', 60)
    return JSONResponse(
        status_code=429,
        content={"error": "rate limited"},
        headers={"Retry-After": str(retry_after)},
    )

class ChatRequest(BaseModel):
    modelName: str = "gemini-2.5-flash"
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

# Model allowlist (D4) — env-configurable
ALLOWED_MODELS = [m.strip() for m in os.environ.get(
    "GEMINI_ALLOWED_MODELS", "gemini-2.5-flash,gemini-2.5-flash-lite"
).split(",")]
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", ConfigLoader.get("ai.llm_model", "gemini-2.5-flash"))

def get_validated_model(requested: str) -> str:
    """Return requested model if allowed, else default. Log rejected requests."""
    if requested in ALLOWED_MODELS:
        return requested
    logger.warning(f"Rejected model '{requested}', falling back to '{DEFAULT_MODEL}'")
    return DEFAULT_MODEL

def build_gemini_contents(request: ChatRequest) -> list:
    """Build Gemini SDK contents from a ChatRequest. Single source of truth."""
    contents = []
    for msg in request.history:
        role = "user" if msg.get("role") == "user" else "model"
        parts = [{"text": msg.get("text", "")}]
        contents.append({"role": role, "parts": parts})

    current_parts = [{"text": request.newMessage}]
    if request.images:
        for img_str in request.images:
            img_data = decode_image(img_str)
            if img_data:
                current_parts.append(img_data)

    contents.append({"role": "user", "parts": current_parts})
    return contents

RATE_LIMIT_CHAT = os.environ.get("RATE_LIMIT_CHAT", "10/minute")

from web.backend.auth import create_session_token, validate_session_token, SESSION_MAX_AGE

@app.get("/api/session")
@limiter.limit("20/minute")
async def get_session(request: Request):
    token = create_session_token()
    return {"token": token, "expiresIn": SESSION_MAX_AGE}

async def require_valid_token(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = auth_header[7:]
    payload = validate_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

@app.post("/api/gemini/chat")
@limiter.limit(RATE_LIMIT_CHAT)
async def gemini_chat(chat_request: ChatRequest, request: Request, _token=Depends(require_valid_token)):
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured")

    model = get_validated_model(chat_request.modelName)
    contents = build_gemini_contents(chat_request)
    server_preamble = os.environ.get("SERVER_SYSTEM_PREAMBLE", "")
    client_inst = (chat_request.systemInstruction or "")[:4000]
    final_inst = f"{server_preamble}\n{client_inst}".strip()
    config_dict = {"system_instruction": final_inst} if final_inst else None

    async def event_generator():
        try:
            if hasattr(gemini_client, 'aio'):
                response = await gemini_client.aio.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=config_dict,
                )
                async for chunk in response:
                    if chunk.text:
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            else:
                response = await asyncio.to_thread(
                    gemini_client.models.generate_content_stream,
                    model=model,
                    contents=contents,
                    config=config_dict,
                )
                for chunk in response:
                    if chunk.text:
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                        await asyncio.sleep(0)
                        
            _record_llm_attempt(True)
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            _record_llm_attempt(False)
            logger.error(f"Gemini Streaming Error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/gemini/chat-simple")
@limiter.limit(RATE_LIMIT_CHAT)
async def gemini_chat_simple(chat_request: ChatRequest, request: Request, _token=Depends(require_valid_token)):
    """Non-streaming request."""
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured")

    model = get_validated_model(chat_request.modelName)
    contents = build_gemini_contents(chat_request)  # Now respects history + images
    server_preamble = os.environ.get("SERVER_SYSTEM_PREAMBLE", "")
    client_inst = (chat_request.systemInstruction or "")[:4000]
    final_inst = f"{server_preamble}\n{client_inst}".strip()
    config_dict = {"system_instruction": final_inst} if final_inst else None

    try:
        if hasattr(gemini_client, 'aio'):
            response = await gemini_client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config_dict,
            )
        else:
            response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model=model,
                contents=contents,
                config=config_dict,
            )
    except Exception:
        # Record the outcome for the health signal (F6) and re-raise the exact
        # original exception unchanged -- this endpoint's error-response shape
        # (a generic FastAPI 500 with no leaked detail) is F4's territory and is
        # deliberately not touched here.
        _record_llm_attempt(False)
        raise
    _record_llm_attempt(True)
    return {"text": response.text}


# CORS - Restrict to known origins
is_prod = os.environ.get("RENDER") is not None
if is_prod:
    frontend_url = os.environ.get("FRONTEND_URL", "").strip()
    ALLOWED_ORIGINS = [frontend_url] if frontend_url else []
    if not ALLOWED_ORIGINS:
        logger.warning(
            "FRONTEND_URL is not set in production; CORS will deny all cross-origin requests."
        )
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    # NOTE: no wildcard fallback here. An empty ALLOWED_ORIGINS list (e.g. production
    # with FRONTEND_URL unset/empty) must resolve to an explicit deny-all, not "*" -
    # Starlette's CORSMiddleware combined with allow_credentials=True reflects the
    # request's Origin header when "*" is present, which fails open for any origin.
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

def _llm_health_signal() -> bool:
    """F6: report a recency-bounded real call outcome when one exists, falling back
    to the original startup-time proxy (gemini_client is not None) both when no chat
    attempt has been made yet this process lifetime, and when the last one is older
    than the recency window (so a single old failure cannot haunt this field
    forever once it's stale). No new outbound network call is made here or anywhere
    else in this function -- this only reads already-recorded in-process state."""
    if _llm_last_attempt is None:
        return gemini_client is not None
    last_at, last_ok = _llm_last_attempt
    if (time.monotonic() - last_at) <= LLM_HEALTH_RECENCY_WINDOW_SECONDS:
        return last_ok
    return gemini_client is not None

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0",
        "environment": "production" if is_prod else "development",
        "services": {
            "llm": _llm_health_signal(),
            "tts": tts_engine.is_available if tts_engine else False,
            "voice": voice_engine is not None
        }
    }

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
else:
    logger.warning("No build/dist directory found! Ensure you have run 'npm run build'.")

# Global Managers
ENABLE_PLUGINS = os.environ.get("FEATURES_PLUGINS", "false").lower() == "true"
plugin_manager = PluginManager() if ENABLE_PLUGINS else None
if plugin_manager:
    plugin_manager.load_plugins()

# Initialize AI Services
llm_service = LLMService()
if not ENABLE_PLUGINS:
    llm_service.memory_service = None  # Force disable ChromaDB/Memory
tts_engine = TTSEngine()
voice_engine = None

MAX_WS_CONNECTIONS_PER_IP = int(os.environ.get("MAX_WS_PER_IP", "5"))

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        client_ip = websocket.client.host if websocket.client else "unknown"
        ip_connections = sum(
            1 for c in self.active_connections
            if c.client and c.client.host == client_ip
        )
        if ip_connections >= MAX_WS_CONNECTIONS_PER_IP:
            await websocket.close(code=1008, reason="too many connections")
            return False
        await websocket.accept()
        self.active_connections.append(websocket)
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_to(self, websocket: WebSocket, message: str):
        try:
            await websocket.send_text(message)
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# --- Plugin Notification Handler ---
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

# --- Voice Loop Integration ---
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

# --- Core Processing Logic ---
async def process_user_request(user_text: str, websocket: WebSocket = None):
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
    
    tools = plugin_manager.get_tool_definitions() if plugin_manager else None
    
    response_message = await asyncio.to_thread(llm_service.get_response, messages, tools=tools)
    
    if isinstance(response_message, str):
        payload_str = json.dumps({"type": "error", "text": response_message})
        if websocket:
            await manager.send_to(websocket, payload_str)
        else:
            await manager.broadcast(payload_str)
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
    payload_str = json.dumps(payload)
    if websocket:
        await manager.send_to(websocket, payload_str)
    else:
        await manager.broadcast(payload_str)
        
    if not audio_b64:
        await manager.broadcast(json.dumps({"status": "idle"}))


# --- Routes ---
@app.get("/{full_path:path}")
async def serve_spa(full_path: str, request: Request):
    if full_path.startswith("api/") or full_path.startswith("ws"):
        raise HTTPException(status_code=404, detail="Not Found")
        
    if not dist_dir:
        return JSONResponse(
            status_code=500, 
            content={"error": "Frontend not built \u2014 run npm run build"}
        )

    # 1. Path traversal guard
    target_path = os.path.join(dist_dir, full_path) if full_path else os.path.join(dist_dir, "index.html")
    real_target = os.path.realpath(target_path)
    real_dist = os.path.realpath(dist_dir)
    
    if not real_target.startswith(real_dist):
        raise HTTPException(status_code=404, detail="Not Found")

    # 2. Serve file if it exists, else fallback to index.html for SPA routing
    if os.path.exists(real_target) and os.path.isfile(real_target):
        file_to_serve = real_target
    else:
        file_to_serve = os.path.join(real_dist, "index.html")
        if not os.path.exists(file_to_serve):
            return JSONResponse(
                status_code=500, 
                content={"error": "Frontend not built \u2014 run npm run build"}
            )

    # 3. Cache-Control headers
    headers = {}
    if file_to_serve.endswith("index.html") or file_to_serve.endswith("sw.js"):
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    elif "assets" in file_to_serve:
        headers["Cache-Control"] = "public, max-age=31536000, immutable"

    import mimetypes
    media_type, _ = mimetypes.guess_type(file_to_serve)
    
    return FileResponse(file_to_serve, headers=headers, media_type=media_type)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    if not await manager.connect(websocket):
        return
    try:
        while True:
            raw = await websocket.receive_text()
            # Parse JSON envelope
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_to(websocket, json.dumps(
                    {"type": "error", "text": "invalid message format"}
                ))
                continue

            msg_type = msg.get("type")

            if msg_type == "auth":
                token = msg.get("token")
                payload = validate_session_token(token) if token else None
                if payload:
                    session_id = payload.get("sid", str(uuid.uuid4()))
                    await manager.send_to(websocket, json.dumps({
                        "type": "auth_response",
                        "success": True,
                        "sessionId": session_id,
                    }))
                else:
                    await manager.send_to(websocket, json.dumps({
                        "type": "auth_response",
                        "success": False,
                        "message": "invalid token"
                    }))
                    await websocket.close(code=1008)
                    return

            elif msg_type == "ping":
                await manager.send_to(websocket, json.dumps({"type": "pong"}))

            else:
                # No chat type (D1). Unknown types get an error frame.
                await manager.send_to(websocket, json.dumps(
                    {"type": "error", "text": f"unknown message type: {msg_type}"}
                ))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)

def run_web_server():
    host = ConfigLoader.get("web.host", "0.0.0.0")
    port = ConfigLoader.get("web.port", 8000)
    logger.info(f"Starting Web Server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, proxy_headers=True, forwarded_allow_ips="*")

if __name__ == "__main__":
    run_web_server()
