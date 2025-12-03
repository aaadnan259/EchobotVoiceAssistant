import threading
import sys
import time
from typing import Dict, Any

from config.loader import ConfigLoader
from utils.logger import logger
from services.plugin_manager import PluginManager
# from services.audio.voice_engine import VoiceEngine # Removed for Web-Only
from services.ml.intent_classifier import IntentClassifier
from services.llm.llm_service import LLMService
from services.memory.vector_store import MemoryService
from web.backend.app import run_web_server, manager

class EchoBot:
    def __init__(self):
        logger.info("Initializing EchoBot...")
        
        # 1. Load Configuration
        self.config = ConfigLoader.load_settings()
        
        # 2. Initialize Services
        # self.voice = VoiceEngine() # Removed
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
        logger.info("Starting EchoBot System (Web-Only Mode)...")

        # Start Web UI in a separate thread
        if ConfigLoader.get("web.enabled", True):
            web_thread = threading.Thread(target=run_web_server, daemon=True)
            web_thread.start()
            logger.info(f"Web UI started at http://{ConfigLoader.get('web.host')}:{ConfigLoader.get('web.port')}")

        # Main Loop (Keep alive for Web Server)
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def process_input(self, text: str):
        """Process user input text (Called from Web Socket)."""
        # Note: This method is now primarily logic reference, 
        # as app.py handles the websocket loop directly.
        # But we can keep it if we want to centralize logic later.
        pass

    def stop(self):
        self.running = False
        logger.info("Shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    bot = EchoBot()
    bot.start()
