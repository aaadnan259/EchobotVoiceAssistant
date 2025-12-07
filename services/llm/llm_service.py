import google.generativeai as genai
import openai
from typing import List, Dict, Any, Optional
from config.loader import ConfigLoader
from utils.logger import logger

class MockMessage:
    def __init__(self, content: str, tool_calls: Optional[List] = None):
        self.content = content
        self.tool_calls = tool_calls

class LLMService:
    def __init__(self):
        self.provider = ConfigLoader.get("ai.provider", "openai")
        self.api_key = None
        self.model_name = ConfigLoader.get("ai.llm_model", "gpt-4o-mini")
        self.client = None
        
        if self.provider == "google":
            self.api_key = ConfigLoader.get("ai.google_api_key")
            if self.api_key:
                try:
                    genai.configure(api_key=self.api_key)
                    self.model = genai.GenerativeModel(self.model_name)
                    logger.info(f"Initialized Google Gemini with model: {self.model_name}")
                except Exception as e:
                    logger.error(f"Failed to initialize Google Gemini: {e}")
            else:
                logger.warning("Google API Key not found.")
        
        else:
            # Fallback to OpenAI or existing logic
            self.api_key = ConfigLoader.get("ai.openai_api_key")
            if self.api_key:
                self.client = openai.OpenAI(api_key=self.api_key)
            else:
                logger.warning("AI Provider is OpenAI but no API Key found.")

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
        Get a response from the LLM, abstracting the provider.
        """
        if self.provider == "google":
            return self._get_google_response(messages, tools)
        else:
            return self._get_openai_response(messages, tools)

    def _get_google_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        if not self.model:
            return MockMessage("I'm sorry, Google Gemini is not configured correctly.")

        try:
            # Convert OpenAI messages to single prompt or history (simplified for now)
            # A more robust implementation would map roles: user->user, assistant->model
            full_prompt = ""
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                full_prompt += f"{role.upper()}: {content}\n"
            
            full_prompt += "ASSISTANT:" # Prompt for completion

            response = self.model.generate_content(full_prompt)
            
            # Mimic OpenAI structure
            return MockMessage(content=response.text, tool_calls=None)

        except Exception as e:
            logger.error(f"Google Gemini Error: {e}", exc_info=True)
            return MockMessage("I'm having trouble thinking with Gemini right now.")

    def _get_openai_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        if not self.client:
            return MockMessage("I'm sorry, OpenAI is not connected.")

        try:
            params = {
                "model": self.model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 150
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"

            response = self.client.chat.completions.create(**params)
            return response.choices[0].message
        except Exception as e:
            logger.error(f"OpenAI Error: {e}", exc_info=True)
            return MockMessage(f"OpenAI Error: {str(e)}")

    def chat(self, user_input: str, context: List[Dict[str, str]] = None, tools: List[Dict[str, Any]] = None) -> Any:
        """Simple chat interface with Memory (RAG) and Tools."""
        if context is None:
            context = []
        
        # 1. Retrieve Memories (RAG)
        memory_context = ""
        if hasattr(self, 'memory_service') and self.memory_service:
            try:
                # Assuming query exists
                if hasattr(self.memory_service, 'query'):
                    relevant_memories = self.memory_service.query(user_input)
                    if relevant_memories:
                        memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
                        logger.info(f"Retrieved Memory: {relevant_memories[:50]}...")
            except Exception as e:
                logger.error(f"Memory Retrieval Error: {e}")

        # Construct System Prompt
        messages = [
            {"role": "system", "content": f"You are EchoBot, a helpful and witty AI assistant.{memory_context}"}
        ] + context + [
            {"role": "user", "content": user_input}
        ]
        
        response_message = self.get_response(messages, tools)

        # Handle simplified string return or object
        if isinstance(response_message, str):
             # Backward compatibility or error
             return response_message, None

        if hasattr(response_message, 'tool_calls') and response_message.tool_calls:
            return None, response_message.tool_calls
        
        response_text = getattr(response_message, 'content', "No response")

        # 2. Store Interaction
        if hasattr(self, 'memory_service') and self.memory_service and response_text:
            try:
                if hasattr(self.memory_service, 'add'):
                    full_exchange = f"User: {user_input}\nAssistant: {response_text}"
                    self.memory_service.add(full_exchange)
            except Exception as e:
                logger.error(f"Memory Storage Error: {e}")
        
        return response_text, None
