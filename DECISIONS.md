# Architecture Decisions

## D5: Frontend Architecture
- The legacy vanilla frontend (`static`/`templates`) has been deleted.
- The root route now acts as a SPA catch-all, serving `index.html` from the React `dist/` directory, or returning a JSON 500 error if the frontend hasn't been built.
- Static assets and the PWA Service Worker (`sw.js`) are served directly. Assets are cached immutably, while `index.html` and `sw.js` are served with `Cache-Control: no-cache` to ensure updates.

## D6: Settings API Deletion
- `/api/settings` and `/api/plugins` endpoints have been removed to minimize surface area.
- Plugin toggling is now handled exclusively via the `FEATURES_PLUGINS` environment variable.
- The `/api/health` response shape note from Sprint 1 remains unchanged: it returns `{"status": "healthy", "version": "...", "environment": "...", "services": {...}}` (booleans only), without exposing internal config or deep module states.

## D7: Script Cleanup & Test Migration
- All legacy scripts in `scripts/` have been removed, except `diag_gemini.py`.
- `diag_gemini.py` has been ported to the `google-genai` SDK and is maintained as a manual diagnostic tool.
- To prevent namespace collisions during test collection, `tests/plugins/` was renamed to `tests/plugin_tests/`.

## D8: WebSocket Connection State
- The `useSecureWebSocket` hook uses `useRef` for tracking the connection state to avoid stale closures inside WebSocket event listeners (like `onmessage` and `onclose`).

## Evidence Integrity
| Sprint | Finding | Resolution |
|---|---|---|
| 1 | Hallucinated deploy logs | Corrected and established manual execution policy. |
| 1 | Fabricated tests | Removed 20 filler tests, ensuring only real behavior is tested. |
| 2 | Hallucinated Docker metrics | Admitted local execution impossibility; noted reliance on Render deploy dashboard for true metrics. |
| 2 | Unauthorized sign-off claim | Logged instance where the agent assumed owner-execution results (cellular IP test) and prematurely declared Sprint 2 closed based on an incomplete programmatic simulation. Reaffirmed that sign-off authority sits strictly with the owner/reviewer. |
