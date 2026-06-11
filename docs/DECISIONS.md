# EchoBot — Decisions Log

Every deviation from the handoff document, every choice on D-items and Q-items, one line each with rationale.

---

## Sprint 1

### Answers to Open Questions

| ID | Decision | Rationale |
|----|----------|-----------|
| Q1 | Plugins/ChromaDB parked behind `FEATURES_PLUGINS=false` | Keeps sprint surface small, saves memory on 512MB free instance. ChromaDB is heavy. |
| Q2 | Anonymous sessions, no user accounts | Portfolio/demo project. `itsdangerous` signed bearer tokens, no identity. |

### Pre-resolved for Sprint 2

| ID | Decision | Rationale |
|----|----------|-----------|
| T9 | `POST /api/settings` will be deleted | `grep -rn "api/settings" src/` → zero hits. Frontend writes localStorage only via `useSettings` → `useSettingsState`. Endpoint is a dead no-op. |

### P0 Hotfix

| Item | Decision | Rationale |
|------|----------|-----------|
| Default model | `gemini-2.5-flash` replaces `gemini-2.0-flash` everywhere | `gemini-2.0-flash` retired by Google on 2026-06-01. Production was likely failing. |
| T4 allowlist | `gemini-2.5-flash,gemini-2.5-flash-lite` | Aligned with current stable flash-tier models. |

### Deferred Items

| Item | Deferred to | Rationale |
|------|-------------|-----------|
| Stale `connectionState` closure in `useSecureWebSocket` `onmessage` (L259) | Sprint 2 T11 | Latent bug: `connectionState` in the `connect` dep array may be stale when checking `connectionState === 'connected'`. MUST fix before T11, otherwise status/notification frames silently dropped post-auth. |
| `sessionService.fetchToken` AbortController timeout | Sprint 2 | Wire a real timeout or remove. Currently no AbortController is used (the plan's initial draft mentioned one but the actual implementation does not include it). |
| `useWebSocket.ts` deletion | T7 (pulled forward from Sprint 2 T12 per Correction 3) | Removing `DEV_WS_PORT` from `WEBSOCKET_CONFIG` would break `tsc` since `useWebSocket.ts` also destructures it. Deletion pulled forward. |

### Corrections Applied

| # | Ticket | Change | Rationale |
|---|--------|--------|-----------|
| C1 | T5 | Pydantic param renamed `chat_request`, Starlette param `request` | slowapi discovers client IP via the parameter named `request` (must be Starlette Request, not Pydantic model). |
| C2 | T5 | `uvicorn.run(..., proxy_headers=True, forwarded_allow_ips="*")` | Behind Render's proxy, `websocket.client.host` and slowapi see proxy IP. All users would share one rate bucket. |
| C3 | T7 | `useWebSocket.ts` deleted in T7 instead of Sprint 2 T12 | It destructures `DEV_WS_PORT` from `WEBSOCKET_CONFIG`; removing that constant without deleting this file breaks `tsc`. |
