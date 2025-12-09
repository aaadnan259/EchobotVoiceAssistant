from elevenlabs.client import ElevenLabs
from elevenlabs import stream
from config.loader import ConfigLoader
from utils.logger import logger

class TTSEngine:
    def __init__(self):
        self.api_key = ConfigLoader.get("voice.elevenlabs_api_key")
        if not self.api_key:
            logger.warning("ElevenLabs API key not found. TTS will be disabled.")
            self.client = None
            return

        self.client = ElevenLabs(api_key=self.api_key)
        
        # STRICT CONFIGURATION FOR PRODUCTION
        # Target: Tarquin
        self.voice_id = "7cOBG34AiHrAzs842Rdi" 
        
        # Override if config provides something else, but default to Tarquin hardcoded
        config_id = ConfigLoader.get("voice.tts_voice_id")
        if config_id:
             self.voice_id = config_id

        self.model_id = ConfigLoader.get("voice.tts_model_id", "eleven_turbo_v2")
        
        logger.info(f"TTS Initialized. Voice ID: {self.voice_id} (Model: {self.model_id})")

    @property
    def is_available(self) -> bool:
        """Check if TTS is configured and ready."""
        return self.client is not None and self.voice_id is not None
        
    # Dynamic lookup removed for production stability


    def speak_stream(self, text: str):
        """Stream audio from ElevenLabs."""
        if not self.is_available:
            logger.warning("TTS not configured or voice not found.")
            return

        logger.info(f"Streaming TTS for: {text}")
        try:
            audio_stream = self.client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id=self.model_id,
                stream=True
            )
            stream(audio_stream)
        except Exception as e:
            logger.error(f"ElevenLabs Streaming Error: {e}")

    def generate_audio_bytes(self, text: str) -> bytes:
        """Generate audio bytes from ElevenLabs."""
        if not self.is_available:
            logger.warning("TTS not configured or voice not found.")
            return b""

        logger.info(f"Generating TTS for: {text}")
        try:
            audio = self.client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id=self.model_id
            )
            return b"".join(audio) if hasattr(audio, '__iter__') and not isinstance(audio, (bytes, bytearray)) else audio
        except Exception as e:
            logger.error(f"ElevenLabs Generation Error: {e}")
            return b""
