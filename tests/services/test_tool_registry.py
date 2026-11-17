import asyncio

import pytest

from services.plugin_manager import ToolFailure
from services.tool_registry import (
    RESULT_CAP_CHARS,
    ParamSpec,
    ToolInputError,
    ToolRegistry,
    ToolSpec,
    build_default_registry,
)


def run(coro):
    return asyncio.run(coro)


def make_spec(runner, name="echo", params=None):
    return ToolSpec(
        name=name,
        description="test tool",
        params=params or (ParamSpec("text", "some text", 20),),
        runner=runner,
    )


@pytest.fixture(scope="module")
def default_registry():
    return build_default_registry()


# --- registry contents -------------------------------------------------------

def test_default_registry_exposes_exactly_the_five_read_only_tools(default_registry):
    assert sorted(default_registry.names) == [
        "calculate", "get_current_time", "get_weather", "search_wikipedia", "web_search",
    ]
    assert not any("remind" in n for n in default_registry.names)


def test_declarations_use_gemini_function_shape(default_registry):
    decls = {d["name"]: d for d in default_registry.declarations()}
    weather = decls["get_weather"]["parameters"]
    assert weather["type"] == "object"
    assert weather["required"] == ["location"]
    assert weather["properties"]["location"]["type"] == "string"
    assert decls["get_current_time"]["parameters"]["required"] == []


# --- argument validation -----------------------------------------------------

@pytest.mark.parametrize("args,fragment", [
    ({}, "required"),
    (None, "required"),
    ({"text": ""}, "must not be empty"),
    ({"text": "   "}, "must not be empty"),
    ({"text": 5}, "must be a string"),
    ({"text": ["a"]}, "must be a string"),
    ({"text": "x" * 21}, "too long"),
    ({"text": "bad\x00char"}, "control characters"),
    ({"text": "ok", "extra": "nope"}, "Unknown argument"),
    ("not a dict", "must be an object"),
])
def test_validation_rejects_bad_input_without_running_the_tool(args, fragment):
    calls = []

    async def runner(a):
        calls.append(a)
        return "ran"

    registry = ToolRegistry([make_spec(runner)])
    outcome = run(registry.run("echo", args))

    assert outcome.ok is False
    assert fragment in outcome.text
    assert calls == []


def test_validation_strips_whitespace_and_passes_clean_args():
    seen = {}

    async def runner(a):
        seen.update(a)
        return "ok"

    outcome = run(ToolRegistry([make_spec(runner)]).run("echo", {"text": "  hi  "}))
    assert outcome.ok is True
    assert seen == {"text": "hi"}


def test_unknown_tool_is_an_error_outcome():
    outcome = run(ToolRegistry([]).run("nope", {}))
    assert outcome.ok is False and "Unknown tool" in outcome.text


def test_validate_raises_tool_input_error():
    spec = make_spec(lambda a: None)
    with pytest.raises(ToolInputError):
        spec.validate({"text": 1})


# --- timeouts, failures, caps -----------------------------------------------

def test_tool_timeout_becomes_an_error_outcome():
    async def slow(a):
        await asyncio.sleep(5)
        return "never"

    registry = ToolRegistry([make_spec(slow)], timeout=0.05)
    outcome = run(registry.run("echo", {"text": "hi"}))
    assert outcome.ok is False
    assert "timed out" in outcome.text


def test_unexpected_exception_does_not_leak_detail():
    async def boom(a):
        raise RuntimeError("secret internal detail")

    outcome = run(ToolRegistry([make_spec(boom)]).run("echo", {"text": "hi"}))
    assert outcome.ok is False
    assert "secret" not in outcome.text and "secret" not in outcome.summary
    assert "failed" in outcome.text


def test_tool_failure_is_reported_as_not_ok_with_its_message():
    async def fails(a):
        raise ToolFailure("I couldn't find the location 'Nowhere'.")

    outcome = run(ToolRegistry([make_spec(fails)]).run("echo", {"text": "hi"}))
    assert outcome.ok is False
    assert outcome.text == "I couldn't find the location 'Nowhere'."


def test_apology_string_without_a_signal_is_still_ok():
    """Documents the contract: only an explicit ToolFailure marks a result as failed."""
    async def apologises(a):
        return "Sorry, nothing."

    assert run(ToolRegistry([make_spec(apologises)]).run("echo", {"text": "hi"})).ok is True


def test_weather_tool_description_tells_the_model_the_location_format(default_registry):
    decl = {d["name"]: d for d in default_registry.declarations()}["get_weather"]
    assert "City, Country" in decl["description"] and "City, State, US" in decl["description"]
    assert "City, State, US" in decl["parameters"]["properties"]["location"]["description"]


def test_result_is_capped():
    async def big(a):
        return "x" * (RESULT_CAP_CHARS * 3)

    outcome = run(ToolRegistry([make_spec(big)]).run("echo", {"text": "hi"}))
    assert outcome.ok is True
    assert len(outcome.text) <= RESULT_CAP_CHARS + 20
    assert outcome.text.endswith("[truncated]")


def test_dict_results_are_json_encoded():
    async def d(a):
        return {"k": "v"}

    outcome = run(ToolRegistry([make_spec(d)]).run("echo", {"text": "hi"}))
    assert outcome.text == '{"k": "v"}'


# --- calculate ---------------------------------------------------------------

def calc(registry, expression):
    return run(registry.run("calculate", {"expression": expression}))


def test_calculate_basic_arithmetic(default_registry):
    out = calc(default_registry, "(12.5 + 3) * 4")
    assert out.ok is True
    assert out.text == "(12.5 + 3) * 4 = 62"


@pytest.mark.parametrize("expression", [
    "sqrt(16)", "sin(1)", "2 ^ 3", "import os", "__import__('os')", "5 % 2", "abs(-3)",
])
def test_calculate_rejects_sqrt_style_input_instead_of_stripping_it(default_registry, expression):
    out = calc(default_registry, expression)
    assert out.ok is False
    # The old handle() path would have stripped letters and answered something;
    # make sure no answer is produced.
    assert " = " not in out.text
    assert "Unsupported characters" in out.text


def test_calculate_sqrt_is_not_silently_evaluated_as_16(default_registry):
    out = calc(default_registry, "sqrt(16)")
    assert out.ok is False
    assert "16" not in out.text.replace("sqrt", "")


@pytest.mark.parametrize("expression", [
    "1/0", "10 // 3", "2 +", "((((", "(-8)**0.5", "9**9**9", "((9**999)**999)**999", "2**5000",
])
def test_calculate_rejects_invalid_or_oversized_expressions(default_registry, expression):
    out = calc(default_registry, expression)
    assert out.ok is False


def test_calculate_expression_length_is_capped(default_registry):
    assert calc(default_registry, "1+" * 150 + "1").ok is False


# --- get_current_time --------------------------------------------------------

def test_time_defaults_to_utc(default_registry):
    out = run(default_registry.run("get_current_time", {}))
    assert out.ok is True
    assert '"timezone": "UTC"' in out.text


def test_time_with_iana_zone(default_registry):
    out = run(default_registry.run("get_current_time", {"timezone": "Europe/Paris"}))
    assert out.ok is True and "Europe/Paris" in out.text


@pytest.mark.parametrize("tz", ["Mars/Base", "../etc/passwd", "not a zone"])
def test_time_rejects_unknown_zone(default_registry, tz):
    out = run(default_registry.run("get_current_time", {"timezone": tz}))
    assert out.ok is False
    assert "timezone" in out.text.lower()
