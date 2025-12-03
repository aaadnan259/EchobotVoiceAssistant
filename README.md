# EchoBot 2.0 - Advanced AI Assistant

EchoBot is a modular, voice-activated AI assistant featuring intent classification, LLM integration, persistent memory, and a modern web interface.

## 🚀 Features

- **Voice Interaction**: Wake word detection ("Jarvis") and natural voice conversations.
- **AI Intelligence**:
  - **Intent Classification**: Locally trained ML model to route commands.
  - **LLM Integration**: Falls back to OpenAI/Gemini for general chat.
  - **Vector Memory**: Remembers past conversations and facts using ChromaDB.
- **Plugin System**: Modular architecture for easy feature addition.
  - Weather, Web Search (DuckDuckGo), Wikipedia, Calculator, Reminders, Time.
- **Web UI**: Modern browser interface with chat history and real-time status.
- **Engineering**: Async I/O, structured logging, secure config management.

## 📂 Architecture

```
EchoBot/
├── config/             # Settings and Secrets
├── plugins/            # Feature modules (Weather, Search, etc.)
├── services/           # Core Services
│   ├── audio/          # STT & TTS
│   ├── llm/            # OpenAI Integration
│   ├── memory/         # Vector Database
│   └── ml/             # Intent Classifier
├── storage/            # Databases and Logs
├── web/                # FastAPI Backend & Frontend
└── main.py             # Entry Point
```

## 🛠️ Setup & Installation

### 1. Prerequisites
- Python 3.9+
- Microsoft Visual C++ 14.0+ (for some audio libraries)
- FFmpeg (for audio processing)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configuration
1. Rename `.env.example` to `.env` (if provided) or create one with:
```ini
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
OPENWEATHER_API_KEY=...
PORCUPINE_ACCESS_KEY=...
```
2. Customize `config/settings.yaml` for voice preferences and defaults.

### 4. Running EchoBot

**Desktop Mode (Voice + Web Server):**
```bash
python main.py
```
- The bot will start listening for "Jarvis".
- The Web UI will be available at `http://localhost:8000`.

**Web UI Only:**
```bash
python web/backend/app.py
```

## 🧠 How it Works

1.  **Wake Word**: `pvporcupine` listens for the keyword "Jarvis" efficiently.
2.  **Speech-to-Text**: Google Speech Recognition converts audio to text.
3.  **Intent Classification**: A `scikit-learn` Logistic Regression model predicts if you want "weather", "search", or "chat".
4.  **Routing**:
    - **Commands**: Dispatched to specific Plugins (e.g., `WeatherPlugin`).
    - **Chat**: Sent to `LLMService` (OpenAI) with context from `MemoryService`.
5.  **Response**: The result is spoken back via `ElevenLabs` (or fallback) and displayed on the Web UI.

## 📝 License
MIT License
