import requests
import asyncio
from urllib.parse import quote
from typing import Dict, Any
from services.plugin_manager import Plugin, ToolFailure
from config.loader import ConfigLoader
from utils.logger import logger

US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota",
    "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee",
    "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}

# State codes that are also ISO country codes ("Berlin, DE" is Germany, not Delaware).
# For these the state is only expanded when the caller also says US ("Birmingham, AL, US").
_AMBIGUOUS_CODES = {
    "AL", "AR", "AZ", "CA", "CO", "DE", "GA", "ID", "IL", "IN", "KY", "LA", "MA", "MD",
    "ME", "MN", "MO", "MS", "MT", "NC", "NE", "PA", "SC", "SD", "TN", "VA",
}


def normalize_location(location: str) -> str:
    """Expand a two-letter US state code: "Toledo, OH" -> "Toledo, Ohio, US".

    Anything else is returned unchanged, including non-US places and inputs whose
    second part is a country code that is also a state code ("Berlin, DE")."""
    parts = [p.strip() for p in location.split(",") if p.strip()]
    if len(parts) == 2:
        city, region = parts
        code = region.upper()
        if len(region) == 2 and code in US_STATES and code not in _AMBIGUOUS_CODES:
            return f"{city}, {US_STATES[code]}, US"
    elif len(parts) == 3:
        city, region, country = parts
        code = region.upper()
        if len(region) == 2 and code in US_STATES and country.upper() in ("US", "USA"):
            return f"{city}, {US_STATES[code]}, US"
    return location


class WeatherPlugin(Plugin):
    name = "Weather"
    description = "Provides current weather information."
    intents = ["weather"]

    def __init__(self):
        super().__init__()
        self.api_key = ConfigLoader.get("plugins.openweather_api_key")
        self.base_url = "http://api.openweathermap.org/data/2.5/weather"

    async def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        location = entities.get("location") or ConfigLoader.get("voice.default_location", "New York")
        return await self.get_weather(location)

    async def get_weather(self, location: str) -> str:
        """Human-readable result; failures come back as an apology string."""
        try:
            return await self.lookup(location)
        except ToolFailure as exc:
            return f"Sorry, {exc}"

    async def lookup(self, location: str) -> str:
        """Current weather for a location. Raises ToolFailure when the lookup fails,
        so callers (the tool registry) can tell a failure from a real answer."""
        location = normalize_location(location)

        if not self.api_key:
            logger.warning("OpenWeather API key missing. Falling back to wttr.in.")
            return await self.get_weather_fallback(location)

        try:
            # 1. Geocoding API to get Lat/Lon
            geo_url = "https://api.openweathermap.org/geo/1.0/direct"
            geo_params = {
                "q": location,
                "limit": 1,
                "appid": self.api_key
            }
            logger.info(f"Geocoding location: {location}")
            geo_response = await asyncio.to_thread(requests.get, geo_url, params=geo_params, timeout=5)
            geo_response.raise_for_status()
            geo_data = geo_response.json()

            if not geo_data:
                raise ToolFailure(f"I couldn't find the location '{location}'.")

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
            response = await asyncio.to_thread(requests.get, onecall_url, params=weather_params, timeout=5)

            # Handle 401 specifically for subscription issues
            if response.status_code == 401:
                logger.error("OpenWeather One Call API 401 Unauthorized. Check subscription.")
                raise ToolFailure("the weather service is unavailable (API subscription is not active).")

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

        except ToolFailure:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Weather API error: {e}")
            return await self.get_weather_fallback(location)
        except (KeyError, ValueError, IndexError) as e:
            logger.error(f"Weather data parsing error: {e}")
            raise ToolFailure(f"I couldn't process the weather data for {location}.")

    async def get_weather_fallback(self, location: str) -> str:
        """Fallback using wttr.in (no API key required). Raises ToolFailure on error."""
        try:
            # format=3 returns "Location: Condition Temp"
            # quote() so a model-supplied location can't alter the URL path/query.
            url = f"https://wttr.in/{quote(location, safe='')}?format=3"
            response = await asyncio.to_thread(requests.get, url, timeout=5)
            response.raise_for_status()
            return f"Current weather: {response.text.strip()}"
        except Exception as e:
            logger.error(f"Fallback weather error: {e}")
            raise ToolFailure(f"I couldn't fetch the weather for {location}.")
