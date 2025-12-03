import os
import yaml
from dotenv import load_dotenv
from typing import Any, Dict

# Load environment variables
load_dotenv()

class ConfigLoader:
    _settings: Dict[str, Any] = {}

    @classmethod
    def load_settings(cls, settings_path: str = "config/settings.yaml") -> Dict[str, Any]:
        """Load settings from YAML file and override with env vars."""
        if not os.path.exists(settings_path):
            # Fallback if running from a different directory
            settings_path = os.path.join(os.path.dirname(__file__), "settings.yaml")
        
        if os.path.exists(settings_path):
            with open(settings_path, "r") as f:
                cls._settings = yaml.safe_load(f)
        
        # Override with Environment Variables (Security)
        cls._inject_env_vars()
        return cls._settings

    @classmethod
    def _inject_env_vars(cls):
        """Inject sensitive keys from .env into the settings dict."""
        # API Keys
        if os.getenv("OPENAI_API_KEY"):
            cls._settings.setdefault("ai", {})["openai_api_key"] = os.getenv("OPENAI_API_KEY")
        if os.getenv("ELEVENLABS_API_KEY"):
            cls._settings.setdefault("voice", {})["elevenlabs_api_key"] = os.getenv("ELEVENLABS_API_KEY")
        if os.getenv("PORCUPINE_ACCESS_KEY"):
            cls._settings.setdefault("voice", {})["porcupine_access_key"] = os.getenv("PORCUPINE_ACCESS_KEY")
        if os.getenv("OPENWEATHER_API_KEY"):
            cls._settings.setdefault("plugins", {})["openweather_api_key"] = os.getenv("OPENWEATHER_API_KEY")

    @classmethod
    def get(cls, path: str, default: Any = None) -> Any:
        """Get a setting value using dot notation (e.g., 'voice.wake_word')."""
        keys = path.split(".")
        value = cls._settings
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return default
        return value if value is not None else default

# Initialize settings on import
ConfigLoader.load_settings()
