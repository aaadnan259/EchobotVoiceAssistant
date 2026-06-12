import pytest
import sys
import os
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

@pytest.fixture(autouse=True)
def isolate_fastapi(monkeypatch):
    '''Prevent sys.modules['fastapi'] patches from leaking across test files.'''
    if "fastapi" in sys.modules and isinstance(sys.modules["fastapi"], MagicMock):
        del sys.modules["fastapi"]
    yield
