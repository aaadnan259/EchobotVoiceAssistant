import unittest
from unittest.mock import MagicMock, patch, ANY
import sys

# We need to mock these before import because LLMService imports them at top level
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['openai'] = MagicMock()

from services.llm.llm_service import LLMService

class TestLLMService(unittest.TestCase):
    def setUp(self):
        # Patch ConfigLoader
        self.mock_config_patcher = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.mock_config_patcher.start()

        # Setup config side effects
        def config_side_effect(key, default=None):
            if key == "ai.provider":
                return "google"
            if key == "ai.google_api_key":
                return "fake_key"
            return default
        self.mock_config.get.side_effect = config_side_effect

        # Patch genai
        self.mock_genai_patcher = patch('services.llm.llm_service.genai')
        self.mock_genai = self.mock_genai_patcher.start()

        self.mock_client = MagicMock()
        self.mock_genai.Client.return_value = self.mock_client

        # Patch logger to suppress output
        self.mock_logger_patcher = patch('services.llm.llm_service.logger')
        self.mock_logger = self.mock_logger_patcher.start()

        # Mock MemoryService using patch.dict on sys.modules to isolate it
        self.memory_module_patcher = patch.dict(sys.modules, {'services.memory.vector_store': MagicMock()})
        self.memory_module_patcher.start()

        # Initialize service
        self.service = LLMService()

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_genai_patcher.stop()
        self.mock_logger_patcher.stop()
        self.memory_module_patcher.stop()

    def test_google_response_success(self):
        """Test successful response from Google Gemini."""
        mock_response = MagicMock()
        mock_response.text = "Hello there!"
        self.mock_client.models.generate_content.return_value = mock_response

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_google_response(messages)

        self.assertEqual(response.content, "Hello there!")
        self.mock_client.models.generate_content.assert_called_once()

    def test_google_response_empty(self):
        """Test handling of empty text response from Google Gemini."""
        mock_response = MagicMock()
        mock_response.text = "" # Empty string simulates empty response
        self.mock_client.models.generate_content.return_value = mock_response

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_google_response(messages)

        self.assertEqual(response.content, "I couldn't generate a response.")
        self.mock_logger.warning.assert_called_with("Gemini returned empty text.")

    def test_google_response_none(self):
        """Test handling of None text response from Google Gemini."""
        mock_response = MagicMock()
        mock_response.text = None
        self.mock_client.models.generate_content.return_value = mock_response

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_google_response(messages)

        self.assertEqual(response.content, "I couldn't generate a response.")
        self.mock_logger.warning.assert_called_with("Gemini returned empty text.")

    def test_google_response_exception(self):
        """Test handling of exceptions during Google Gemini API call."""
        self.mock_client.models.generate_content.side_effect = Exception("API Error")

        messages = [{"role": "user", "content": "Hi"}]
        response = self.service._get_google_response(messages)

        self.assertEqual(response.content, "I'm having trouble thinking right now.")
        self.mock_logger.error.assert_called()

    def test_google_message_parsing(self):
        """Test that messages are correctly parsed into contents and system_instruction."""
        mock_response = MagicMock()
        mock_response.text = "Response"
        self.mock_client.models.generate_content.return_value = mock_response

        messages = [
            {"role": "system", "content": "Be helpful."},
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi user"},
            {"role": "user", "content": "How are you?"}
        ]

        self.service._get_google_response(messages)

        # check call args
        _, kwargs = self.mock_client.models.generate_content.call_args

        expected_contents = [
            {"role": "user", "parts": [{"text": "Hello"}]},
            {"role": "model", "parts": [{"text": "Hi user"}]},
            {"role": "user", "parts": [{"text": "How are you?"}]}
        ]

        expected_config = {'system_instruction': "Be helpful."}

        self.assertEqual(kwargs['contents'], expected_contents)
        self.assertEqual(kwargs['config'], expected_config)
        self.assertEqual(kwargs['model'], "gemini-2.0-flash")

    def test_google_system_instruction_concatenation(self):
        """Test multiple system messages are concatenated."""
        mock_response = MagicMock()
        mock_response.text = "Response"
        self.mock_client.models.generate_content.return_value = mock_response

        messages = [
            {"role": "system", "content": "Part 1."},
            {"role": "system", "content": "Part 2."}
        ]

        self.service._get_google_response(messages)

        _, kwargs = self.mock_client.models.generate_content.call_args
        expected_config = {'system_instruction': "Part 1.\nPart 2."}
        self.assertEqual(kwargs['config'], expected_config)

if __name__ == '__main__':
    unittest.main()
