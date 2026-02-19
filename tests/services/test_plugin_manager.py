import sys
import unittest
import os
from unittest.mock import MagicMock, patch, call

# Mock utils.logger to avoid colorama dependency issues
# ensure it's mocked before import
mock_logger = MagicMock()
sys.modules["utils.logger"] = mock_logger

from services.plugin_manager import PluginManager

class TestPluginManager(unittest.TestCase):

    def setUp(self):
        """Set up test fixtures."""
        self.plugin_manager = PluginManager()
        # Initialize plugins as empty dictionary (from existing tests)
        self.plugin_manager.plugins = {}
        # Mock the internal method to isolate testing load_plugins (from new tests)
        self.plugin_manager._load_plugin_from_file = MagicMock()

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

        # We can't easily assert the log message on the module-level mock from here cleanly without refactoring
        # but we can verify the behavior that no plugins were loaded
        self.plugin_manager._load_plugin_from_file.assert_not_called()

if __name__ == '__main__':
    unittest.main()
