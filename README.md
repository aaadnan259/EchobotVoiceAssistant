# EchoBot Voice Assistant

An AI-powered voice assistant capable of real-time streaming conversations.
Built with React, Vite, FastAPI, and the Gemini API.

## Setup

1. Copy `.env.example` to `.env` and fill in your keys.
   ```bash
   cp .env.example .env
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install Node dependencies:
   ```bash
   npm install
   ```
4. Start both servers:
   ```bash
   # Terminal 1: Backend
   python main.py
   
   # Terminal 2: Frontend
   npm run dev
   ```

## Architecture

- **Backend:** FastAPI, `google-genai` SDK async endpoints, `itsdangerous` session tokens, WebSocket handling.
- **Frontend:** React, TailwindCSS, Vite. Uses SSE and secure WebSockets.
