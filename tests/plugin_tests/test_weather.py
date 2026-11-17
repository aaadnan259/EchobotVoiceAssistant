import asyncio
from unittest.mock import MagicMock, patch

import pytest

from plugins.standard.weather import WeatherPlugin, normalize_location
from services.plugin_manager import ToolFailure


# --- normalize_location ------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("Toledo, OH", "Toledo, Ohio, US"),
    ("Toledo,OH", "Toledo, Ohio, US"),
    ("toledo, oh", "toledo, Ohio, US"),
    ("  Austin ,  TX ", "Austin, Texas, US"),
    ("Portland, OR", "Portland, Oregon, US"),
    ("Washington, DC", "Washington, District of Columbia, US"),
    # Explicit US country: ambiguous codes are fine too.
    ("Birmingham, AL, US", "Birmingham, Alabama, US"),
    ("Toledo, OH, USA", "Toledo, Ohio, US"),
])
def test_two_letter_us_state_codes_are_expanded(raw, expected):
    assert normalize_location(raw) == expected


@pytest.mark.parametrize("raw", [
    "Paris, France",
    "Paris, FR",
    "Tokyo",
    "Tokyo, JP",
    "London, UK",
    "Toledo, Ohio, US",       # already normalized
    "Toledo, Ohio",           # full state name, left alone
    "Toledo, Spain",
    "Toronto, CA",            # CA is Canada here, not California
    "Berlin, DE",             # Germany, not Delaware
    "Cordoba, AR",            # Argentina, not Arkansas
    "Mumbai, IN",             # India, not Indiana
    "Lima, PE",
    "Birmingham, AL",         # ambiguous without "US": left alone
    "Toledo, OH, Canada",
    "",
])
def test_non_us_and_ambiguous_locations_pass_through_unchanged(raw):
    assert normalize_location(raw) == raw


# --- lookup ------------------------------------------------------------------

def fake_response(payload=None, status=200, text=""):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = payload
    resp.text = text
    resp.raise_for_status = MagicMock()
    return resp


def make_plugin(api_key="test-key"):
    with patch("plugins.standard.weather.ConfigLoader") as cfg:
        cfg.get.return_value = api_key
        return WeatherPlugin()


ONECALL = {
    "current": {"temp": 57, "feels_like": 56, "weather": [{"description": "broken clouds"}],
                "humidity": 78, "uvi": 0},
    "daily": [{"temp": {"max": 64, "min": 56}, "summary": "Cloudy."}],
}


def test_lookup_geocodes_the_normalized_location():
    plugin = make_plugin()
    geo = fake_response([{"lat": 41.6, "lon": -83.5, "name": "Toledo"}])
    onecall = fake_response(ONECALL)

    with patch("plugins.standard.weather.requests.get", side_effect=[geo, onecall]) as get:
        text = asyncio.run(plugin.lookup("Toledo, OH"))

    assert get.call_args_list[0].kwargs["params"]["q"] == "Toledo, Ohio, US"
    assert text.startswith("Weather in Toledo: Broken clouds.")


def test_lookup_leaves_non_us_location_unchanged():
    plugin = make_plugin()
    geo = fake_response([{"lat": 48.8, "lon": 2.3, "name": "Paris"}])
    onecall = fake_response(ONECALL)

    with patch("plugins.standard.weather.requests.get", side_effect=[geo, onecall]) as get:
        asyncio.run(plugin.lookup("Paris, FR"))

    assert get.call_args_list[0].kwargs["params"]["q"] == "Paris, FR"


def test_lookup_raises_tool_failure_when_place_not_found():
    plugin = make_plugin()
    with patch("plugins.standard.weather.requests.get", return_value=fake_response([])):
        with pytest.raises(ToolFailure) as exc:
            asyncio.run(plugin.lookup("Xyzzyville, Nowhere"))
    assert "Xyzzyville, Nowhere" in str(exc.value)


def test_lookup_raises_tool_failure_when_fallback_also_fails():
    plugin = make_plugin(api_key=None)
    bad = fake_response(status=404, text="Unknown location")
    bad.raise_for_status.side_effect = RuntimeError("404")
    with patch("plugins.standard.weather.requests.get", return_value=bad):
        with pytest.raises(ToolFailure):
            asyncio.run(plugin.lookup("Xyzzyville"))


def test_lookup_raises_tool_failure_on_malformed_weather_data():
    plugin = make_plugin()
    geo = fake_response([{"lat": 1, "lon": 2, "name": "X"}])
    with patch("plugins.standard.weather.requests.get", side_effect=[geo, fake_response({})]):
        with pytest.raises(ToolFailure):
            asyncio.run(plugin.lookup("X, Y"))


def test_wttr_fallback_url_encodes_and_uses_the_normalized_location():
    plugin = make_plugin(api_key=None)
    ok = fake_response(text="Toledo, Ohio, United States: ☀️ +50°F")
    with patch("plugins.standard.weather.requests.get", return_value=ok) as get:
        asyncio.run(plugin.lookup("Toledo, OH"))
    assert get.call_args.args[0] == "https://wttr.in/Toledo%2C%20Ohio%2C%20US?format=3"


def test_legacy_get_weather_still_returns_a_string_on_failure():
    plugin = make_plugin()
    with patch("plugins.standard.weather.requests.get", return_value=fake_response([])):
        text = asyncio.run(plugin.get_weather("Xyzzyville, Nowhere"))
    assert isinstance(text, str) and text.startswith("Sorry")
