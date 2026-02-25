import unittest
from unittest.mock import MagicMock, patch
import sys
import json

# Mock dependencies
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['openai'] = MagicMock()
sys.modules['yaml'] = MagicMock()
sys.modules['dotenv'] = MagicMock()
sys.modules['services.memory.vector_store'] = MagicMock()
sys.modules['colorama'] = MagicMock()

from services.llm.llm_service import LLMService

class TestLLMServiceStream(unittest.TestCase):
    def setUp(self):
        self.patcher_config = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.patcher_config.start()

        def config_side_effect(key, default=None):
            if key == "ai.provider": return "google"
            if key == "ai.llm_model": return "gemini-2.0-flash"
            return default
        self.mock_config.get.side_effect = config_side_effect

        self.service = LLMService()
        self.service.client = MagicMock()

    def tearDown(self):
        self.patcher_config.stop()

    def test_generate_google_stream(self):
        """Test successful streaming from Google Gemini."""
        mock_chunk1 = MagicMock()
        mock_chunk1.text = "Hello"
        mock_chunk2 = MagicMock()
        mock_chunk2.text = " world"

        self.service.client.models.generate_content_stream.return_value = [mock_chunk1, mock_chunk2]

        messages = [{"role": "user", "content": "Hi"}]
        stream = self.service.generate_stream(messages, "Be helpful")

        results = list(stream)

        self.assertIn('data: {"text": "Hello"}\n\n', results)
        self.assertIn('data: {"text": " world"}\n\n', results)
        self.assertIn('data: {"done": true}\n\n', results)

    def test_generate_openai_stream(self):
        """Test successful streaming from OpenAI."""
        self.service.provider = "openai"
        self.service.client = MagicMock()

        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock()]
        mock_chunk1.choices[0].delta.content = "Hello"
        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock()]
        mock_chunk2.choices[0].delta.content = " world"

        self.service.client.chat.completions.create.return_value = [mock_chunk1, mock_chunk2]

        messages = [{"role": "user", "content": "Hi"}]
        stream = self.service.generate_stream(messages, "Be helpful")

        results = list(stream)

        self.assertIn('data: {"text": "Hello"}\n\n', results)
        self.assertIn('data: {"text": " world"}\n\n', results)
        self.assertIn('data: {"done": true}\n\n', results)

if __name__ == '__main__':
    unittest.main()
