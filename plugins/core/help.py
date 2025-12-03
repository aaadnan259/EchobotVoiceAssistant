from typing import Dict, Any
from services.plugin_manager import Plugin

class HelpPlugin(Plugin):
    name = "Help"
    description = "Lists available commands and features."
    intents = ["help"]

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        plugin_metadata = context.get("available_plugins", [])
        
        if not plugin_metadata:
            return "I can help you with weather, search, reminders, and more. Just ask!"

        response = "Here are the things I can do: "
        features = [p['name'] for p in plugin_metadata if p['name'] != "Help"]
        response += ", ".join(features) + "."
        return response
