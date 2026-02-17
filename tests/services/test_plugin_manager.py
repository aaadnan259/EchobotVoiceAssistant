import sys
import unittest
from unittest.mock import MagicMock

# Mock utils.logger to avoid colorama dependency issues
mock_logger_module = MagicMock()
sys.modules['utils.logger'] = mock_logger_module
mock_logger_module.logger = MagicMock()

from services.plugin_manager import PluginManager

class TestPluginManager(unittest.TestCase):

    def setUp(self):
        """Set up test fixtures."""
        self.plugin_manager = PluginManager()
        # Initialize plugins as empty dictionary
        self.plugin_manager.plugins = {}

    def test_get_tool_definitions_empty(self):
        """Test get_tool_definitions returns empty list when no plugins are loaded."""
        tools = self.plugin_manager.get_tool_definitions()
        self.assertEqual(tools, [])

    def test_get_tool_definitions_weather(self):
        """Test get_tool_definitions returns weather tool when Weather plugin is loaded."""
        self.plugin_manager.plugins["Weather"] = "MockWeatherPlugin" # Value doesn't matter for this test
        tools = self.plugin_manager.get_tool_definitions()

        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["function"]["name"], "get_weather")
        self.assertEqual(tools[0]["type"], "function")

    def test_get_tool_definitions_wikipedia(self):
        """Test get_tool_definitions returns wikipedia tool when Wikipedia plugin is loaded."""
        self.plugin_manager.plugins["Wikipedia"] = "MockWikipediaPlugin"
        tools = self.plugin_manager.get_tool_definitions()

        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["function"]["name"], "search_wikipedia")
        self.assertEqual(tools[0]["type"], "function")

    def test_get_tool_definitions_web_search(self):
        """Test get_tool_definitions returns web search tool when WebSearch plugin is loaded."""
        self.plugin_manager.plugins["WebSearch"] = "MockWebSearchPlugin"
        tools = self.plugin_manager.get_tool_definitions()

        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["function"]["name"], "web_search")
        self.assertEqual(tools[0]["type"], "function")

    def test_get_tool_definitions_all(self):
        """Test get_tool_definitions returns all tools when all plugins are loaded."""
        self.plugin_manager.plugins = {
            "Weather": "MockWeatherPlugin",
            "Wikipedia": "MockWikipediaPlugin",
            "WebSearch": "MockWebSearchPlugin"
        }
        tools = self.plugin_manager.get_tool_definitions()

        self.assertEqual(len(tools), 3)
        tool_names = [t["function"]["name"] for t in tools]
        self.assertIn("get_weather", tool_names)
        self.assertIn("search_wikipedia", tool_names)
        self.assertIn("web_search", tool_names)

    def test_get_tool_definitions_unknown(self):
        """Test get_tool_definitions ignores unknown plugins."""
        self.plugin_manager.plugins = {
            "UnknownPlugin": "MockUnknownPlugin"
        }
        tools = self.plugin_manager.get_tool_definitions()
        self.assertEqual(tools, [])

if __name__ == '__main__':
    unittest.main()
