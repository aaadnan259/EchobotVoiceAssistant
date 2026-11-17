"""Function-calling tools exposed to Gemini.

Each tool wraps an existing plugin behind a declared input schema. Arguments come
from a model, so they are validated before anything runs, every tool call has a
timeout, and results are size-capped before they go back to the model.

Only read-only tools are registered here. Plugins that write data (Reminders) are
deliberately not exposed.
"""
import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from services.plugin_manager import ToolFailure
from utils.logger import logger

TOOL_TIMEOUT_SECONDS = 8.0
RESULT_CAP_CHARS = 4000
DEFAULT_MAX_ARG_CHARS = 500
SUMMARY_CHARS = 200

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


class ToolInputError(ValueError):
    """Bad input for a tool. The message is safe to show to the model and the UI."""


@dataclass(frozen=True)
class ParamSpec:
    name: str
    description: str
    max_length: int = DEFAULT_MAX_ARG_CHARS
    required: bool = True


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    params: Tuple[ParamSpec, ...]
    runner: Callable[[Dict[str, str]], Awaitable[Any]]

    def declaration(self) -> Dict[str, Any]:
        """Gemini function declaration (plain dict; the SDK validates it)."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    p.name: {"type": "string", "description": p.description}
                    for p in self.params
                },
                "required": [p.name for p in self.params if p.required],
            },
        }

    def validate(self, args: Any) -> Dict[str, str]:
        """Return cleaned arguments or raise ToolInputError."""
        if args is None:
            args = {}
        if not isinstance(args, dict):
            raise ToolInputError("Arguments must be an object.")
        known = {p.name for p in self.params}
        unknown = sorted(set(args) - known)
        if unknown:
            raise ToolInputError(f"Unknown argument(s): {', '.join(map(str, unknown))}.")

        clean: Dict[str, str] = {}
        for p in self.params:
            value = args.get(p.name)
            if value is None:
                if p.required:
                    raise ToolInputError(f"Argument '{p.name}' is required.")
                continue
            if not isinstance(value, str):
                raise ToolInputError(f"Argument '{p.name}' must be a string.")
            value = value.strip()
            if not value:
                if p.required:
                    raise ToolInputError(f"Argument '{p.name}' must not be empty.")
                continue
            if len(value) > p.max_length:
                raise ToolInputError(
                    f"Argument '{p.name}' is too long (max {p.max_length} characters)."
                )
            if _CONTROL_CHARS.search(value):
                raise ToolInputError(f"Argument '{p.name}' contains control characters.")
            clean[p.name] = value
        return clean


@dataclass(frozen=True)
class ToolOutcome:
    ok: bool
    text: str      # what the model receives (result text or error message)
    summary: str   # short form for the UI


def _cap(text: str) -> str:
    if len(text) <= RESULT_CAP_CHARS:
        return text
    return text[:RESULT_CAP_CHARS] + "\n...[truncated]"


def _summarize(text: str) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= SUMMARY_CHARS else flat[: SUMMARY_CHARS - 1] + "…"


class ToolRegistry:
    def __init__(self, tools: List[ToolSpec], timeout: float = TOOL_TIMEOUT_SECONDS):
        self._tools: Dict[str, ToolSpec] = {t.name: t for t in tools}
        self.timeout = timeout

    @property
    def names(self) -> List[str]:
        return list(self._tools)

    def declarations(self) -> List[Dict[str, Any]]:
        return [t.declaration() for t in self._tools.values()]

    async def run(self, name: str, args: Any) -> ToolOutcome:
        """Validate and run one tool call. Never raises: every failure becomes an
        error outcome the model can read."""
        spec = self._tools.get(name)
        if spec is None:
            return self._error(f"Unknown tool '{name}'.")
        try:
            clean = spec.validate(args)
        except ToolInputError as exc:
            return self._error(str(exc))

        try:
            result = await asyncio.wait_for(spec.runner(clean), timeout=self.timeout)
        except asyncio.TimeoutError:
            logger.warning(f"Tool {name} timed out after {self.timeout}s")
            return self._error(f"Tool '{name}' timed out after {self.timeout:g} seconds.")
        except (ToolInputError, ToolFailure) as exc:
            # A plugin signalling an expected failure (ToolFailure) or bad input.
            return self._error(str(exc))
        except ValueError as exc:
            # Plugins raise ValueError with a deliberately user-safe message.
            return self._error(str(exc))
        except Exception as exc:  # noqa: BLE001
            # Full detail stays in the server log; the model/UI get a generic message.
            logger.error(f"Tool {name} failed: {exc}", exc_info=True)
            return self._error(f"Tool '{name}' failed.")

        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        text = _cap(text)
        return ToolOutcome(ok=True, text=text, summary=_summarize(text))

    @staticmethod
    def _error(message: str) -> ToolOutcome:
        return ToolOutcome(ok=False, text=message, summary=_summarize(message))


def build_default_registry() -> ToolRegistry:
    """The five read-only tools. A tool whose plugin can't be imported or built
    (for example a missing optional dependency) is skipped, not fatal."""
    tools: List[ToolSpec] = []

    def add(label: str, build: Callable[[], ToolSpec]) -> None:
        try:
            tools.append(build())
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Tool '{label}' unavailable: {exc}")

    def weather() -> ToolSpec:
        from plugins.standard.weather import WeatherPlugin
        plugin = WeatherPlugin()
        return ToolSpec(
            name="get_weather",
            description=(
                "Get the current weather for a place. Give the location as "
                "\"City, Country\" or \"City, State, US\"."
            ),
            params=(ParamSpec(
                "location",
                "\"City, Country\" (e.g. \"Paris, FR\") or \"City, State, US\" (e.g. \"Toledo, Ohio, US\")",
                100,
            ),),
            runner=lambda a: plugin.lookup(a["location"]),
        )

    def wikipedia() -> ToolSpec:
        from plugins.standard.wikipedia import WikipediaPlugin
        plugin = WikipediaPlugin()
        return ToolSpec(
            name="search_wikipedia",
            description="Look up a topic on Wikipedia and get a short summary.",
            params=(ParamSpec("query", "The topic to look up", 200),),
            runner=lambda a: asyncio.to_thread(plugin.search, a["query"]),
        )

    def web_search() -> ToolSpec:
        from plugins.standard.search import WebSearchPlugin
        plugin = WebSearchPlugin()
        return ToolSpec(
            name="web_search",
            description="Search the web for current events or facts the model may not know.",
            params=(ParamSpec("query", "The search query", 200),),
            runner=lambda a: asyncio.to_thread(plugin.search, a["query"]),
        )

    def calculate() -> ToolSpec:
        from plugins.standard.calculator import CalculatorPlugin
        plugin = CalculatorPlugin()
        return ToolSpec(
            name="calculate",
            description=(
                "Evaluate an arithmetic expression using digits, + - * / ( ) and decimals. "
                "Functions such as sqrt are not supported."
            ),
            params=(ParamSpec("expression", "e.g. '(12.5 + 3) * 4'", 200),),
            runner=lambda a: asyncio.to_thread(plugin.evaluate_strict, a["expression"]),
        )

    def current_time() -> ToolSpec:
        from plugins.standard.time_plugin import TimePlugin
        plugin = TimePlugin()
        return ToolSpec(
            name="get_current_time",
            description="Get the current date and time in an IANA timezone (default UTC).",
            params=(ParamSpec("timezone", "IANA timezone, e.g. 'Europe/Paris'", 64, required=False),),
            runner=lambda a: asyncio.to_thread(plugin.describe_now, a.get("timezone")),
        )

    add("get_weather", weather)
    add("search_wikipedia", wikipedia)
    add("web_search", web_search)
    add("calculate", calculate)
    add("get_current_time", current_time)
    return ToolRegistry(tools)
