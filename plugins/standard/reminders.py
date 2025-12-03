import sqlite3
import re
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from services.plugin_manager import Plugin
from config.loader import ConfigLoader
from utils.logger import logger

class ReminderPlugin(Plugin):
    name = "Reminders"
    description = "Manages persistent reminders."
    intents = ["reminder_set", "reminder_list", "reminder_delete"]

    def __init__(self):
        super().__init__()
        self.db_path = ConfigLoader.get("storage.db_path", "storage/db/echobot.db")
        
        # Ensure DB directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self._init_db()
        self._load_reminders()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task TEXT NOT NULL,
                reminder_time TEXT,
                created_at TEXT NOT NULL,
                triggered BOOLEAN DEFAULT 0
            )
        ''')
        conn.commit()
        conn.close()

    def _load_reminders(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reminders WHERE triggered = 0")
        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            r_id, task, r_time, _, _ = row
            if r_time:
                try:
                    dt = datetime.fromisoformat(r_time)
                    if dt > datetime.now():
                        self._schedule_job(r_id, task, dt)
                except Exception as e:
                    logger.error(f"Error loading reminder {r_id}: {e}")

    def _schedule_job(self, r_id: int, task: str, dt: datetime):
        self.scheduler.add_job(
            self._trigger_reminder,
            DateTrigger(run_date=dt),
            args=[r_id, task],
            id=f"reminder_{r_id}",
            replace_existing=True
        )

    def _trigger_reminder(self, r_id: int, task: str):
        logger.info(f"TRIGGER REMINDER: {task}")
        # Mark as triggered
        conn = sqlite3.connect(self.db_path)
        conn.execute("UPDATE reminders SET triggered = 1 WHERE id = ?", (r_id,))
        conn.commit()
        conn.close()
        # TODO: Callback to main system to speak/notify
        # For now, we just log it. The main loop or UI should poll or subscribe.

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        if intent == "reminder_set":
            task = entities.get("task")
            time_str = entities.get("time")
            return self.add_reminder(task, time_str)
        elif intent == "reminder_list":
            return self.list_reminders()
        elif intent == "reminder_delete":
            # This is tricky via voice without an ID.
            # We might need to implement "delete the last one" or "delete all"
            return "Deleting specific reminders via voice is not fully implemented yet."
        return "I'm not sure what you want to do with reminders."

    def add_reminder(self, task: str, time_str: Optional[str]) -> str:
        if not task:
            return "What should I remind you about?"
        
        reminder_time = self._parse_time(time_str) if time_str else None
        reminder_time_iso = reminder_time.isoformat() if reminder_time else None

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO reminders (task, reminder_time, created_at) VALUES (?, ?, ?)",
            (task, reminder_time_iso, datetime.now().isoformat())
        )
        r_id = cursor.lastrowid
        conn.commit()
        conn.close()

        if reminder_time:
            self._schedule_job(r_id, task, reminder_time)
            fmt_time = reminder_time.strftime("%I:%M %p")
            return f"Okay, I'll remind you to {task} at {fmt_time}."
        else:
            return f"Okay, I've noted: {task}."

    def list_reminders(self) -> str:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT task, reminder_time FROM reminders WHERE triggered = 0 ORDER BY reminder_time ASC")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return "You have no active reminders."
        
        response = "Here are your reminders: "
        for task, r_time in rows:
            if r_time:
                dt = datetime.fromisoformat(r_time)
                response += f"{task} at {dt.strftime('%I:%M %p')}. "
            else:
                response += f"{task}. "
        return response

    def _parse_time(self, time_str: str) -> Optional[datetime]:
        """Simple time parser. Can be improved with dateparser lib."""
        if not time_str: return None
        try:
            time_str = time_str.strip().lower()
            now = datetime.now()
            
            # "5pm", "5 pm"
            match = re.match(r'(\d{1,2})\s*(am|pm)', time_str)
            if match:
                hour = int(match.group(1))
                meridiem = match.group(2)
                if meridiem == 'pm' and hour != 12: hour += 12
                elif meridiem == 'am' and hour == 12: hour = 0
                dt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
                if dt <= now: dt += timedelta(days=1)
                return dt
            
            # "17:00"
            match = re.match(r'(\d{1,2}):(\d{2})', time_str)
            if match:
                h, m = map(int, match.groups())
                dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
                if dt <= now: dt += timedelta(days=1)
                return dt
                
            return None
        except:
            return None
