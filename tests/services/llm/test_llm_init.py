import unittest
from unittest.mock import MagicMock, patch
import sys

# We need to mock these before import because LLMService imports them at top level
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['openai'] = MagicMock()
# Also mock services.memory.vector_store since it is imported inside __init__
# Wait, it is imported inside __init__, so we can patch it using sys.modules as well to be safe
# or we can patch 'services.memory.vector_store' specifically if it is not imported yet.
# However, patching sys.modules['services.memory.vector_store'] is safer.
mock_memory_module = MagicMock()
sys.modules['services.memory.vector_store'] = mock_memory_module

from services.llm.llm_service import LLMService

class TestLLMServiceInit(unittest.TestCase):
    def setUp(self):
        # Patch ConfigLoader
        self.mock_config_patcher = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.mock_config_patcher.start()

        # Patch genai
        self.mock_genai_patcher = patch('services.llm.llm_service.genai')
        self.mock_genai = self.mock_genai_patcher.start()

        # Patch openai
        self.mock_openai_patcher = patch('services.llm.llm_service.openai')
        self.mock_openai = self.mock_openai_patcher.start()

        # Patch logger
        self.mock_logger_patcher = patch('services.llm.llm_service.logger')
        self.mock_logger = self.mock_logger_patcher.start()

        # Reset memory module mock for each test
        mock_memory_module.reset_mock()
        self.mock_memory_service_cls = MagicMock()
        mock_memory_module.MemoryService = self.mock_memory_service_cls

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_genai_patcher.stop()
        self.mock_openai_patcher.stop()
        self.mock_logger_patcher.stop()

    def test_default_provider(self):
        """Test provider defaults to 'openai' when config returns None."""
        self.mock_config.get.side_effect = lambda key, default=None: default if key == "ai.provider" else None

        service = LLMService()

        self.assertEqual(service.provider, "openai")

    def test_google_provider_config(self):
        """Test provider is 'google' when configured."""
        self.mock_config.get.side_effect = lambda key, default=None: "google" if key == "ai.provider" else None

        service = LLMService()

        self.assertEqual(service.provider, "google")

    def test_hardcoded_model_name(self):
        """Test model_name is always 'gemini-2.0-flash'."""
        self.mock_config.get.side_effect = lambda key, default=None: "openai" # Try to set openai

        service = LLMService()

        self.assertEqual(service.model_name, "gemini-2.0-flash")

        # Try with google
        self.mock_config.get.side_effect = lambda key, default=None: "google"
        service = LLMService()
        self.assertEqual(service.model_name, "gemini-2.0-flash")

    def test_google_client_init(self):
        """Test Google Client initialization."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "google"
            if key == "ai.google_api_key": return "fake_google_key"
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = LLMService()

        self.mock_genai.Client.assert_called_once_with(api_key="fake_google_key")
        self.assertIsNotNone(service.client)
        self.mock_logger.info.assert_any_call(f"Initialized Google Gemini Client with model: gemini-2.0-flash")

    def test_openai_client_init(self):
        """Test OpenAI Client initialization."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "openai"
            if key == "ai.openai_api_key": return "fake_openai_key"
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = LLMService()

        self.mock_openai.OpenAI.assert_called_once_with(api_key="fake_openai_key")
        self.assertIsNotNone(service.client)

    def test_google_missing_key(self):
        """Test Google provider with missing API key."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "google"
            if key == "ai.google_api_key": return None
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = LLMService()

        self.assertIsNone(service.client)
        self.mock_logger.warning.assert_called_with("Google API Key not found.")

    def test_openai_missing_key(self):
        """Test OpenAI provider with missing API key."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "openai"
            if key == "ai.openai_api_key": return None
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = LLMService()

        self.assertIsNone(service.client)
        self.mock_logger.warning.assert_called_with("AI Provider is OpenAI but no API Key found.")

    def test_memory_service_init_success(self):
        """Test successful MemoryService initialization."""
        mock_instance = MagicMock()
        self.mock_memory_service_cls.return_value = mock_instance

        service = LLMService()

        self.mock_memory_service_cls.assert_called_once()
        self.assertEqual(service.memory_service, mock_instance)
        self.mock_logger.info.assert_any_call("MemoryService initialized successfully.")

    def test_memory_service_init_failure(self):
        """Test MemoryService initialization failure."""
        self.mock_memory_service_cls.side_effect = Exception("Memory Error")

        service = LLMService()

        self.assertIsNone(service.memory_service)
        # Check that error was logged. The exact message contains the exception.
        # Check if any error log starts with "Failed to initialize MemoryService"
        found = False
        for call in self.mock_logger.error.call_args_list:
            if call[0][0].startswith("Failed to initialize MemoryService"):
                found = True
                break
        self.assertTrue(found, "Error log for MemoryService failure not found")

if __name__ == '__main__':
    unittest.main()
