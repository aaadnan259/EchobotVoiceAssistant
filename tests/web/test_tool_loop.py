"""Tests for the Gemini function-calling loop (web/backend/tool_loop.py)."""
import asyncio
import json
from types import SimpleNamespace

import pytest
from google.genai import types

from services.plugin_manager import ToolFailure
from services.tool_registry import ParamSpec, ToolRegistry, ToolSpec, build_default_registry
from web.backend.tool_loop import MAX_MODEL_CALLS, MAX_TOOL_CALLS, run_tool_loop


# --- helpers -----------------------------------------------------------------

def chunk(*parts):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(parts)))]
    )


def call_part(name, args, call_id=None, sig=b"signature-bytes"):
    return types.Part(
        function_call=types.FunctionCall(name=name, args=args, id=call_id),
        thought_signature=sig,
    )


def text_part(text):
    return types.Part(text=text)


class FakeClient:
    """Stands in for genai.Client; `rounds` is a list of chunk lists, or a callable
    taking the request index and returning one."""

    def __init__(self, rounds):
        self._rounds = rounds
        self.requests = []
        self.aio = SimpleNamespace(models=SimpleNamespace(generate_content_stream=self._stream))

    async def _stream(self, *, model, contents, config):
        index = len(self.requests)
        self.requests.append({"model": model, "contents": contents, "config": config})
        chunks = self._rounds(index) if callable(self._rounds) else self._rounds[index]

        async def gen():
            for c in chunks:
                yield c

        return gen()


def make_registry(runner=None, timeout=2.0, name="lookup"):
    calls = []

    async def default_runner(args):
        calls.append(args)
        return f"result for {args['q']}"

    async def counting(args):
        calls.append(args)
        return await runner(args)

    spec = ToolSpec(
        name=name,
        description="test",
        params=(ParamSpec("q", "query", 50),),
        runner=counting if runner else default_runner,
    )
    registry = ToolRegistry([spec], timeout=timeout)
    registry.calls = calls
    return registry


async def collect(client, registry, contents=None, base_config=None):
    events = []
    async for event in run_tool_loop(
        client=client,
        model="gemini-test",
        contents=contents if contents is not None else [{"role": "user", "parts": [{"text": "hi"}]}],
        base_config=base_config,
        registry=registry,
    ):
        events.append(event)
    return events


def go(coro):
    return asyncio.run(coro)


def function_responses(request):
    """The function_response parts in the last (user) turn of a request."""
    return [p["function_response"] for p in request["contents"][-1]["parts"]]


# --- happy path --------------------------------------------------------------

def test_text_call_result_text_flow_and_unmodified_echo():
    call = call_part("lookup", {"q": "paris"}, call_id="c1")
    client = FakeClient([
        [chunk(text_part("Checking. ")), chunk(call), chunk(types.Part())],  # trailing empty part
        [chunk(text_part("Paris is nice."))],
    ])
    registry = make_registry()

    events = go(collect(client, registry, base_config={"system_instruction": ["sys"]}))

    assert [list(e)[0] for e in events] == ["text", "tool_call", "tool_result", "text"]
    assert events[0] == {"text": "Checking. "}
    assert events[1]["tool_call"] == {"id": "c1", "name": "lookup", "args": {"q": "paris"}}
    assert events[2]["tool_result"]["ok"] is True
    assert events[3] == {"text": "Paris is nice."}
    assert registry.calls == [{"q": "paris"}]

    first, second = client.requests
    assert first["config"]["system_instruction"] == ["sys"]
    assert "tool_config" not in first["config"]
    assert first["config"]["tools"][0]["function_declarations"][0]["name"] == "lookup"

    # Second request: original turn, the model's turn echoed as received, then responses.
    contents = second["contents"]
    assert len(contents) == 3
    model_turn, response_turn = contents[1], contents[2]
    assert model_turn["role"] == "model"
    assert model_turn["parts"][1] is call  # same Part object: signature untouched
    assert model_turn["parts"][1].thought_signature == b"signature-bytes"
    assert all(p.model_dump(exclude_none=True) for p in model_turn["parts"])  # empty part dropped
    assert response_turn["role"] == "user"
    (fr,) = function_responses(second)
    assert (fr["id"], fr["name"]) == ("c1", "lookup")
    assert fr["response"] == {"result": "result for paris"}
    # The real SDK accepts the history exactly as the loop builds it.
    for item in contents:
        types.Content.model_validate(item)


def test_thought_parts_are_not_forwarded_as_text():
    client = FakeClient([[chunk(types.Part(text="private reasoning", thought=True), text_part("answer"))]])
    events = go(collect(client, make_registry()))
    assert events == [{"text": "answer"}]


def test_signature_only_part_is_kept_in_the_echoed_turn():
    sig_only = types.Part(text="", thought_signature=b"sig")
    client = FakeClient([
        [chunk(call_part("lookup", {"q": "a"}, "c1")), chunk(sig_only)],
        [chunk(text_part("done"))],
    ])
    go(collect(client, make_registry()))
    echoed = client.requests[1]["contents"][1]["parts"]
    assert any(p.thought_signature == b"sig" and p.function_call is None for p in echoed)


def test_no_tool_calls_means_a_single_model_call():
    client = FakeClient([[chunk(text_part("just text"))]])
    events = go(collect(client, make_registry()))
    assert events == [{"text": "just text"}]
    assert len(client.requests) == 1


# --- caps --------------------------------------------------------------------

def test_loop_stops_at_the_model_call_cap_and_forces_text_on_the_last_round():
    # Two calls per round: after 3 rounds that is 6 tool calls, so round 4 is forced anyway.
    def rounds(i):
        if i < MAX_MODEL_CALLS - 1:
            return [chunk(call_part("lookup", {"q": f"a{i}"}, f"x{i}"), call_part("lookup", {"q": f"b{i}"}, f"y{i}"))]
        return [chunk(text_part("final"))]

    client = FakeClient(rounds)
    registry = make_registry()
    events = go(collect(client, registry))

    assert len(client.requests) == MAX_MODEL_CALLS
    assert len(registry.calls) == MAX_TOOL_CALLS
    for request in client.requests[:-1]:
        assert "tool_config" not in request["config"]
    last = client.requests[-1]["config"]
    assert last["tool_config"] == {"function_calling_config": {"mode": "NONE"}}
    assert last["tools"]  # declarations stay so the call history resolves
    assert events[-1] == {"text": "final"}


def test_model_that_keeps_calling_tools_is_cut_off_at_four_model_calls():
    client = FakeClient(lambda i: [chunk(call_part("lookup", {"q": str(i)}, f"id{i}"))])
    registry = make_registry()
    go(collect(client, registry))

    assert len(client.requests) == MAX_MODEL_CALLS
    # The forced round's call (if any) is ignored, never executed.
    assert len(registry.calls) == MAX_MODEL_CALLS - 1


def test_tool_call_cap_skips_extra_calls_but_answers_every_call():
    eight = [call_part("lookup", {"q": str(n)}, f"id{n}") for n in range(8)]
    client = FakeClient([[chunk(*eight)], [chunk(text_part("ok"))]])
    registry = make_registry()
    events = go(collect(client, registry))

    assert len(registry.calls) == MAX_TOOL_CALLS
    results = [e["tool_result"] for e in events if "tool_result" in e]
    assert len(results) == 8
    assert sum(1 for r in results if not r["ok"]) == 2
    assert "limit" in [r for r in results if not r["ok"]][0]["summary"].lower()

    responses = function_responses(client.requests[1])
    assert len(responses) == 8  # Gemini needs a response for every call
    assert sum(1 for r in responses if "error" in r["response"]) == 2
    # Budget is spent, so the next round must be text-only.
    assert client.requests[1]["config"]["tool_config"] == {"function_calling_config": {"mode": "NONE"}}


# --- failures go back to the model ------------------------------------------

def test_tool_timeout_returns_an_error_to_the_model_and_the_loop_continues():
    async def slow(args):
        await asyncio.sleep(5)
        return "never"

    client = FakeClient([
        [chunk(call_part("lookup", {"q": "x"}, "c1"))],
        [chunk(text_part("Sorry, that timed out."))],
    ])
    registry = make_registry(runner=slow, timeout=0.05)
    events = go(collect(client, registry))

    result = next(e["tool_result"] for e in events if "tool_result" in e)
    assert result["ok"] is False and "timed out" in result["summary"]
    (fr,) = function_responses(client.requests[1])
    assert "timed out" in fr["response"]["error"]
    assert events[-1] == {"text": "Sorry, that timed out."}


def test_invalid_arguments_return_an_error_to_the_model_without_running_the_tool():
    client = FakeClient([
        [chunk(call_part("lookup", {"q": 123, "bogus": 1}, "c1"))],
        [chunk(text_part("fixing"))],
    ])
    registry = make_registry()
    go(collect(client, registry))

    assert registry.calls == []
    (fr,) = function_responses(client.requests[1])
    assert "error" in fr["response"]


def test_unknown_tool_name_returns_an_error_to_the_model():
    client = FakeClient([
        [chunk(call_part("does_not_exist", {}, "c1"))],
        [chunk(text_part("ok"))],
    ])
    go(collect(client, make_registry()))
    (fr,) = function_responses(client.requests[1])
    assert "Unknown tool" in fr["response"]["error"]


def test_calls_in_one_round_run_concurrently():
    ready = {}

    async def rendezvous(args):
        # Each call waits for the other; sequential execution would hit the timeout.
        me = args["q"]
        ready.setdefault(me, asyncio.Event()).set()
        other = "b" if me == "a" else "a"
        await asyncio.wait_for(ready.setdefault(other, asyncio.Event()).wait(), timeout=1.5)
        return "both ran"

    client = FakeClient([
        [chunk(call_part("lookup", {"q": "a"}, "1"), call_part("lookup", {"q": "b"}, "2"))],
        [chunk(text_part("done"))],
    ])
    events = go(collect(client, make_registry(runner=rendezvous, timeout=3)))
    results = [e["tool_result"] for e in events if "tool_result" in e]
    assert [r["ok"] for r in results] == [True, True]


def test_missing_call_id_gets_a_generated_one():
    client = FakeClient([
        [chunk(call_part("lookup", {"q": "x"}, call_id=None))],
        [chunk(text_part("ok"))],
    ])
    events = go(collect(client, make_registry()))
    call_id = next(e["tool_call"]["id"] for e in events if "tool_call" in e)
    assert call_id
    result_id = next(e["tool_result"]["id"] for e in events if "tool_result" in e)
    assert result_id == call_id


def test_failed_lookup_produces_ok_false_in_the_tool_result_event():
    async def not_found(args):
        raise ToolFailure("I couldn't find the location 'Xyzzyville, Nowhere'.")

    client = FakeClient([
        [chunk(call_part("lookup", {"q": "Xyzzyville, Nowhere"}, "c1"))],
        [chunk(text_part("I couldn't find that place."))],
    ])
    events = go(collect(client, make_registry(runner=not_found)))

    result = next(e["tool_result"] for e in events if "tool_result" in e)
    assert result["ok"] is False
    assert "couldn't find the location" in result["summary"]
    (fr,) = function_responses(client.requests[1])
    assert "error" in fr["response"] and "result" not in fr["response"]


def test_real_weather_tool_not_found_is_ok_false_end_to_end():
    from unittest.mock import MagicMock, patch

    with patch("plugins.standard.weather.ConfigLoader") as cfg:
        cfg.get.return_value = "test-key"
        registry = build_default_registry()

    empty_geo = MagicMock()
    empty_geo.json.return_value = []
    client = FakeClient([
        [chunk(call_part("get_weather", {"location": "Xyzzyville, Nowhere"}, "w1"))],
        [chunk(text_part("No such place."))],
    ])
    with patch("plugins.standard.weather.requests.get", return_value=empty_geo):
        events = go(collect(client, registry))

    result = next(e["tool_result"] for e in events if "tool_result" in e)
    assert result["ok"] is False
    assert "Xyzzyville" in result["summary"]
