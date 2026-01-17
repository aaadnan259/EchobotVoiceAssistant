# EchoBot 2.0 - Advanced AI Voice Assistant

[![Live Demo](https://img.shields.io/badge/Live%20Demo-echobot--sics.onrender.com-purple)](https://echobot-sics.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-EchobotVoiceAssistant-blue)](https://github.com/aaadnan259/EchobotVoiceAssistant)

EchoBot is a full-stack AI voice assistant featuring real-time streaming responses, conversation branching, multi-modal input, and a modern web interface.

## 🌐 Live Demo

**[https://echobot-sics.onrender.com](https://echobot-sics.onrender.com)**

## ✨ Features

- **AI Chat**: Real-time streaming responses via Google Gemini 2.0 Flash
- **Voice Interaction**: Speech-to-text and text-to-speech via Web Speech API
- **Multi-Modal Input**: Send images alongside text messages
- **Conversation Branching**: Edit and regenerate messages with tree-based history
- **Modern UI**: React 18 + TypeScript + TailwindCSS with dark/light themes
- **Secure**: API keys stay server-side, XSS protection via DOMPurify
- **PWA Ready**: Installable as a Progressive Web App

## 📂 Architecture

```
EchoBot/
├── src/                    # React/TypeScript Frontend
│   ├── components/         # UI Components
│   ├── hooks/              # Custom React Hooks (19 total)
│   ├── services/           # API Services
│   ├── types.ts            # TypeScript Interfaces
│   └── constants/          # App Configuration
├── web/backend/            # Python FastAPI Backend
│   └── app.py              # Main API Server
├── config/                 # Settings & Config Loader
├── services/               # Backend Services (LLM, Audio, Memory)
├── scripts/                # Development Utilities
├── Dockerfile              # Multi-stage Production Build
└── main.py                 # Entry Point
```

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- npm or yarn

### 1. Clone & Install

```bash
git clone https://github.com/aaadnan259/EchobotVoiceAssistant.git
cd EchobotVoiceAssistant

# Install frontend dependencies
npm install

# Install backend dependencies
pip install -r requirements.txt
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```ini
# Required
GEMINI_API_KEY=your_gemini_api_key_here
# OR
GOOGLE_API_KEY=your_google_api_key_here

# Optional
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
OPENWEATHER_API_KEY=...
SENTRY_DSN=...                    # For error tracking
FRONTEND_URL=https://your-domain  # For CORS in production
```

### 3. Run Development Servers

**Frontend (Vite dev server):**
```bash
npm run dev
# Opens at http://localhost:5173
```

**Backend (FastAPI):**
```bash
python main.py
# Runs at http://localhost:8000
```

For full-stack development, run both simultaneously. The frontend proxies API requests to the backend.

### 4. Build for Production

```bash
npm run build
# Output in build/ directory
```

## 🚀 Deployment

### Render (Recommended)

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard:
   - `GEMINI_API_KEY` or `GOOGLE_API_KEY`
   - `PORT=3000`
3. Render auto-deploys on push using the Dockerfile

### Docker

```bash
docker build -t echobot .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key echobot
```

## 🧠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS v4 |
| Backend | Python, FastAPI, Uvicorn |
| AI | Google Gemini 2.0 Flash |
| State | Custom React Hooks (19 hooks for various concerns) |
| Styling | TailwindCSS + shadcn/ui components |
| Deployment | Docker multi-stage build, Render |

## 📝 Key Files

| File | Description |
|------|-------------|
| `src/hooks/useConversationTree.ts` | Conversation state with branching |
| `src/services/geminiService.ts` | Gemini API client with SSE streaming |
| `web/backend/app.py` | FastAPI backend, Gemini proxy |
| `src/types.ts` | TypeScript interfaces |
| `src/constants/index.ts` | App configuration |

## 📄 License

MIT License
