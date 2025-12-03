import asyncio
import threading
import sys
import time
from typing import Dict, Any

from config.loader import ConfigLoader
from utils.logger import logger
from services.plugin_manager import PluginManager
from services.audio.voice_engine import VoiceEngine
from services.ml.intent_classifier import IntentClassifier
from services.llm.llm_service import LLMService
from services.memory.vector_store import MemoryService
from web.backend.app import run_web_server, manager
import asyncio

def broadcast_status(status: str):
    """Helper to broadcast status to Web UI safely."""
    try:
        if manager.active_connections:
            # Create a new loop for the thread if needed, or use run_coroutine_threadsafe
            # Since manager.broadcast is async, we need to run it in the event loop of the web server
            # This is complex across threads. For now, we'll try a fire-and-forget approach or simple print.
            # A robust solution requires a shared queue or event bus.
            # Simplified: Just log for now, as cross-thread async is risky without a proper bus.
            # logger.info(f"Broadcasting status: {status}")
            pass
    except Exception as e:
        logger.error(f"Broadcast error: {e}")

class EchoBot:
    def __init__(self):
        logger.info("Initializing EchoBot...")
        
        # 1. Load Configuration
        self.config = ConfigLoader.load_settings()
        
        # 2. Initialize Services
        self.voice = VoiceEngine()
        self.classifier = IntentClassifier()
        self.llm = LLMService()
        self.memory = MemoryService()
        self.plugin_manager = PluginManager()
        
        # 3. Load Resources
        self.classifier.load()
        self.plugin_manager.load_plugins()
        
        self.running = True

    def start(self):
        """Start the EchoBot system."""
        logger.info("Starting EchoBot System...")

        # Start Web UI in a separate thread
        if ConfigLoader.get("web.enabled", True):
            web_thread = threading.Thread(target=run_web_server, daemon=True)
            web_thread.start()
            logger.info(f"Web UI started at http://{ConfigLoader.get('web.host')}:{ConfigLoader.get('web.port')}")

        self.voice.speak("System online. I am ready.")

        # Main Loop
        try:
            while self.running:
                # 1. Wait for Wake Word
                # 1. Wait for Wake Word
                try:
                    if self.voice.wait_for_wake_word():
                        self.voice.speak("Yes?")
                        
                        # 2. Listen for Command
                        user_input = self.voice.listen()
                        
                        if user_input:
                            self.process_input(user_input)
                except Exception as e:
                    logger.error(f"Voice Loop Error: {e}")
                    time.sleep(1) # Prevent spamming on error
                        
        except KeyboardInterrupt:
            self.stop()

    def process_input(self, text: str):
        """Process user input text."""
        logger.info(f"Processing: {text}")
        
        # 1. Intent Classification
        intent, confidence = self.classifier.predict(text)
        logger.info(f"Detected Intent: {intent} ({confidence:.2f})")
        
        # 2. Context Construction
        context = {
            "memory": self.memory,
            "llm": self.llm,
            "available_plugins": self.plugin_manager.get_all_plugins()
        }
        
        # 3. Route to Plugin or LLM
        response = ""
        
        if intent == "chat":
            # Fallback to LLM
            # Retrieve relevant memory
            memories = self.memory.query(text)
            chat_context = [{"role": "system", "content": f"Relevant info: {memories}"}] if memories else []
            response = self.llm.chat(text, chat_context)
            
            # Save interaction to memory
            self.memory.add(f"User: {text}\nBot: {response}", metadata={"type": "chat"})
            
        else:
            # Route to Plugin
            plugin = self.plugin_manager.get_plugin_for_intent(intent)
            if plugin:
                # Extract entities (Simple placeholder for now)
                entities = self._extract_entities(text, intent)
                try:
                    response = plugin.handle(intent, entities, context)
                except Exception as e:
                    logger.error(f"Plugin Error: {e}")
                    response = "I encountered an error processing that command."
            else:
                response = "I'm not sure how to handle that yet."

        # 4. Respond
        logger.info(f"Response: {response}")
        self.voice.speak(response)

    def _extract_entities(self, text: str, intent: str) -> Dict[str, Any]:
        """
        Simple entity extraction based on intent.
        In a real system, use spaCy or the intent classifier's slots.
        """
        entities = {}
        text = text.lower()
        
        if intent == "weather":
            # "weather in London" -> London
            if " in " in text:
                entities["location"] = text.split(" in ")[1].strip()
        elif intent == "search" or intent == "wikipedia":
            # "search for X", "who is X"
            for prefix in ["search for ", "search ", "who is ", "what is ", "tell me about "]:
                if text.startswith(prefix):
                    entities["query"] = text[len(prefix):].strip()
                    break
            if "query" not in entities:
                entities["query"] = text # Fallback
        elif intent == "calculate":
            # "calculate 5 + 5"
            for prefix in ["calculate ", "what is "]:
                if text.startswith(prefix):
                    entities["expression"] = text[len(prefix):].strip()
        elif intent == "reminder_set":
            # "remind me to X at Y"
            if " to " in text:
                parts = text.split(" to ", 1)[1]
                if " at " in parts:
                    task, time_val = parts.rsplit(" at ", 1)
                    entities["task"] = task
                    entities["time"] = time_val
                else:
                    entities["task"] = parts
        
        return entities

    def stop(self):
        self.running = False
        logger.info("Shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    bot = EchoBot()
    bot.start()
