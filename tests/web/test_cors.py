"""
Regression tests for CORS configuration (F1 / P1, Phase 6 - Workstream 1).

Background: in production (RENDER env var present), if FRONTEND_URL is
missing or an empty string, the pre-fix implementation fell through to
allow_origins=["*"]. Combined with allow_credentials=True, Starlette's
CORSMiddleware does not send a literal "*" in that case - it reflects the
request's actual Origin header back for ANY origin, which is a CORS
fail-open bypass (verified live against the real running server: an
attacker-controlled Origin received a matching Access-Control-Allow-Origin
and Access-Control-Allow-Credentials: true). The fix removes the wildcard
fallback so an empty allowlist means deny-all, and logs a startup warning
for the misconfigured-production case.

These tests exercise the actual CORSMiddleware behavior end-to-end via
FastAPI's TestClient, not string assertions on ALLOWED_ORIGINS. Because
is_prod/ALLOWED_ORIGINS are computed once at module-import time in
web/backend/app.py (exactly as they would be at real server startup), each
scenario is run in its own fresh subprocess (see _cors_probe.py) so that
different FRONTEND_URL/RENDER combinations can be exercised within one test
run without cross-test import-order/module-caching contamination.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PROBE_SCRIPT = Path(__file__).resolve().parent / "_cors_probe.py"

MALICIOUS_ORIGIN = "http://evil.example.com"
LEGITIMATE_ORIGIN = "https://echobot.example.com"


def _run_cors_probe(env_overrides: dict, origin: str, preflight: bool = False) -> dict:
    """Run tests/web/_cors_probe.py in a fresh subprocess with the given
    environment variables set before web.backend.app is imported, and
    return the real HTTP response headers it observed."""
    env = os.environ.copy()
    for key in ("RENDER", "FRONTEND_URL", "SESSION_SECRET"):
        env.pop(key, None)
    env.update(env_overrides)
    # Ensure the subprocess can resolve `web.backend.app` / `config.loader`
    # etc. regardless of how it's invoked - cwd alone isn't enough when
    # running a script file (only `python -c` implicitly adds cwd to
    # sys.path[0]; a script file gets its own directory instead).
    existing_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        str(REPO_ROOT) if not existing_pythonpath
        else f"{REPO_ROOT}{os.pathsep}{existing_pythonpath}"
    )

    proc = subprocess.run(
        [sys.executable, str(PROBE_SCRIPT), json.dumps({"origin": origin, "preflight": preflight})],
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, (
        f"CORS probe subprocess failed (env={env_overrides}, origin={origin}, "
        f"preflight={preflight}):\nstdout={proc.stdout}\nstderr={proc.stderr}"
    )
    lines = [line for line in proc.stdout.strip().splitlines() if line]
    assert lines, f"CORS probe produced no output:\nstderr={proc.stderr}"
    return json.loads(lines[-1])


# ---------------------------------------------------------------------------
# F1 regression cases: these fail against the pre-fix implementation (which
# reflects the malicious Origin back via the ["*"] + allow_credentials=True
# fallback) and pass only once the deny-all fix is in place.
# ---------------------------------------------------------------------------

def test_prod_missing_frontend_url_denies_malicious_origin():
    """RENDER set, FRONTEND_URL entirely unset -> must NOT reflect an
    arbitrary Origin. This is the exact F1 fail-open scenario."""
    result = _run_cors_probe(
        {"RENDER": "1", "SESSION_SECRET": "test-secret-value"},
        MALICIOUS_ORIGIN,
    )
    assert result["acao"] is None, (
        f"CORS fail-open: expected no Access-Control-Allow-Origin for an "
        f"unconfigured production origin, got {result}"
    )


def test_prod_empty_frontend_url_denies_malicious_origin():
    """RENDER set, FRONTEND_URL set to an empty string -> same fail-open
    scenario as missing; must also deny."""
    result = _run_cors_probe(
        {"RENDER": "1", "SESSION_SECRET": "test-secret-value", "FRONTEND_URL": ""},
        MALICIOUS_ORIGIN,
    )
    assert result["acao"] is None, (
        f"CORS fail-open: expected no Access-Control-Allow-Origin for an "
        f"empty-string FRONTEND_URL, got {result}"
    )


def test_prod_missing_frontend_url_denies_malicious_preflight():
    """Same fail-open scenario, exercised via a CORS preflight (OPTIONS)
    request instead of a simple request.

    Note: Starlette's CORSMiddleware always includes
    Access-Control-Allow-Credentials on a preflight response when
    allow_credentials=True is configured, regardless of whether the
    requested origin was actually allowed - confirmed to be true even for
    the already-correct "FRONTEND_URL properly configured" case (a
    same-shape probe against that scenario also returns
    acac="true"/acao=None/400 for a mismatched origin). A browser's CORS
    check requires Access-Control-Allow-Origin to match before credentials
    are ever used, so the security-relevant assertion here is that acao is
    absent (and the preflight is rejected with 400), not the acac value.
    """
    result = _run_cors_probe(
        {"RENDER": "1", "SESSION_SECRET": "test-secret-value"},
        MALICIOUS_ORIGIN,
        preflight=True,
    )
    assert result["acao"] is None, f"CORS fail-open on preflight: got {result}"
    assert result["status_code"] == 400, f"expected rejected preflight: got {result}"


# ---------------------------------------------------------------------------
# Positive controls: legitimate, correctly-configured production behavior
# must be preserved exactly as it was before the fix (this path was already
# correct and must not be touched).
# ---------------------------------------------------------------------------

def test_prod_configured_frontend_url_allows_legitimate_origin():
    result = _run_cors_probe(
        {
            "RENDER": "1",
            "SESSION_SECRET": "test-secret-value",
            "FRONTEND_URL": LEGITIMATE_ORIGIN,
        },
        LEGITIMATE_ORIGIN,
    )
    assert result["acao"] == LEGITIMATE_ORIGIN
    assert result["acac"] == "true"


def test_prod_configured_frontend_url_denies_other_origins():
    result = _run_cors_probe(
        {
            "RENDER": "1",
            "SESSION_SECRET": "test-secret-value",
            "FRONTEND_URL": LEGITIMATE_ORIGIN,
        },
        MALICIOUS_ORIGIN,
    )
    assert result["acao"] is None


def test_prod_configured_frontend_url_allows_legitimate_preflight():
    result = _run_cors_probe(
        {
            "RENDER": "1",
            "SESSION_SECRET": "test-secret-value",
            "FRONTEND_URL": LEGITIMATE_ORIGIN,
        },
        LEGITIMATE_ORIGIN,
        preflight=True,
    )
    assert result["acao"] == LEGITIMATE_ORIGIN


# ---------------------------------------------------------------------------
# Non-production (dev) behavior must be unaffected: the dev branch's
# ALLOWED_ORIGINS list is a fixed, always-non-empty literal and was never
# able to reach the wildcard fallback in the first place.
# ---------------------------------------------------------------------------

def test_dev_localhost_origin_allowed():
    result = _run_cors_probe({}, "http://localhost:5173")
    assert result["acao"] == "http://localhost:5173"


def test_dev_unlisted_origin_denied():
    result = _run_cors_probe({}, MALICIOUS_ORIGIN)
    assert result["acao"] is None
