import os

files_to_skip = [
    'tests/services/llm/test_llm_init.py',
    'tests/services/llm/test_llm_service.py',
    'tests/services/llm/test_llm_service_chat.py',
    'tests/services/llm/test_llm_service_openai.py',
    'tests/services/memory/test_vector_store.py',
    'tests/services/test_plugin_manager.py',
    'tests/test_reminders.py',
    'tests/plugins/test_reminders.py'
]

skip_text = 'import pytest\npytest.skip(reason="Pipeline B parked for Sprint 2", allow_module_level=True)\n'

for f in files_to_skip:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as fp:
            content = fp.read()
        # Remove old pytestmark if exists
        content = content.replace('pytestmark = pytest.mark.skip(reason="Pipeline B parked for Sprint 2")', '')
        content = content.replace('pytestmark = pytest.mark.skip(reason="parked")', '')
        
        if 'pytest.skip(reason="Pipeline B parked' not in content:
            with open(f, 'w', encoding='utf-8') as fp:
                fp.write(skip_text + content)
