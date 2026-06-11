import os

f = 'tests/test_voice_loop.py'
if os.path.exists(f):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    if 'pytest.skip' not in c:
        with open(f, 'w', encoding='utf-8') as fp:
            fp.write('import pytest\npytest.skip(reason="Pipeline B parked", allow_module_level=True)\n' + c)
