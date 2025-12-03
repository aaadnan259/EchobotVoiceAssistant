import requests
from typing import Dict, Any
from services.plugin_manager import Plugin
from config.loader import ConfigLoader
from utils.logger import logger

class WeatherPlugin(Plugin):
    name = "Weather"
    description = "Provides current weather information."
    intents = ["weather"]

    def __init__(self):
        super().__init__()
        self.api_key = ConfigLoader.get("plugins.openweather_api_key")
        self.base_url = "http://api.openweathermap.org/data/2.5/weather"

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        location = entities.get("location") or ConfigLoader.get("voice.default_location", "New York")
        return self.get_weather(location)

    def get_weather(self, location: str) -> str:
        if not self.api_key:
            return "Weather service is not configured. Please add OPENWEATHER_API_KEY to your .env file."

        try:
            params = {
                "q": location,
                "appid": self.api_key,
                "units": "imperial"
            }
            
            logger.info(f"Fetching weather for: {location}")
            response = requests.get(self.base_url, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            
            temp = data["main"]["temp"]
            feels_like = data["main"]["feels_like"]
            description = data["weather"][0]["description"]
            humidity = data["main"]["humidity"]
            city = data["name"]
            
            return (
                f"The current weather in {city} is {description}. "
                f"Temperature is {temp:.0f} degrees Fahrenheit, "
                f"feels like {feels_like:.0f}. "
                f"Humidity is {humidity} percent."
            )
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Weather API error: {e}")
            return f"Sorry, I couldn't fetch the weather for {location}."
        except (KeyError, ValueError) as e:
            logger.error(f"Weather data parsing error: {e}")
            return f"Sorry, I couldn't find weather information for {location}."
