import unittest
import sys
import importlib
from unittest.mock import MagicMock, patch

class TestPluginManager(unittest.TestCase):
    def setUp(self):
        # Create a mock for utils.logger
        self.mock_logger_instance = MagicMock()
        self.mock_logger_module = MagicMock()
        self.mock_logger_module.logger = self.mock_logger_instance

        # Patch sys.modules to inject the mock logger
        self.patcher = patch.dict(sys.modules, {'utils.logger': self.mock_logger_module})
        self.patcher.start()

        # Import (or reload) the module under test ensuring it uses the mock logger
        # This handles cases where the module might have been imported by other tests
        if 'services.plugin_manager' in sys.modules:
            import services.plugin_manager
            importlib.reload(services.plugin_manager)
        else:
            import services.plugin_manager

        self.plugin_manager_module = services.plugin_manager
        self.PluginManager = self.plugin_manager_module.PluginManager
        self.manager = self.PluginManager()
        # Ensure plugins dict is empty for isolation
        self.manager.plugins = {}

        # Setup mock plugins
        self.mock_weather_plugin = MagicMock()
        self.mock_wikipedia_plugin = MagicMock()
        self.mock_web_search_plugin = MagicMock()

        self.mock_weather_plugin.get_weather.return_value = "Sunny, 25C"
        self.mock_wikipedia_plugin.search.return_value = "Python is a programming language."
        self.mock_web_search_plugin.search.return_value = "Latest news: AI is booming."

    def tearDown(self):
        self.patcher.stop()

    def test_execute_tool_get_weather(self):
        self.manager.plugins["Weather"] = self.mock_weather_plugin
        result = self.manager.execute_tool("get_weather", {"location": "London"})
        self.mock_weather_plugin.get_weather.assert_called_with("London")
        self.assertEqual(result, "Sunny, 25C")

    def test_execute_tool_search_wikipedia(self):
        self.manager.plugins["Wikipedia"] = self.mock_wikipedia_plugin
        result = self.manager.execute_tool("search_wikipedia", {"query": "Python"})
        self.mock_wikipedia_plugin.search.assert_called_with("Python")
        self.assertEqual(result, "Python is a programming language.")

    def test_execute_tool_web_search(self):
        self.manager.plugins["WebSearch"] = self.mock_web_search_plugin
        result = self.manager.execute_tool("web_search", {"query": "AI news"})
        self.mock_web_search_plugin.search.assert_called_with("AI news")
        self.assertEqual(result, "Latest news: AI is booming.")

    def test_execute_tool_unknown_tool(self):
        result = self.manager.execute_tool("unknown_tool", {})
        self.assertIn("Tool unknown_tool not found or plugin not loaded", result)

    def test_execute_tool_plugin_not_loaded(self):
        # Weather plugin is not in self.manager.plugins
        result = self.manager.execute_tool("get_weather", {"location": "London"})
        self.assertIn("Tool get_weather not found or plugin not loaded", result)

    def test_execute_tool_exception(self):
        self.manager.plugins["Weather"] = self.mock_weather_plugin
        self.mock_weather_plugin.get_weather.side_effect = Exception("API Error")

        result = self.manager.execute_tool("get_weather", {"location": "London"})
        self.assertIn("Error executing tool get_weather: API Error", result)

        # Verify logger error was called on the mocked logger instance
        self.mock_logger_instance.error.assert_called()

if __name__ == '__main__':
    unittest.main()
