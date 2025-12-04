import speech_recognition as sr
import pvporcupine
import struct
import pyaudio
import os
from config.loader import ConfigLoader
from utils.logger import logger
from services.audio.tts import TTSEngine

class VoiceEngine:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # TTS Setup
        self.tts = TTSEngine()
        
        # Wake Word Setup
        self.porcupine_key = ConfigLoader.get("voice.porcupine_access_key")
        self.porcupine = None
        self.pa = None
        self.audio_stream = None
        
        if self.porcupine_key:
            try:
                self.porcupine = pvporcupine.create(access_key=self.porcupine_key, keywords=["jarvis"])
                self.pa = pyaudio.PyAudio()
                self.audio_stream = self.pa.open(
                    rate=self.porcupine.sample_rate,
                    channels=1,
                    format=pyaudio.paInt16,
                    input=True,
                    frames_per_buffer=self.porcupine.frame_length
                )
                logger.info("Wake word engine (Porcupine) initialized.")
            except Exception as e:
                logger.error(f"Failed to init Porcupine: {e}")

    def listen(self, timeout=5, phrase_time_limit=10):
        """Listen for voice input."""
        with self.microphone as source:
            logger.info("Listening...")
            self.recognizer.adjust_for_ambient_noise(source)
            try:
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
                text = self.recognizer.recognize_google(audio)
                logger.info(f"Heard: {text}")
                return text
            except sr.WaitTimeoutError:
                return None
            except sr.UnknownValueError:
                return None
            except Exception as e:
                logger.error(f"STT Error: {e}")
                return None

    def speak(self, text: str):
        """Convert text to speech using ElevenLabs streaming."""
        self.tts.speak_stream(text)

    def wait_for_wake_word(self):
        """Block until wake word is detected."""
        if not self.porcupine:
            logger.warning("Wake word not configured. Skipping.")
            return True

        logger.info("Waiting for wake word...")
        while True:
            pcm = self.audio_stream.read(self.porcupine.frame_length)
            pcm = struct.unpack_from("h" * self.porcupine.frame_length, pcm)
            keyword_index = self.porcupine.process(pcm)
            if keyword_index >= 0:
                logger.info("Wake word detected!")
                return True
