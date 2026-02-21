from fastapi import APIRouter
from pydantic import BaseModel
from config.loader import ConfigLoader
from services.plugin_manager import PluginManager

router = APIRouter(prefix="/api", tags=["settings"])
plugin_manager = PluginManager()
plugin_manager.load_plugins()

class SettingsUpdate(BaseModel):
    google_api_key: str = ""
    voice_speed: float = 1.0
    wake_word_sensitivity: float = 0.5

@router.get("/plugins")
async def get_plugins():
    return plugin_manager.get_all_plugins()

@router.get("/settings")
async def get_settings():
    return ConfigLoader._settings

@router.post("/settings")
async def update_settings(settings: SettingsUpdate):
    # Logic from app.py
    settings_safe = settings.dict()
    settings_safe["google_api_key"] = "REDACTED"
    return {"status": "success", "settings": settings}
