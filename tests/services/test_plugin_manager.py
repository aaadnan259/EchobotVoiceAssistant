import sys
import unittest
from unittest.mock import MagicMock, patch, call
import os

# Mock dependencies before import
mock_logger = MagicMock()
sys.modules["utils.logger"] = mock_logger

from services.plugin_manager import PluginManager

class TestPluginManager(unittest.TestCase):
    def setUp(self):
        self.plugin_manager = PluginManager()
        # Mock the internal method to isolate testing load_plugins
        self.plugin_manager._load_plugin_from_file = MagicMock()

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

        mock_logger.logger.warning.assert_called_with("Plugin directory /non/existent/path does not exist.")
        self.plugin_manager._load_plugin_from_file.assert_not_called()

if __name__ == '__main__':
    unittest.main()
