import pytest

import unittest
from unittest.mock import MagicMock, patch
import sys

class TestLLMServiceInit(unittest.TestCase):
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

        from services.llm.llm_service import LLMService
        self.LLMService = LLMService

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
        self.mock_memory_module.reset_mock()
        self.mock_memory_service_cls = MagicMock()
        self.mock_memory_service_instance = MagicMock()
        self.mock_memory_service_cls.return_value = self.mock_memory_service_instance
        self.mock_memory_module.MemoryService = self.mock_memory_service_cls

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_genai_patcher.stop()
        self.mock_openai_patcher.stop()
        self.mock_logger_patcher.stop()
        self.modules_patcher.stop()

    def test_default_provider(self):
        """Test provider defaults to 'openai' when config returns None."""
        self.mock_config.get.side_effect = lambda key, default=None: default if key == "ai.provider" else None

        service = self.LLMService()

        self.assertEqual(service.provider, "openai")

    def test_google_provider_config(self):
        """Test provider is 'google' when configured."""
        self.mock_config.get.side_effect = lambda key, default=None: "google" if key == "ai.provider" else None

        service = self.LLMService()

        self.assertEqual(service.provider, "google")

    def test_hardcoded_model_name(self):
        """Test model_name respects config instead of hardcoded."""
        self.mock_config.get.side_effect = lambda key, default=None: "custom-model" if key == "ai.llm_model" else default

        service = self.LLMService()

        self.assertEqual(service.model_name, "custom-model")

        # Try with google
        self.mock_config.get.side_effect = lambda key, default=None: "google" if key == "ai.provider" else "gemini-2.5-flash" if key == "ai.llm_model" else default
        service = self.LLMService()
        self.assertEqual(service.model_name, "gemini-2.5-flash")

    def test_google_client_init(self):
        """Test Google Client initialization."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "google"
            if key == "ai.google_api_key": return "fake_google_key"
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = self.LLMService()

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

        service = self.LLMService()

        self.mock_openai.OpenAI.assert_called_once_with(api_key="fake_openai_key")
        self.assertIsNotNone(service.client)

    def test_google_missing_key(self):
        """Test Google provider with missing API key."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "google"
            if key == "ai.google_api_key": return None
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = self.LLMService()

        self.assertIsNone(service.client)
        self.mock_logger.warning.assert_called_with("Google API Key not found.")

    def test_openai_missing_key(self):
        """Test OpenAI provider with missing API key."""
        def config_side_effect(key, default=None):
            if key == "ai.provider": return "openai"
            if key == "ai.openai_api_key": return None
            return default
        self.mock_config.get.side_effect = config_side_effect

        service = self.LLMService()

        self.assertIsNone(service.client)
        self.mock_logger.warning.assert_called_with("AI Provider is OpenAI but no API Key found.")

    def test_memory_service_init_success(self):
        """Test successful MemoryService initialization."""
        mock_instance = MagicMock()
        self.mock_memory_service_cls.return_value = mock_instance

        service = self.LLMService()

        self.mock_memory_service_cls.assert_called_once()
        self.assertEqual(service.memory_service, mock_instance)
        self.mock_logger.info.assert_any_call("MemoryService initialized successfully.")

    def test_memory_service_init_failure(self):
        """Test MemoryService initialization failure."""
        self.mock_memory_service_cls.side_effect = Exception("Memory Error")

        service = self.LLMService()

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
