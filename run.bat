@echo off
echo Starting EchoBot...
cd /d "%~dp0"

if exist .venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
)

echo Running main.py...
python main.py
pause
