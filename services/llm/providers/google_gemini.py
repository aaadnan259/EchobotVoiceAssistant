from .base import LLMProvider
from google import genai
from typing import List, Dict, Any
from utils.logger import logger
import json

class MockMessage:
    def __init__(self, content: str):
        self.content = content

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        logger.info(f"GeminiProvider initialized with model: {model_name}")

    def _format_contents(self, messages: List[Dict[str, str]]) -> tuple[list, str | None]:
        contents = []
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
                
        return contents, system_instruction

    def generate_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        try:
            contents, system_instruction = self._format_contents(messages)
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config={'system_instruction': system_instruction} if system_instruction else None
            )
            
            if response.text:
                return MockMessage(content=response.text)
            return MockMessage("I couldn't generate a response.")

        except Exception as e:
            logger.error(f"Gemini Error: {e}", exc_info=True)
            raise e

    def generate_stream(self, messages: List[Dict[str, str]], system_instruction: str) -> Any:
        # Note: The original implementation re-formatted messages slightly differently for streaming
        # We will adapt to the standard format here
        contents = []
        
        # In the original app.py, it was passed `request.history` + `newMessage`
        # Here we assume `messages` is the full history including the last user message
        
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
             # Skip system role in contents, it goes to config
            if msg.get("role") != "system":
                contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

        try:
            response = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config={'system_instruction': system_instruction}
            )
            
            for chunk in response:
                if chunk.text:
                    payload = json.dumps({"text": chunk.text})
                    yield f"data: {payload}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"Gemini Streaming Error: {e}")
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"
