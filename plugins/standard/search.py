from duckduckgo_search import DDGS
from typing import Dict, Any
from services.plugin_manager import Plugin
from utils.logger import logger

class WebSearchPlugin(Plugin):
    name = "WebSearch"
    description = "Performs web searches using DuckDuckGo."
    intents = ["search"]

    def __init__(self):
        super().__init__()
        self.ddgs = DDGS()

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        query = entities.get("query")
        if not query:
            return "What would you like me to search for?"
        return self.search(query)

    def search(self, query: str, max_results: int = 3) -> str:
        try:
            logger.info(f"Web search: {query}")
            results = list(self.ddgs.text(query, max_results=max_results))
            
            if not results:
                return f"I couldn't find any results for '{query}'."
            
            response = f"Here's what I found for '{query}': "
            for i, result in enumerate(results, 1):
                title = result.get("title", "")
                snippet = result.get("body", "")
                if snippet:
                    snippet = snippet.split('.')[0] + '.'
                response += f"{title}. {snippet} "
            
            return response.strip()
            
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return "Sorry, I couldn't perform the web search."
