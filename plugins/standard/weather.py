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
            logger.warning("OpenWeather API key missing. Falling back to wttr.in.")
            return self.get_weather_fallback(location)

        try:
            # 1. Geocoding API to get Lat/Lon
            geo_url = "http://api.openweathermap.org/geo/1.0/direct"
            geo_params = {
                "q": location,
                "limit": 1,
                "appid": self.api_key
            }
            logger.info(f"Geocoding location: {location}")
            geo_response = requests.get(geo_url, params=geo_params, timeout=5)
            geo_response.raise_for_status()
            geo_data = geo_response.json()

            if not geo_data:
                return f"Sorry, I couldn't find the location '{location}'."

            lat = geo_data[0]["lat"]
            lon = geo_data[0]["lon"]
            city_name = geo_data[0]["name"]

            # 2. One Call API 3.0
            onecall_url = "https://api.openweathermap.org/data/3.0/onecall"
            weather_params = {
                "lat": lat,
                "lon": lon,
                "exclude": "minutely,hourly",
                "units": "imperial",
                "appid": self.api_key
            }
            
            logger.info(f"Fetching One Call weather for: {city_name} ({lat}, {lon})")
            response = requests.get(onecall_url, params=weather_params, timeout=5)
            
            # Handle 401 specifically for subscription issues
            if response.status_code == 401:
                logger.error("OpenWeather One Call API 401 Unauthorized. Check subscription.")
                return "I have an API key, but it seems the One Call API subscription is not active. Falling back to basic weather."
            
            response.raise_for_status()
            data = response.json()
            
            # Current Weather
            current = data["current"]
            temp = current["temp"]
            feels_like = current["feels_like"]
            condition = current["weather"][0]["description"]
            humidity = current["humidity"]
            uv_index = current["uvi"]

            # Daily Forecast (Today)
            daily = data["daily"][0]
            temp_max = daily["temp"]["max"]
            temp_min = daily["temp"]["min"]
            summary = daily.get("summary", "No summary available.")

            return (
                f"Weather in {city_name}: {condition.capitalize()}. "
                f"Current temperature is {temp:.0f}°F (feels like {feels_like:.0f}°F). "
                f"High: {temp_max:.0f}°F, Low: {temp_min:.0f}°F. "
                f"Humidity: {humidity}%. UV Index: {uv_index}. "
                f"Forecast: {summary}"
            )
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Weather API error: {e}")
            return self.get_weather_fallback(location)
        except (KeyError, ValueError, IndexError) as e:
            logger.error(f"Weather data parsing error: {e}")
            return f"Sorry, I couldn't process the weather data for {location}."

    def get_weather_fallback(self, location: str) -> str:
        """Fallback using wttr.in (no API key required)."""
        try:
            # format=3 returns "Location: Condition Temp"
            url = f"https://wttr.in/{location}?format=3"
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return f"Current weather: {response.text.strip()}"
        except Exception as e:
            logger.error(f"Fallback weather error: {e}")
            return f"Sorry, I couldn't fetch the weather for {location}."
