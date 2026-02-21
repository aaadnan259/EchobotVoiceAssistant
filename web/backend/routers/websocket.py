from fastapi import APIRouter, WebSocket
from web.backend.managers.connection_manager import manager
from utils.logger import logger
import asyncio
import json
import base64

# Note: We need to import 'process_user_request' logic. 
# Since 'process_user_request' ties together Voice, TTS, and LLM, it's 'Business Logic'
# It shouldn't arguably live inside the Router, but for now we will import it 
# or - better - we define the `process_request` logic in a service and call it here.
# But `process_user_request` in app.py uses `manager.broadcast`.
# To avoid circular imports, `process_user_request` should probably live in a Controller/Service
# that relies on the ConnectionManager.

# For this refactor, I will place the WebSocket endpoint here, 
# BUT the heavy `process_user_request` logic is currently in `app.py`.
# I should move `process_user_request` to a new `services/chat_orchestrator.py` or similar.

router = APIRouter(tags=["websocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # This logic depends on the event loop references and the processor
    # We will need to inject the processor or import it.
    # For now, let's assume we will refactor 'process_user_request' to:
    # from services.orchestrator import process_user_request
    
    # Since I haven't moved that yet, I'll stub it or expect it to be passed.
    # Actually, this is the trickiest part of the refactor.
    
    await manager.connect(websocket)
    try:
        from web.backend.services.orchestrator import process_user_request
        while True:
            user_text = await websocket.receive_text()
            logger.info(f"WebSocket Received: {user_text}")
            await process_user_request(user_text)
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)
