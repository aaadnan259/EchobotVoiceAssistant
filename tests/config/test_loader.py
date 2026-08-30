import os
import unittest
from unittest.mock import patch

from config.loader import ConfigLoader


class TestConfigLoaderModelFallback(unittest.TestCase):
    """Regression coverage for F3: config/loader.py's own env/settings fallback for
    ai.llm_model must never resolve to the retired gemini-2.0-flash. This exercises
    the real ConfigLoader._inject_env_vars() method directly (not mocked), which is
    a defense-in-depth fallback separate from services/llm/llm_service.py's own
    ConfigLoader.get(...) default -- both are covered, one here and one in
    tests/services/llm/test_llm_init.py::test_default_model_name_fallback.
    """

    def setUp(self):
        # ConfigLoader._settings is class-level state shared with the rest of the
        # process (it is populated once at import time via ConfigLoader.load_settings()
        # in config/loader.py). Save and restore it so this test cannot leak state into
        # any other test module that imports ConfigLoader.
        self._saved_settings = ConfigLoader._settings

    def tearDown(self):
        ConfigLoader._settings = self._saved_settings

    def test_llm_model_fallback_when_ai_section_present_but_model_missing(self):
        """ai.llm_model absent from settings AND GEMINI_MODEL env var absent -- the
        exact double-fallback scenario the F3 finding describes -- must resolve to
        the current, non-retired model."""
        ConfigLoader._settings = {"ai": {"provider": "google"}}

        with patch.dict(os.environ, {}, clear=True):
            ConfigLoader._inject_env_vars()

        self.assertEqual(ConfigLoader._settings["ai"]["llm_model"], "gemini-2.5-flash")

    def test_gemini_model_env_var_still_takes_precedence(self):
        """The GEMINI_MODEL env var override is unaffected by this fix -- it must
        still take precedence over the fallback in both directions."""
        ConfigLoader._settings = {"ai": {"provider": "google"}}

        with patch.dict(os.environ, {"GEMINI_MODEL": "gemini-3.0-flash"}, clear=True):
            ConfigLoader._inject_env_vars()

        self.assertEqual(ConfigLoader._settings["ai"]["llm_model"], "gemini-3.0-flash")

    def test_no_fallback_injected_when_ai_section_absent(self):
        """Documents existing (unchanged by F3) behavior: the fallback assignment is
        only reached when an 'ai' section already exists in settings; if it doesn't,
        no llm_model key is injected at all. Not a new behavior -- recorded here so a
        future change to this guard is a deliberate, visible decision."""
        ConfigLoader._settings = {}

        with patch.dict(os.environ, {}, clear=True):
            ConfigLoader._inject_env_vars()

        self.assertNotIn("ai", ConfigLoader._settings)


if __name__ == "__main__":
    unittest.main()
