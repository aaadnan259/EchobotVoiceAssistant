import openai
from typing import List, Dict
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

    def get_response(self, messages: List[Dict[str, str]]) -> str:
        """
        Get a response from the LLM.
        
        Args:
            messages: List of message dicts [{"role": "user", "content": "..."}]
        """
        if not self.client:
            return "I'm sorry, my AI brain is not connected. Please check your API keys."

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
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

    def chat(self, user_input: str, context: List[Dict[str, str]] = None) -> str:
        """Simple chat interface."""
        if context is None:
            context = []
        
        messages = [
            {"role": "system", "content": "You are EchoBot, a helpful and witty AI assistant."}
        ] + context + [
            {"role": "user", "content": user_input}
        ]
        
        return self.get_response(messages)
