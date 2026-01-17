import os
import yaml
import logging
from dotenv import load_dotenv
from typing import Any, Dict

# Use standard logging to avoid circular import with utils.logger
logger = logging.getLogger(__name__)

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
        logger.debug("=== CONFIG LOADING ===")
        
        # API Keys - Check both GEMINI and GOOGLE
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        logger.debug(f"GEMINI_API_KEY env var exists: {bool(os.getenv('GEMINI_API_KEY'))}")
        logger.debug(f"GOOGLE_API_KEY env var exists: {bool(os.getenv('GOOGLE_API_KEY'))}")
        logger.debug(f"Final API key loaded: {bool(gemini_key)}")
        
        if gemini_key:
            cls._settings.setdefault("ai", {})["google_api_key"] = gemini_key
            logger.debug(f"API key length: {len(gemini_key)}")
        else:
            logger.warning("No Gemini API key found!")

        if os.getenv("OPENAI_API_KEY"):
            cls._settings.setdefault("ai", {})["openai_api_key"] = os.getenv("OPENAI_API_KEY")
        if os.getenv("ELEVENLABS_API_KEY"):
            cls._settings.setdefault("voice", {})["elevenlabs_api_key"] = os.getenv("ELEVENLABS_API_KEY")
        if os.getenv("GEMINI_MODEL"):
            env_model = os.getenv("GEMINI_MODEL")
            logger.debug(f"GEMINI_MODEL env var found! Overriding to: {env_model}")
            cls._settings.setdefault("ai", {})["llm_model"] = env_model
        else:
            # Default to gemini-2.0-flash if not set in env or yaml
            if "ai" in cls._settings and "llm_model" not in cls._settings.get("ai", {}):
                cls._settings.setdefault("ai", {})["llm_model"] = "gemini-2.0-flash"
            logger.debug(f"Using model from settings: {cls._settings.get('ai', {}).get('llm_model')}")
        if os.getenv("PORCUPINE_ACCESS_KEY"):
            cls._settings.setdefault("voice", {})["porcupine_access_key"] = os.getenv("PORCUPINE_ACCESS_KEY")
        if os.getenv("OPENWEATHER_API_KEY"):
            cls._settings.setdefault("plugins", {})["openweather_api_key"] = os.getenv("OPENWEATHER_API_KEY")
        
        # Web Config
        if os.getenv("PORT"):
            cls._settings.setdefault("web", {})["port"] = int(os.getenv("PORT"))

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
