"""The Gemini function-calling loop for /api/gemini/chat.

run_tool_loop streams one user message through up to MAX_MODEL_CALLS model calls.
Whenever the model answers with function calls, they are run (concurrently, via the
registry), the model's own turn is echoed back unmodified, and the function
responses are sent as the next turn. It yields plain event dicts; the caller turns
them into SSE frames and adds the final `done`.

Events:
  {"text": str}
  {"tool_call": {"id", "name", "args"}}
  {"tool_result": {"id", "name", "ok", "summary"}}
"""
import asyncio
from typing import Any, AsyncIterator, Dict, List, Optional

from services.tool_registry import ToolRegistry
from utils.logger import logger

MAX_MODEL_CALLS = 4
MAX_TOOL_CALLS = 6
EVENT_ARG_CHARS = 200
LIMIT_MESSAGE = "Tool call limit reached for this message."


def _parts(chunk: Any) -> List[Any]:
    candidates = getattr(chunk, "candidates", None)
    if not candidates:
        return []
    content = candidates[0].content
    return list(content.parts or []) if content else []


def _is_empty(part: Any) -> bool:
    """True for a part with no fields at all (Gemini ends a stream with one).
    A part that carries only a thought signature is NOT empty."""
    return not part.model_dump(exclude_none=True)


def _public_args(args: Optional[Dict[str, Any]]) -> Dict[str, str]:
    out = {}
    for key, value in (args or {}).items():
        text = value if isinstance(value, str) else repr(value)
        out[str(key)] = text[:EVENT_ARG_CHARS]
    return out


def _config(base: Optional[Dict[str, Any]], registry: ToolRegistry, force_text: bool) -> Dict[str, Any]:
    config = dict(base or {})
    # Declarations stay present on the forced-text round: the history contains
    # function calls, which Gemini expects to be able to resolve.
    config["tools"] = [{"function_declarations": registry.declarations()}]
    if force_text:
        config["tool_config"] = {"function_calling_config": {"mode": "NONE"}}
    return config


async def run_tool_loop(
    *,
    client: Any,
    model: str,
    contents: List[Any],
    base_config: Optional[Dict[str, Any]],
    registry: ToolRegistry,
) -> AsyncIterator[Dict[str, Any]]:
    contents = list(contents)
    tool_calls_made = 0

    for round_no in range(1, MAX_MODEL_CALLS + 1):
        force_text = round_no == MAX_MODEL_CALLS or tool_calls_made >= MAX_TOOL_CALLS

        stream = await client.aio.models.generate_content_stream(
            model=model,
            contents=list(contents),
            config=_config(base_config, registry, force_text),
        )

        model_parts: List[Any] = []
        calls: List[Any] = []
        async for chunk in stream:
            for part in _parts(chunk):
                if _is_empty(part):
                    continue
                model_parts.append(part)
                if part.function_call is not None:
                    calls.append(part.function_call)
                elif part.text and not part.thought:
                    yield {"text": part.text}

        if not calls:
            return
        if force_text:
            logger.warning("Model returned function calls on a text-only round; ignoring them.")
            return

        remaining = MAX_TOOL_CALLS - tool_calls_made
        call_ids = [c.id or f"call_{tool_calls_made + i}" for i, c in enumerate(calls)]
        for call, call_id in zip(calls, call_ids):
            yield {"tool_call": {"id": call_id, "name": call.name, "args": _public_args(call.args)}}

        outcomes: Dict[int, Any] = {}
        tasks: Dict["asyncio.Future[Any]", int] = {}
        for index, call in enumerate(calls):
            if index < remaining:
                task = asyncio.ensure_future(registry.run(call.name, dict(call.args or {})))
                tasks[task] = index
            else:
                outcomes[index] = None  # over the cap: not run
                yield {"tool_result": {"id": call_ids[index], "name": call.name,
                                       "ok": False, "summary": LIMIT_MESSAGE}}
        tool_calls_made += min(len(calls), remaining)

        pending = set(tasks)
        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    index = tasks[task]
                    outcome = task.result()  # registry.run never raises
                    outcomes[index] = outcome
                    yield {"tool_result": {"id": call_ids[index], "name": calls[index].name,
                                           "ok": outcome.ok, "summary": outcome.summary}}
        finally:
            for task in pending:  # client disconnected mid-run
                task.cancel()

        response_parts = []
        for index, call in enumerate(calls):
            outcome = outcomes[index]
            if outcome is None:
                payload = {"error": LIMIT_MESSAGE}
            elif outcome.ok:
                payload = {"result": outcome.text}
            else:
                payload = {"error": outcome.text}
            function_response = {"name": call.name, "response": payload}
            if call.id:
                function_response["id"] = call.id
            response_parts.append({"function_response": function_response})

        # Echo the model's turn exactly as received (thought signatures included):
        # the Part objects from the stream are passed through untouched.
        contents.append({"role": "model", "parts": model_parts})
        contents.append({"role": "user", "parts": response_parts})
