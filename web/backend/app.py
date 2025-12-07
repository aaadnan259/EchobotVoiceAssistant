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
# from services.ml.intent_classifier import IntentClassifier

# Global Managers
plugin_manager = PluginManager()
plugin_manager.load_plugins()

# Initialize AI Services
llm_service = LLMService()
# intent_classifier = IntentClassifier() # Deprecated in favor of Function Calling

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
    google_api_key: str = ""
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
    
    # Redact key for logging
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
            
            # 1. Prepare Context (RAG)
            memory_context = ""
            if llm_service.memory_service:
                try:
                    relevant_memories = llm_service.memory_service.query(user_text)
                    if relevant_memories:
                        memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
                        logger.info(f"Retrieved Memory: {relevant_memories[:50]}...")
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
            response_message = llm_service.get_response(messages, tools=tools)
            
            # Handle Error
            if isinstance(response_message, str):
                await manager.broadcast(response_message)
                continue

            response_text = response_message.content

            # 5. Handle Tool Calls
            if response_message.tool_calls:
                # Append the assistant's tool call message to history
                messages.append(response_message)
                
                for tool_call in response_message.tool_calls:
                    function_name = tool_call.function.name
                    arguments = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"Executing tool: {function_name} with args: {arguments}")
                    result = plugin_manager.execute_tool(function_name, arguments)
                    
                    # Append tool result to history
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": str(result)
                    })
                
                # 6. Second LLM Call (Final Answer)
                # We don't pass tools here to force a text response, or we could if we want multi-step
                final_response = llm_service.get_response(messages)
                if isinstance(final_response, str):
                    response_text = final_response
                else:
                    response_text = final_response.content

            # 7. Store Interaction (Memory)
            if llm_service.memory_service and response_text:
                try:
                    full_exchange = f"User: {user_text}\nAssistant: {response_text}"
                    llm_service.memory_service.add(full_exchange)
                except Exception as e:
                    logger.error(f"Memory Storage Error: {e}")
            
            # 8. Send Response
            if response_text:
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
