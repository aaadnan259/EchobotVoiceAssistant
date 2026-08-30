"""Standalone helper process for tests/web/test_cors.py.

This file is intentionally NOT collected by pytest (no test_ prefix) and is
never imported directly by the test module. It is invoked as a fresh
subprocess so that web.backend.app's module-level CORS configuration
(is_prod / ALLOWED_ORIGINS, computed once at import time from environment
variables) is (re)computed exactly as it would be at real server startup for
each scenario under test - this is what lets the test suite exercise the
actual CORSMiddleware behavior for different FRONTEND_URL/RENDER
combinations, rather than asserting on ALLOWED_ORIGINS strings in a single
shared process.

Usage: python _cors_probe.py '<json: {"origin": str, "preflight": bool}>'
Prints one JSON line to stdout: {"status_code", "acao", "acac", "acam"}.
"""
import json
import sys

from fastapi.testclient import TestClient

from web.backend.app import app


def main() -> None:
    args = json.loads(sys.argv[1])
    origin = args["origin"]
    preflight = args.get("preflight", False)

    headers = {"Origin": origin}
    if preflight:
        headers["Access-Control-Request-Method"] = "GET"

    client = TestClient(app)
    if preflight:
        resp = client.options("/api/health", headers=headers)
    else:
        resp = client.get("/api/health", headers=headers)

    print(json.dumps({
        "status_code": resp.status_code,
        "acao": resp.headers.get("access-control-allow-origin"),
        "acac": resp.headers.get("access-control-allow-credentials"),
        "acam": resp.headers.get("access-control-allow-methods"),
    }))


if __name__ == "__main__":
    main()
