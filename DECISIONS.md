# Architecture Decisions

## D5: Frontend Architecture
- The legacy vanilla frontend (`static`/`templates`) has been deleted.
- The root route now acts as a SPA catch-all, serving `index.html` from the React `dist/` directory, or returning a JSON 500 error if the frontend hasn't been built.
- Static assets and the PWA Service Worker (`sw.js`) are served directly. Assets are cached immutably, while `index.html` and `sw.js` are served with `Cache-Control: no-cache` to ensure updates.

## D6: Settings API Deletion
- `/api/settings` and `/api/plugins` endpoints have been removed to minimize surface area.
- Plugin toggling is now handled exclusively via the `FEATURES_PLUGINS` environment variable.

## D7: Script Cleanup
- All legacy scripts in `scripts/` have been removed, except `diag_gemini.py`.
- `diag_gemini.py` has been ported to the `google-genai` SDK and is maintained as a manual diagnostic tool.

## D8: WebSocket Connection State
- The `useSecureWebSocket` hook uses `useRef` for tracking the connection state to avoid stale closures inside WebSocket event listeners (like `onmessage` and `onclose`).
