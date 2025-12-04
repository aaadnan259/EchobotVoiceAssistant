import openai
from typing import List, Dict, Any, Optional
from config.loader import ConfigLoader
from utils.logger import logger

class LLMService:
    def __init__(self):
        self.api_key = ConfigLoader.get("ai.openai_api_key")
        self.model = ConfigLoader.get("ai.llm_model", "gpt-3.5-turbo")
        self.client = None
        
        if self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            logger.warning("OpenAI API Key not found. LLM features will be disabled.")

        # Initialize Memory
        try:
            from services.memory.vector_store import MemoryService
            self.memory_service = MemoryService()
            logger.info("MemoryService initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize MemoryService: {e}")
            self.memory_service = None

    def get_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        """
        Get a response from the LLM.
        
        Args:
            messages: List of message dicts
            tools: List of tool definitions
        """
        if not self.client:
            return "I'm sorry, my AI brain is not connected. Please check your API keys."

        try:
            params = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 150
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"

            response = self.client.chat.completions.create(**params)
            return response.choices[0].message
        except openai.APIConnectionError as e:
            logger.error(f"OpenAI Connection Error: {e}")
            return "I'm having trouble connecting to my brain (OpenAI)."
        except openai.APIError as e:
            logger.error(f"OpenAI API Error: {e}")
            return f"I encountered an API error: {e}"
        except openai.RateLimitError as e:
            logger.error(f"OpenAI Rate Limit Error: {e}")
            return "I'm thinking too fast! Please wait a moment."
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI Auth Error: {e}")
            return "My API key seems to be invalid."
        except Exception as e:
            logger.error(f"LLM Error: {e}", exc_info=True)
            return "I'm having trouble thinking right now."

    def chat(self, user_input: str, context: List[Dict[str, str]] = None, tools: List[Dict[str, Any]] = None) -> Any:
        """Simple chat interface with Memory (RAG) and Tools."""
        if context is None:
            context = []
        
        # 1. Retrieve Memories (RAG)
        try:
            from services.memory.vector_store import MemoryService
            pass 
        except ImportError:
            pass

        # We will use the initialized memory_service if available
        memory_context = ""
        if hasattr(self, 'memory_service'):
            try:
                relevant_memories = self.memory_service.query(user_input)
                if relevant_memories:
                    memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
                    logger.info(f"Retrieved Memory: {relevant_memories[:50]}...")
            except Exception as e:
                logger.error(f"Memory Retrieval Error: {e}")

        messages = [
            {"role": "system", "content": f"You are EchoBot, a helpful and witty AI assistant.{memory_context}"}
        ] + context + [
            {"role": "user", "content": user_input}
        ]
        
        response_message = self.get_response(messages, tools)

        # Handle error string
        if isinstance(response_message, str):
            return response_message, None

        # Check for tool calls
        if response_message.tool_calls:
            return None, response_message.tool_calls
        
        response_text = response_message.content

        # 2. Store Interaction
        if hasattr(self, 'memory_service') and response_text:
            try:
                # Store the exchange
                full_exchange = f"User: {user_input}\nAssistant: {response_text}"
                self.memory_service.add(full_exchange)
            except Exception as e:
                logger.error(f"Memory Storage Error: {e}")
        
        return response_text, None
