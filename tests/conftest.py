import pytest
import sys
import os
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Feature flags are read at import time and python-dotenv would otherwise pull
# them from a developer's local .env (.env.example turns FEATURES_PLUGINS on).
# Pin them off so the suite behaves the same everywhere; tests that need a flag
# set it explicitly.
os.environ["FEATURES_PLUGINS"] = "false"
os.environ["FEATURES_MEMORY"] = "false"

@pytest.fixture(autouse=True)
def isolate_fastapi(monkeypatch):
    '''Prevent sys.modules['fastapi'] patches from leaking across test files.'''
    if "fastapi" in sys.modules and isinstance(sys.modules["fastapi"], MagicMock):
        del sys.modules["fastapi"]
    yield
