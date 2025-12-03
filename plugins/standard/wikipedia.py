import wikipedia
from typing import Dict, Any
from services.plugin_manager import Plugin
from utils.logger import logger

class WikipediaPlugin(Plugin):
    name = "Wikipedia"
    description = "Searches Wikipedia for information."
    intents = ["wikipedia"]

    def __init__(self):
        super().__init__()
        wikipedia.set_lang("en")

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        query = entities.get("query")
        if not query:
            return "What topic should I look up on Wikipedia?"
        return self.search(query)

    def search(self, query: str, sentences: int = 2) -> str:
        try:
            logger.info(f"Wikipedia search: {query}")
            summary = wikipedia.summary(query, sentences=sentences, auto_suggest=True)
            return f"According to Wikipedia: {summary}"
            
        except wikipedia.exceptions.DisambiguationError as e:
            options = e.options[:3]
            return f"I found multiple results. Did you mean: {', '.join(options)}?"
            
        except wikipedia.exceptions.PageError:
            return f"I couldn't find any Wikipedia article about {query}."
            
        except Exception as e:
            logger.error(f"Wikipedia error: {e}")
            return "Sorry, I encountered an error searching Wikipedia."
