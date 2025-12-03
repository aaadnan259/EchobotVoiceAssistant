import re
from typing import Dict, Any
from services.plugin_manager import Plugin

class CalculatorPlugin(Plugin):
    name = "Calculator"
    description = "Performs basic arithmetic calculations."
    intents = ["calculate"]

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        expression = entities.get("expression")
        if not expression:
            return "What would you like me to calculate?"
        
        # Security: Allow only digits and math operators
        cleaned_expr = re.sub(r'[^0-9+\-*/().]', '', expression)
        
        try:
            # Eval is dangerous, but with strict regex cleaning it's safer for a local bot
            result = eval(cleaned_expr)
            return f"The answer is {result}."
        except Exception:
            return "Sorry, I couldn't calculate that."
