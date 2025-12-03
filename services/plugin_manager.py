import os
import importlib
import inspect
from typing import Dict, List, Any, Optional
from utils.logger import logger

class Plugin:
    """Base class for all EchoBot plugins."""
    name: str = "BasePlugin"
    description: str = "Base plugin description"
    intents: List[str] = [] # List of intent names this plugin handles

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Process the user request."""
        raise NotImplementedError("Plugins must implement handle()")

class PluginManager:
    """Manages the discovery, loading, and execution of plugins."""
    
    def __init__(self):
        self.plugins: Dict[str, Plugin] = {}
        self.intent_map: Dict[str, Plugin] = {}

    def load_plugins(self, plugin_dir: str = "plugins"):
        """Dynamically load plugins from the specified directory."""
        logger.info(f"Loading plugins from {plugin_dir}...")
        
        # Walk through the plugins directory
        base_path = os.path.abspath(plugin_dir)
        if not os.path.exists(base_path):
            logger.warning(f"Plugin directory {base_path} does not exist.")
            return

        for root, _, files in os.walk(base_path):
            for file in files:
                if file.endswith(".py") and not file.startswith("__"):
                    module_path = os.path.join(root, file)
                    self._load_plugin_from_file(module_path, base_path)

    def _load_plugin_from_file(self, file_path: str, base_path: str):
        """Load a specific plugin file."""
        try:
            # Convert file path to module path (e.g., plugins.standard.weather)
            rel_path = os.path.relpath(file_path, os.path.dirname(base_path))
            module_name = rel_path.replace(os.sep, ".").replace(".py", "")
            
            # Import the module
            spec = importlib.util.spec_from_file_location(module_name, file_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Find Plugin subclasses
            for name, obj in inspect.getmembers(module):
                if inspect.isclass(obj) and issubclass(obj, Plugin) and obj is not Plugin:
                    self._register_plugin(obj)
        except Exception as e:
            logger.error(f"Failed to load plugin from {file_path}: {e}")

    def _register_plugin(self, plugin_class):
        """Register a plugin class."""
        try:
            plugin_instance = plugin_class()
            self.plugins[plugin_instance.name] = plugin_instance
            
            for intent in plugin_instance.intents:
                self.intent_map[intent] = plugin_instance
                
            logger.info(f"Registered plugin: {plugin_instance.name} (Intents: {plugin_instance.intents})")
        except Exception as e:
            logger.error(f"Error registering plugin {plugin_class}: {e}")

    def get_plugin_for_intent(self, intent: str) -> Optional[Plugin]:
        """Retrieve the plugin responsible for a given intent."""
        return self.intent_map.get(intent)

    def get_all_plugins(self) -> List[Dict[str, Any]]:
        """Return metadata for all loaded plugins."""
        return [
            {"name": p.name, "description": p.description, "intents": p.intents}
            for p in self.plugins.values()
        ]
