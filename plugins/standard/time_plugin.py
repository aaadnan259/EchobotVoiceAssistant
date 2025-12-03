from datetime import datetime
from typing import Dict, Any
from services.plugin_manager import Plugin

class TimePlugin(Plugin):
    name = "Time"
    description = "Tells the current date and time."
    intents = ["time", "date"]

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        now = datetime.now()
        if intent == "time":
            return f"It is currently {now.strftime('%I:%M %p')}."
        elif intent == "date":
            return f"Today is {now.strftime('%A, %B %d, %Y')}."
        return ""
