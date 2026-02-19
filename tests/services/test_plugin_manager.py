import sys
import unittest
import os
from unittest.mock import MagicMock, patch, call

# Mock utils.logger to avoid colorama dependency issues
# ensure it's mocked before import
mock_logger = MagicMock()
sys.modules["utils.logger"] = mock_logger

from services.plugin_manager import PluginManager

class TestPluginManager(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        """Set up test fixtures."""
        self.plugin_manager = PluginManager()
        # Initialize plugins as empty dictionary
        self.plugin_manager.plugins = {}
        # Mock the internal method to isolate testing load_plugins
        self.plugin_manager._load_plugin_from_file = MagicMock()

        # Setup mock plugins for execute_tool tests
        self.mock_weather_plugin = MagicMock()
        self.mock_wikipedia_plugin = MagicMock()
        self.mock_web_search_plugin = MagicMock()

        self.mock_weather_plugin.get_weather.return_value = "Sunny, 25C"
        self.mock_wikipedia_plugin.search.return_value = "Python is a programming language."
        self.mock_web_search_plugin.search.return_value = "Latest news: AI is booming."

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

    @patch("services.plugin_manager.os.walk")
    @patch("services.plugin_manager.os.path.exists")
    @patch("services.plugin_manager.os.path.abspath")
    def test_load_plugins_traversal(self, mock_abspath, mock_exists, mock_walk):
        # Setup mocks
        mock_abspath.return_value = "/mock/base/path"
        mock_exists.return_value = True

        # Simulate directory structure:
        # /mock/base/path
        # ├── plugin1.py
        # ├── __init__.py (ignored)
        # └── subdir
        #     └── plugin2.py
        mock_walk.return_value = [
            ("/mock/base/path", ["subdir"], ["plugin1.py", "__init__.py", "README.md"]),
            ("/mock/base/path/subdir", [], ["plugin2.py", "data.json"]),
        ]

        # Call the method
        self.plugin_manager.load_plugins("plugins")

        # Verify calls
        mock_abspath.assert_called_with("plugins")
        mock_exists.assert_called_with("/mock/base/path")
        mock_walk.assert_called_with("/mock/base/path")

        # Verify _load_plugin_from_file calls
        # Use os.path.join logic for verification since the code uses it
        path1 = os.path.join("/mock/base/path", "plugin1.py")
        path2 = os.path.join("/mock/base/path/subdir", "plugin2.py")

        expected_calls = [
            call(path1, "/mock/base/path"),
            call(path2, "/mock/base/path")
        ]

        self.plugin_manager._load_plugin_from_file.assert_has_calls(expected_calls, any_order=True)
        self.assertEqual(self.plugin_manager._load_plugin_from_file.call_count, 2)

    @patch("services.plugin_manager.os.path.exists")
    @patch("services.plugin_manager.os.path.abspath")
    def test_load_plugins_directory_not_exists(self, mock_abspath, mock_exists):
        mock_abspath.return_value = "/non/existent/path"
        mock_exists.return_value = False

        self.plugin_manager.load_plugins("plugins")

        # Verify no plugins loaded
        self.plugin_manager._load_plugin_from_file.assert_not_called()

    # --- execute_tool tests ---

    async def test_execute_tool_get_weather(self):
        self.plugin_manager.plugins["Weather"] = self.mock_weather_plugin
        result = await self.plugin_manager.execute_tool("get_weather", {"location": "London"})
        self.mock_weather_plugin.get_weather.assert_called_with("London")
        self.assertEqual(result, "Sunny, 25C")

    async def test_execute_tool_search_wikipedia(self):
        self.plugin_manager.plugins["Wikipedia"] = self.mock_wikipedia_plugin
        result = await self.plugin_manager.execute_tool("search_wikipedia", {"query": "Python"})
        self.mock_wikipedia_plugin.search.assert_called_with("Python")
        self.assertEqual(result, "Python is a programming language.")

    async def test_execute_tool_web_search(self):
        self.plugin_manager.plugins["WebSearch"] = self.mock_web_search_plugin
        result = await self.plugin_manager.execute_tool("web_search", {"query": "AI news"})
        self.mock_web_search_plugin.search.assert_called_with("AI news")
        self.assertEqual(result, "Latest news: AI is booming.")

    async def test_execute_tool_unknown_tool(self):
        result = await self.plugin_manager.execute_tool("unknown_tool", {})
        self.assertIn("Tool unknown_tool not found or plugin not loaded", result)

    async def test_execute_tool_plugin_not_loaded(self):
        # Weather plugin is not in self.plugin_manager.plugins
        result = await self.plugin_manager.execute_tool("get_weather", {"location": "London"})
        self.assertIn("Tool get_weather not found or plugin not loaded", result)

    async def test_execute_tool_exception(self):
        self.plugin_manager.plugins["Weather"] = self.mock_weather_plugin
        self.mock_weather_plugin.get_weather.side_effect = Exception("API Error")

        result = await self.plugin_manager.execute_tool("get_weather", {"location": "London"})
        self.assertIn("Error executing tool get_weather: API Error", result)

        # Verify logger error was called
        mock_logger.logger.error.assert_called()

if __name__ == '__main__':
    unittest.main()
