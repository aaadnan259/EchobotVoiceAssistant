import os
import json
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
        self.model_name = ConfigLoader.get("ai.llm_model", "gemini-2.0-flash")
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

    def get_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None, system_instruction: str = None) -> Any:
        """
        Get a response from the LLM, abstracting the provider.
        """
        if self.provider == "google":
            return self._get_google_response(messages, tools, system_instruction)
        else:
            return self._get_openai_response(messages, tools, system_instruction)

    def _get_google_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None, system_instruction: str = None) -> Any:
        try:
            logger.info(f"GenAI Request: {self.model_name}")
            
            contents = []
            
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

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config={'system_instruction': system_instruction} if system_instruction else None
            )
            
            if response.text:
                return MockMessage(content=response.text)
            else:
                logger.warning("Gemini returned empty text.")
                return MockMessage("I couldn't generate a response.")

        except Exception as e:
            logger.error(f"Google Gemini Error: {e}", exc_info=True)
            return MockMessage("I'm having trouble thinking right now.")

    def _get_openai_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None, system_instruction: str = None) -> Any:
        if not self.client:
            return MockMessage("I'm sorry, OpenAI is not connected.")

        try:
            if system_instruction:
                messages = [{"role": "system", "content": system_instruction}] + messages

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

    def generate_stream(self, messages: List[Dict[str, str]], system_instruction: str = None) -> Any:
        """
        Get a streaming response from the LLM.
        """
        if self.provider == "google":
            return self._generate_google_stream(messages, system_instruction)
        else:
            return self._generate_openai_stream(messages, system_instruction)

    def _generate_google_stream(self, messages: List[Dict[str, str]], system_instruction: str = None) -> Any:
        try:
            contents = []
            # If system_instruction is not provided, we might still find one in messages
            if not system_instruction:
                for msg in messages:
                    if msg.get("role") == "system":
                        if system_instruction:
                            system_instruction += "\n" + msg.get("content", "")
                        else:
                            system_instruction = msg.get("content", "")

            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")
                if role == "user":
                    contents.append({"role": "user", "parts": [{"text": content}]})
                elif role == "assistant" or role == "model":
                    contents.append({"role": "model", "parts": [{"text": content}]})

            response = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config={'system_instruction': system_instruction} if system_instruction else None
            )

            for chunk in response:
                if chunk.text:
                    payload = json.dumps({"text": chunk.text})
                    yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"Google Gemini Streaming Error: {e}", exc_info=True)
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"

    def _generate_openai_stream(self, messages: List[Dict[str, str]], system_instruction: str = None) -> Any:
        if not self.client:
             yield f"data: {json.dumps({'error': 'OpenAI client not initialized'})}\n\n"
             return

        try:
            if system_instruction:
                messages = [{"role": "system", "content": system_instruction}] + messages

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                max_tokens=150,
                stream=True
            )

            for chunk in response:
                if chunk.choices[0].delta.content:
                    payload = json.dumps({"text": chunk.choices[0].delta.content})
                    yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"OpenAI Streaming Error: {e}", exc_info=True)
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"

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
