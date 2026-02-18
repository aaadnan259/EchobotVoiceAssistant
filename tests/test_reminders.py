import sys
import unittest
from unittest.mock import MagicMock, patch

# Add repo root to sys.path
sys.path.append(".")

# Mock utils.logger before importing it
mock_logger = MagicMock()
sys.modules['utils.logger'] = mock_logger
sys.modules['utils.logger'].logger = MagicMock()

# Mock apscheduler before importing reminders
sys.modules['apscheduler'] = MagicMock()
sys.modules['apscheduler.schedulers'] = MagicMock()
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler.triggers'] = MagicMock()
sys.modules['apscheduler.triggers.date'] = MagicMock()

# Mock yaml
sys.modules['yaml'] = MagicMock()

# Mock dotenv
sys.modules['dotenv'] = MagicMock()

from services.plugin_manager import PluginManager, Plugin
from plugins.standard.reminders import ReminderPlugin

class TestReminderCallback(unittest.TestCase):
    def setUp(self):
        self.mock_callback = MagicMock()

    @patch('plugins.standard.reminders.BackgroundScheduler')
    @patch('plugins.standard.reminders.sqlite3')
    @patch('plugins.standard.reminders.ConfigLoader')
    @patch('plugins.standard.reminders.os.makedirs')
    def test_callback_propagation(self, mock_makedirs, mock_config, mock_sqlite, mock_scheduler):
        # Setup mocks to avoid side effects
        mock_config.get.return_value = ":memory:"
        mock_conn = MagicMock()
        mock_sqlite.connect.return_value = mock_conn

        # Instantiate PluginManager
        pm = PluginManager()

        # Instantiate ReminderPlugin manually (simulate loading)
        reminder_plugin = ReminderPlugin()
        pm.plugins["Reminders"] = reminder_plugin

        # Set callback on PM
        pm.set_notification_callback(self.mock_callback)

        # Verify Plugin has callback
        self.assertEqual(reminder_plugin.notification_callback, self.mock_callback)

        # Trigger reminder
        reminder_plugin._trigger_reminder(1, "Test Task")

        # Verify callback called
        self.mock_callback.assert_called_with("Reminder: Test Task")

    @patch('plugins.standard.reminders.BackgroundScheduler')
    @patch('plugins.standard.reminders.sqlite3')
    @patch('plugins.standard.reminders.ConfigLoader')
    @patch('plugins.standard.reminders.os.makedirs')
    def test_callback_propagation_pre_existing(self, mock_makedirs, mock_config, mock_sqlite, mock_scheduler):
        # Test case where callback is set BEFORE plugin is loaded
        mock_config.get.return_value = ":memory:"
        mock_conn = MagicMock()
        mock_sqlite.connect.return_value = mock_conn

        pm = PluginManager()
        pm.set_notification_callback(self.mock_callback)

        # Call _register_plugin manually
        pm._register_plugin(ReminderPlugin)

        reminder_plugin = pm.plugins["Reminders"]
        self.assertEqual(reminder_plugin.notification_callback, self.mock_callback)

if __name__ == "__main__":
    unittest.main()
