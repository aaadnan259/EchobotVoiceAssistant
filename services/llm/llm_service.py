import os
from google import genai
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
        # FORCE gemini-2.0-flash - ignore config to fix deployment issue
        self.model_name = "gemini-2.0-flash"
        self.client = None
        
        if self.provider == "google":
            self.api_key = ConfigLoader.get("ai.google_api_key")
            if self.api_key:
                try:
                    self.client = genai.Client(api_key=self.api_key)
                    logger.info(f"Initialized Google Gemini Client with model: {self.model_name}")
                except Exception as e:
                    logger.error(f"Failed to initialize Google Gemini Client: {e}")
            else:
                logger.warning("Google API Key not found.")
        
        else:
            # Fallback to OpenAI
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
        try:
            logger.info(f"=== GEMINI 2.0 API CALL ===")
            logger.info(f"Model: {self.model_name}")
            
            # Build contents for chat
            # New SDK format: contents=[{'role': '...', 'parts': [{'text': '...'}]}]
            contents = []
            
            # Handle System Prompt separately if needed, but Gemini 2.0 supports system instruction in generation config
            # Or we can prepend it to the first message or use 'config' param.
            # Client.models.generate_content(..., config={'system_instruction': ...})
            
            system_instruction = None
            
            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")
                
                if role == "system":
                    if system_instruction:
                        system_instruction += "\n" + content
                    else:
                        system_instruction = content
                
                elif role == "user":
                    contents.append({"role": "user", "parts": [{"text": content}]})
                
                elif role == "assistant" or role == "model":
                    contents.append({"role": "model", "parts": [{"text": content}]})

            logger.info(f"Sending {len(contents)} messages to Gemini")
            
            # Config for system instruction
            config = None
            if system_instruction:
                # Note: passing system_instruction in config might vary by SDK version, 
                # but commonly it's supported. If fails, we might just prepend.
                # Checking recent SDK docs pattern:
                # config=types.GenerateContentConfig(system_instruction=...)
                # For simplicity in this migration step to fix EMPTY response, we'll try passing it or fall back.
                pass 

            # GENERATE
            # Note: For tools, we'd add 'tools' param. Omitting for basic fix first.
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config={'system_instruction': system_instruction} if system_instruction else None
            )
            
            if response.text:
                logger.info(f"Response received: {response.text[:50]}...")
                return MockMessage(content=response.text)
            else:
                logger.warning("Gemini returned empty text.")
                return MockMessage("I couldn't generate a response.")

        except Exception as e:
            logger.error(f"Google Gemini Error: {e}", exc_info=True)
            return MockMessage("I'm having trouble thinking with Gemini (New SDK) right now.")

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
        # (Same logic as before, just wrapper)
        if context is None:
            context = []
        
        # 1. Retrieve Memories
        memory_context = ""
        if hasattr(self, 'memory_service') and self.memory_service:
            try:
                relevant_memories = self.memory_service.query(user_input)
                if relevant_memories:
                    memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
            except Exception as e:
                logger.error(f"Memory Retrieval Error: {e}")

        # 2. Construct Messages
        messages = [
            {"role": "system", "content": f"You are EchoBot. {memory_context}"}
        ] + context + [
            {"role": "user", "content": user_input}
        ]
        
        response_message = self.get_response(messages, tools)
        response_text = getattr(response_message, 'content', "No response")

        # 3. Store
        if hasattr(self, 'memory_service') and self.memory_service and response_text:
            try:
                full_exchange = f"User: {user_input}\nAssistant: {response_text}"
                self.memory_service.add(full_exchange)
            except Exception as e:
                 pass
        
        return response_text, None
