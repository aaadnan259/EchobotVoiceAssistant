from .base import LLMProvider
import openai
from typing import List, Dict, Any
from utils.logger import logger
import json

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model_name: str = "gpt-4o"):
        self.client = openai.OpenAI(api_key=api_key)
        self.model_name = model_name
        logger.info(f"OpenAIProvider initialized with model: {model_name}")

    def generate_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        try:
            params = {
                "model": self.model_name,
                "messages": messages,
                "temperature": 0.7
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"

            response = self.client.chat.completions.create(**params)
            return response.choices[0].message
        except Exception as e:
            logger.error(f"OpenAI Error: {e}", exc_info=True)
            raise e

    def generate_stream(self, messages: List[Dict[str, str]], system_instruction: str) -> Any:
        # OpenAI handles system instruction as a message
        full_messages = [{"role": "system", "content": system_instruction}] + messages
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=full_messages,
                stream=True
            )
            
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    payload = json.dumps({"text": text})
                    yield f"data: {payload}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"OpenAI Streaming Error: {e}")
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"
