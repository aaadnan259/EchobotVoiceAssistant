import unittest
from unittest.mock import MagicMock
import sys

# Mock dependencies that cause issues on import
sys.modules['colorama'] = MagicMock()
sys.modules['utils.logger'] = MagicMock()
sys.modules['config.loader'] = MagicMock()

from plugins.core.help import HelpPlugin

class TestHelpPlugin(unittest.TestCase):
    def setUp(self):
        self.plugin = HelpPlugin()

    def test_handle_no_plugins(self):
        # Case: available_plugins is missing from context
        context = {}
        result = self.plugin.handle("help", {}, context)
        self.assertEqual(result, "I can help you with weather, search, reminders, and more. Just ask!")

    def test_handle_with_plugins(self):
        # Case: available_plugins has several plugins including Help
        context = {
            "available_plugins": [
                {"name": "Weather", "description": "Get weather info"},
                {"name": "Reminders", "description": "Set reminders"},
                {"name": "Help", "description": "Show this help"}
            ]
        }
        result = self.plugin.handle("help", {}, context)
        # It should list Weather and Reminders, but NOT Help
        self.assertEqual(result, "Here are the things I can do: Weather, Reminders.")
        self.assertIn("Weather", result)
        self.assertIn("Reminders", result)
        self.assertNotIn("Help", result.split(": ")[1])

    def test_handle_empty_plugin_list(self):
        # Case: available_plugins is an empty list
        context = {"available_plugins": []}
        result = self.plugin.handle("help", {}, context)
        self.assertEqual(result, "I can help you with weather, search, reminders, and more. Just ask!")

if __name__ == '__main__':
    unittest.main()
