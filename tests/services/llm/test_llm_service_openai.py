import pytest
import unittest
from unittest.mock import MagicMock, patch, ANY
import sys
import json

# Mock modules before importing LLMService
# We need to mock these globally because they are imported at top level in LLMService
# and we want to avoid ImportError if they are missing (though they are installed now).
# Also to mock the classes/methods used.
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['openai'] = MagicMock()


from services.llm.llm_service import LLMService, MockMessage

class TestLLMServiceOpenAI(unittest.TestCase):
    def setUp(self):
        # Setup module patching
        self.mock_memory_module = MagicMock()
        self.modules_patcher = patch.dict(sys.modules, {
            'google': MagicMock(),
            'google.genai': MagicMock(),
            'openai': MagicMock(),
            'services.memory.vector_store': self.mock_memory_module
        })
        self.modules_patcher.start()

        # Patch ConfigLoader
        self.mock_config_patcher = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.mock_config_patcher.start()

        # Patch logger
        self.mock_logger_patcher = patch('services.llm.llm_service.logger')
        self.mock_logger = self.mock_logger_patcher.start()

        self.mock_client = MagicMock()

        # Initialize service with openai provider
        self.mock_config.get.side_effect = lambda key, default=None: "openai" if key == "ai.provider" else "gemini-2.0-flash" if key == "ai.llm_model" else default
        self.service = LLMService()

        # Set mocked client
        self.service.client = self.mock_client

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_logger_patcher.stop()
        self.modules_patcher.stop()

    def test_openai_response_no_client(self):
        """Test response when OpenAI client is not connected."""
        # Ensure client is None
        self.service.client = None

        response = self.service._get_openai_response([])

        self.assertIsInstance(response, MockMessage)
        self.assertEqual(response.content, "I'm sorry, OpenAI is not connected.")

    def test_openai_response_success(self):
        """Test successful response from OpenAI."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = MockMessage("Hello from OpenAI")

        self.service.client = MagicMock()
        self.service.client.chat.completions.create.return_value = mock_response

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_openai_response(messages)

        self.assertEqual(response.content, "Hello from OpenAI")
        self.service.client.chat.completions.create.assert_called_once()

    def test_openai_response_exception(self):
        """Test handling of exceptions during OpenAI API call."""
        self.service.client = MagicMock()
        self.service.client.chat.completions.create.side_effect = Exception("API Error")

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_openai_response(messages)

        self.assertIsInstance(response, MockMessage)
        self.assertTrue("OpenAI Error: API Error" in response.content)
        self.mock_logger.error.assert_called()

if __name__ == '__main__':
    unittest.main()
