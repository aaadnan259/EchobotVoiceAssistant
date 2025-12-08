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
        self.voice_name = ConfigLoader.get("voice.voice_name", "Valerie")
        self.voice_id = self._get_voice_id(self.voice_name)
        self.model_id = ConfigLoader.get("voice.tts_model_id", "eleven_turbo_v2_5")

    def _get_voice_id(self, voice_name: str) -> str:
        """Dynamically lookup voice ID by name."""
        try:
            logger.info(f"Looking up voice ID for: {voice_name}")
            response = self.client.voices.get_all()
            
            # Iterate through voices to find a match
            for voice in response.voices:
                if voice.name.lower() == voice_name.lower():
                    logger.info(f"Found voice ID for {voice_name}: {voice.voice_id}")
                    return voice.voice_id
            
            logger.warning(f"Voice '{voice_name}' not found. Falling back to default.")
            # Fallback to a known default or the first available
            default_voice = "Rachel"
            for voice in response.voices:
                if voice.name == default_voice:
                    return voice.voice_id
            
            # Ultimate fallback if even default isn't found (unlikely)
            return response.voices[0].voice_id

        except Exception as e:
            logger.error(f"Failed to fetch voices: {e}")
            # Return configured ID as fallback if dynamic lookup fails
            return ConfigLoader.get("voice.tts_voice_id", "21m00Tcm4TlvDq8ikWAM")

    def speak_stream(self, text: str):
        """Stream audio from ElevenLabs."""
        if not self.client or not self.voice_id:
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
        if not self.client or not self.voice_id:
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
