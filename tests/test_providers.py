import sys
import os
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock logger before importing module that uses it
sys.modules["utils.logger"] = MagicMock()
sys.modules["config.loader"] = MagicMock()

from services.llm.providers.google_gemini import GeminiProvider

class TestGeminiProvider(unittest.TestCase):
    def setUp(self):
        self.api_key = "fake_key"
        self.provider = GeminiProvider(api_key=self.api_key)

    @patch("google.genai.Client")
    def test_init(self, mock_client):
        provider = GeminiProvider(api_key="key")
        self.assertIsNotNone(provider.client)

    def test_format_contents_user(self):
        messages = [{"role": "user", "content": "Hello"}]
        contents, system_Instruction = self.provider._format_contents(messages)
        
        self.assertEqual(len(contents), 1)
        self.assertEqual(contents[0]["role"], "user")
        self.assertEqual(contents[0]["parts"][0]["text"], "Hello")
        self.assertIsNone(system_Instruction)

    def test_format_contents_system(self):
        messages = [
            {"role": "system", "content": "Be helpful"},
            {"role": "user", "content": "Hi"}
        ]
        contents, system_instruction = self.provider._format_contents(messages)
        
        self.assertEqual(system_instruction, "Be helpful")
        self.assertEqual(len(contents), 1)

if __name__ == "__main__":
    unittest.main()
