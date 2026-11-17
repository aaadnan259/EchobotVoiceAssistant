from datetime import datetime
from typing import Dict, Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from services.plugin_manager import Plugin

class TimePlugin(Plugin):
    name = "Time"
    description = "Tells the current date and time."
    intents = ["time", "date"]

    def describe_now(self, tz_name: Optional[str] = None) -> Dict[str, str]:
        """Current date/time in an IANA timezone (default UTC). Raises ValueError
        with a message that is safe to show to a model for an unknown zone."""
        name = tz_name or "UTC"
        try:
            tz = ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError, OSError):
            raise ValueError(
                f"Unknown timezone {name!r}. Use an IANA name such as 'Europe/Paris'."
            )
        now = datetime.now(tz)
        return {
            "timezone": name,
            "iso": now.isoformat(timespec="seconds"),
            "date": now.strftime("%A, %B %d, %Y"),
            "time": now.strftime("%H:%M"),
            "utc_offset": now.strftime("%z"),
        }

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        now = datetime.now()
        if intent == "time":
            return f"It is currently {now.strftime('%I:%M %p')}."
        elif intent == "date":
            return f"Today is {now.strftime('%A, %B %d, %Y')}."
        return ""
