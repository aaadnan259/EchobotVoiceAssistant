from fastapi import FastAPI, WebSocket, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import asyncio
from typing import List

from config.loader import ConfigLoader
from services.plugin_manager import PluginManager
from utils.logger import logger

app = FastAPI(title="EchoBot Web UI")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

# Static & Templates
# Get absolute path to the 'web' directory
current_dir = os.path.dirname(os.path.abspath(__file__)) # web/backend
web_dir = os.path.dirname(current_dir) # web
project_root = os.path.dirname(web_dir) # EchoBot root
dist_dir = os.path.join(project_root, "build") # Vite outputs to 'build' in root

# Serve React Static Files (Production)
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")
    # We don't mount "/" to StaticFiles directly to allow API routes to work.
    # Instead we serve index.html in the root catch-all.
else:
    # Fallback for dev mode or if build is missing
    app.mount("/static", StaticFiles(directory=os.path.join(web_dir, "static")), name="static")
    templates = Jinja2Templates(directory=os.path.join(web_dir, "templates"))

from services.llm.llm_service import LLMService
from services.ml.intent_classifier import IntentClassifier

# Global Managers
plugin_manager = PluginManager()
plugin_manager.load_plugins()

# Initialize AI Services
llm_service = LLMService()
intent_classifier = IntentClassifier()
intent_classifier.load()

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
    openai_api_key: str = ""
    voice_speed: float = 1.0
    wake_word_sensitivity: float = 0.5

@app.get("/api/settings")
async def get_settings():
    return ConfigLoader._settings

@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    # In a real app, we would save this to the yaml file
    # For now, we'll just update the in-memory config
    # ConfigLoader.update(settings.dict())
    logger.info(f"Settings updated: {settings}")
    return {"status": "success", "settings": settings}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            user_text = await websocket.receive_text()
            logger.info(f"Web User: {user_text}")
            
            # 1. Intent Classification
            intent, confidence = intent_classifier.predict(user_text)
            logger.info(f"Predicted Intent: {intent} ({confidence})")
            
            response_text = ""
            
            # 2. Routing
            if intent == "chat":
                response_text = llm_service.chat(user_text)
            else:
                plugin = plugin_manager.get_plugin_for_intent(intent)
                if plugin:
                    try:
                        # Execute plugin (assuming synchronous for now, or wrap in asyncio.to_thread if blocking)
                        # Most plugins return a string or dict
                        result = plugin.execute(user_text)
                        response_text = str(result)
                    except Exception as e:
                        logger.error(f"Plugin error: {e}")
                        response_text = f"I encountered an error with the {intent} plugin."
                else:
                    # Fallback to LLM if no plugin found for intent
                    response_text = llm_service.chat(user_text)
            
            # 3. Send Response
            await manager.broadcast(response_text)
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

def run_web_server():
    host = ConfigLoader.get("web.host", "0.0.0.0")
    port = ConfigLoader.get("web.port", 8000)
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_web_server()
