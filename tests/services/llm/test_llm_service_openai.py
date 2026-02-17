import unittest
from unittest.mock import MagicMock, patch
import sys

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
        # Patch ConfigLoader
        self.mock_config_patcher = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.mock_config_patcher.start()

        # Setup config side effects to simulate OpenAI provider
        def config_side_effect(key, default=None):
            if key == "ai.provider":
                return "openai"
            if key == "ai.openai_api_key":
                return "fake_key"
            return default
        self.mock_config.get.side_effect = config_side_effect

        # Patch logger
        self.mock_logger_patcher = patch('services.llm.llm_service.logger')
        self.mock_logger = self.mock_logger_patcher.start()

        # Mock MemoryService using patch.dict on sys.modules to isolate it
        # This prevents the real MemoryService from running and failing,
        # and avoids side effects on other tests.
        self.memory_module_patcher = patch.dict(sys.modules, {'services.memory.vector_store': MagicMock()})
        self.memory_module_patcher.start()

        # Initialize service
        self.service = LLMService()

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_logger_patcher.stop()
        self.memory_module_patcher.stop()

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
