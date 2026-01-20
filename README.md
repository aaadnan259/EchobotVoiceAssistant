# EchoBot

Voice-enabled AI assistant integrating Google Gemini 2.0 Flash with a React frontend and FastAPI backend.

## Overview

Full-stack application facilitating real-time voice and text interaction with LLMs. Features include streaming responses, multi-modal input (images), and conversation branching.

## Architecture

- **Frontend**: React 18, TypeScript, Vite. Handles UI, audio capture/playback, and state management.
- **Backend**: Python FastAPI. Proxies LLM requests, manages API keys, and routes websocket connections.
- **AI**: Google Gemini 2.0 Flash (via `google-genai` SDK).
- **Storage**: Local filesystem for limited persistence (if enabled).

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Google Gemini API Key

### Installation

```bash
git clone https://github.com/aaadnan259/EchobotVoiceAssistant.git
cd EchobotVoiceAssistant

# Frontend
npm install

# Backend
pip install -r requirements.txt
```

### Configuration

Create `.env`:

```ini
GEMINI_API_KEY=your_key_here
# Optional
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

### Development

Run frontend and backend in separate terminals:

```bash
# Terminal 1: Frontend (http://localhost:5173)
npm run dev

# Terminal 2: Backend (http://localhost:8000)
python main.py
```

### Deployment

Docker build supported. Render-ready via `render.yaml`.

```bash
docker build -t echobot .
docker run -p 3000:3000 -e GEMINI_API_KEY=... echobot
```
