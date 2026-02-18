import unittest
from unittest.mock import MagicMock, patch, ANY
import sys
import os

# Mock dependencies before imports
sys.modules['apscheduler'] = MagicMock()
sys.modules['apscheduler.schedulers'] = MagicMock()
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler.triggers'] = MagicMock()
sys.modules['apscheduler.triggers.date'] = MagicMock()
sys.modules['colorama'] = MagicMock()
sys.modules['utils.logger'] = MagicMock()
sys.modules['yaml'] = MagicMock()

# Mock ConfigLoader module
mock_config_loader = MagicMock()
sys.modules['config.loader'] = mock_config_loader
# Ensure ConfigLoader class exists on the mock module
mock_config_loader.ConfigLoader = MagicMock()

# Mock sqlite3
mock_sqlite3 = MagicMock()
sys.modules['sqlite3'] = mock_sqlite3

from plugins.standard.reminders import ReminderPlugin

class TestReminderPlugin(unittest.TestCase):
    def setUp(self):
        # Patch ConfigLoader class in the module
        self.mock_config_class = mock_config_loader.ConfigLoader
        # get method
        self.mock_config_class.get.return_value = ":memory:"

        self.mock_makedirs_patcher = patch('os.makedirs')
        self.mock_makedirs = self.mock_makedirs_patcher.start()

        # Mock sqlite3 connection
        self.mock_conn = MagicMock()
        self.mock_cursor = MagicMock()
        self.mock_conn.cursor.return_value = self.mock_cursor
        mock_sqlite3.connect.return_value = self.mock_conn
        self.mock_conn.execute.return_value = self.mock_cursor

        self.plugin = ReminderPlugin()

    def tearDown(self):
        self.mock_makedirs_patcher.stop()

    def test_trigger_reminder_callback(self):
        mock_callback = MagicMock()

        if hasattr(self.plugin, 'set_callback'):
            self.plugin.set_callback(mock_callback)

            # Trigger reminder
            r_id = 1
            task = "Buy milk"
            self.plugin._trigger_reminder(r_id, task)

            # Verify DB update
            self.mock_conn.execute.assert_called_with(
                "UPDATE reminders SET triggered = 1 WHERE id = ?", (r_id,)
            )

            # Verify callback
            mock_callback.assert_called_with("notification", {"text": f"Reminder: {task}"})
        else:
            self.fail("ReminderPlugin does not have set_callback method")

if __name__ == '__main__':
    unittest.main()
