from services.plugin_manager import PluginManager
from services.audio.tts import TTSEngine
from services.llm.llm_service import LLMService

# Global Managers
plugin_manager = PluginManager()
plugin_manager.load_plugins()

# Initialize AI Services
llm_service = LLMService()
tts_engine = TTSEngine()
