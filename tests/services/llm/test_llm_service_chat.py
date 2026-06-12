import pytest
import unittest
from unittest.mock import MagicMock, patch, ANY
import sys
import json

# Mock dependencies before importing LLMService
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['openai'] = MagicMock()


from services.llm.llm_service import LLMService

class TestLLMServiceChat(unittest.TestCase):
    def setUp(self):
        # Setup module patching
        self.mock_memory_module = MagicMock()
        self.mock_client = MagicMock()
        self.modules_patcher = patch.dict(sys.modules, {
            'google': MagicMock(),
            'google.genai': MagicMock(),
            'openai': MagicMock(),
            'services.memory.vector_store': self.mock_memory_module
        })
        self.modules_patcher.start()

        from services.llm.llm_service import LLMService
        self.LLMService = LLMService

        # Patch ConfigLoader to avoid reading real config
        self.mock_config_patcher = patch('services.llm.llm_service.ConfigLoader')
        self.mock_config = self.mock_config_patcher.start().return_value

        # Patch logger to suppress output
        self.mock_logger_patcher = patch('services.llm.llm_service.logger')
        self.mock_logger = self.mock_logger_patcher.start()

        # Manually set up a mock memory service for testing integration
        self.mock_memory_service = MagicMock()
        
        # Mock get_response to return a predictable response
        # Initialize service with google provider
        self.mock_config.get.side_effect = lambda key, default=None: "google" if key == "ai.provider" else "gemini-2.0-flash" if key == "ai.llm_model" else default
        self.service = self.LLMService()
        self.service.memory_service = self.mock_memory_service

        # Set mocked client
        self.service.client = self.mock_client

        self.service.get_response = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "I am a bot."
        self.service.get_response.return_value = mock_response

    def tearDown(self):
        self.mock_config_patcher.stop()
        self.mock_logger_patcher.stop()
        self.modules_patcher.stop()

    def test_chat_uses_memory(self):
        """Test that chat retrieves memories and includes them in context."""
        # Setup memory query return
        self.mock_memory_service.query.return_value = "User likes apples."

        user_input = "What do I like?"
        context = []

        response, _ = self.service.chat(user_input, context)

        # Verify memory was queried
        self.mock_memory_service.query.assert_called_with(user_input)

        # Verify get_response was called with memory context in system message
        call_args = self.service.get_response.call_args
        messages = call_args[0][0] # First arg is messages

        # Find system message
        system_message = next((m for m in messages if m['role'] == 'system'), None)
        self.assertIsNotNone(system_message)
        self.assertIn("Relevant Past Memories:\nUser likes apples.", system_message['content'])

        # Verify memory was updated with the exchange
        expected_exchange = f"User: {user_input}\nAssistant: I am a bot."
        self.mock_memory_service.add.assert_called_with(expected_exchange)

    def test_chat_handles_memory_error(self):
        """Test that chat continues even if memory retrieval fails."""
        # Setup memory query to raise exception
        self.mock_memory_service.query.side_effect = Exception("DB Error")

        user_input = "Hello"

        # Should not raise exception
        response, _ = self.service.chat(user_input)

        self.assertEqual(response, "I am a bot.")

        # Verify error was logged
        self.mock_logger.error.assert_called()

    def test_chat_no_memory_service(self):
        """Test chat behavior when memory service is not available."""
        # Simulate no memory service
        self.service.memory_service = None

        user_input = "Hello"
        response, _ = self.service.chat(user_input)

        self.assertEqual(response, "I am a bot.")

        # get_response should verify system message does not contain "Relevant Past Memories"
        call_args = self.service.get_response.call_args
        messages = call_args[0][0]
        system_message = next((m for m in messages if m['role'] == 'system'), None)
        self.assertNotIn("Relevant Past Memories", system_message['content'])

    def test_chat_passes_tools(self):
        """Test that tools are correctly passed to get_response."""
        tools = [{"name": "test_tool"}]
        self.service.chat("Input", tools=tools)

        # Verify get_response called with tools
        self.service.get_response.assert_called_with(ANY, tools)

if __name__ == '__main__':
    unittest.main()
