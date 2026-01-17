# EchoBot Codebase Review — Full Analysis

**Reviewed:** January 2026  
**Codebase:** EchoBot Voice Assistant (React/TypeScript + FastAPI)

---

## Executive Summary

This is a **well-architected, production-ready** voice AI assistant with impressive features:
- Clean separation of concerns via 18+ custom React hooks
- Secure API key handling via backend proxy
- Modern streaming architecture (SSE for Gemini responses)
- Advanced conversation tree with branching, edit, and regenerate
- Solid security practices (sanitization, CORS, rate limiting)

**Overall Grade: B+**

The architecture is sound. Most issues are minor cleanup items or optimizations rather than fundamental problems.

---

## 🔴 Critical Issues (Must Fix)

### 1. Dead Code in `saveConversation()` — **Severity: High**

**File:** `src/hooks/useConversationTree.ts` (lines 114-142)

```typescript
function saveConversation(conversation: Conversation): boolean {
    try {
        // Deep clone to sanitize for storage
        return true;  // ← EARLY RETURN - ALL CODE BELOW IS DEAD
        // NOTE: Saving the entire tree might be heavy...
        const stringified = JSON.stringify(conversation);
        localStorage.setItem(STORAGE_KEY, stringified);
        return true;
    } catch (e) {
        // ... error handling never reached
    }
}
```

**Impact:** Conversations are **never persisted to localStorage**. Users lose all chat history on refresh.

**Fix:**
```typescript
function saveConversation(conversation: Conversation): boolean {
    try {
        const stringified = JSON.stringify(conversation);
        localStorage.setItem(STORAGE_KEY, stringified);
        return true;
    } catch (e) {
        logger.error('Failed to save conversation:', e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            // Strip images and retry
            const leanMessages: Record<string, Message> = {};
            Object.values(conversation.messages).forEach(msg => {
                leanMessages[msg.id] = { ...msg, image: undefined, images: undefined };
            });
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...conversation,
                    messages: leanMessages
                }));
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }
}
```

---

### 2. Missing Types File

**Issue:** `src/types/` directory exists but is **empty**. Multiple files import from `'../types'` or `'./types'`:
- `App.tsx`: `import { OrbState, Message } from './types';`
- `useChat.ts`: `import { Message, OrbState, AppSettings } from '../types';`
- `useSettings.ts`: `import { AppSettings } from '../types';`

**Impact:** TypeScript compilation should fail, or types are being inferred as `any`.

**Fix:** Create `src/types/index.ts`:
```typescript
export interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    parentId: string | null;
    branchId: string;
    image?: string;
    images?: string[];
    groundingMetadata?: any;
    reactions?: Record<string, boolean>;
}

export interface Branch {
    id: string;
    name: string;
    createdAt: number;
    parentMessageId: string | null;
}

export interface Conversation {
    id: string;
    branches: Record<string, Branch>;
    activeBranchId: string;
    messages: Record<string, Message>;
}

export enum OrbState {
    IDLE = 'idle',
    LISTENING = 'listening',
    THINKING = 'thinking',
    RESPONDING = 'responding',
    ERROR = 'error'
}

export interface VoiceSettings {
    voiceURI: string | null;
    rate: number;
    pitch: number;
    volume: number;
}

export interface AppSettings {
    theme: 'light' | 'dark';
    model: string;
    systemPrompt: string;
    voiceSettings: VoiceSettings;
}
```

---

### 3. Missing Constants File

**Issue:** Multiple files import from `'../constants'` but no constants file was included in the upload.

**Impact:** Build will fail without this file.

**Required exports (based on usage):**
```typescript
// src/constants/index.ts
export const STORAGE_KEYS = {
    MESSAGES: 'echobot_messages',
    SETTINGS: 'echobot_settings',
};

export const MESSAGE_LIMITS = {
    MAX_STORED_MESSAGES: 1000,
    MAX_MESSAGE_LENGTH: 50000,
    TRUNCATION_SUFFIX: '... [truncated]',
};

export const CHAT_MESSAGES = {
    INITIAL_GREETING: "Hello! I'm EchoBot. How can I help you today?",
    SUCCESS: { CONNECTED: 'Connected', CHAT_SAVED: 'Chat saved', CHAT_RESET: 'Chat reset' },
    ERRORS: { GENERIC: 'Something went wrong', VOICE_NOT_SUPPORTED: 'Voice not supported' },
    CONFIRMATIONS: { CLEAR_CHAT: 'Clear all messages?' },
};

export const UI_CONFIG = {
    ERROR_DISPLAY_DURATION: 3000,
};

export const WEBSOCKET_CONFIG = {
    RECONNECT_INTERVAL: 1000,
    MAX_RECONNECT_DELAY: 30000,
    MAX_RECONNECT_ATTEMPTS: 5,
    WS_PATH: '/ws',
    DEV_WS_PORT: 8000,
};

export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    model: 'gemini-2.0-flash',
    systemPrompt: 'You are EchoBot, a helpful AI assistant.',
    voiceSettings: { voiceURI: null, rate: 1, pitch: 1, volume: 1 },
};

export const playSound = (type: 'send' | 'receive' | 'error') => {
    // Audio feedback implementation
};
```

---

## 🟠 Important Issues (Should Fix)

### 4. `.gitignore` Missing Database and Log Files

**File:** `.gitignore`

**Current:**
```
.env
__pycache__/
*.pyc
.venv/
...
```

**Missing:**
```
*.db
*.log
*.sqlite
*.sqlite3
```

**Impact:** `echobot.db` and `echobot.log` are committed to the repo (visible in GitHub).

---

### 5. Vestigial `package.json` Script

**File:** `package.json` (line 81)

```json
"start": "node server.js"
```

**Issue:** `server.js` doesn't exist. The actual entry point is `python main.py`.

**Fix:** Either remove the script or update to something meaningful:
```json
"start": "echo 'Use: python main.py'",
"start:dev": "vite"
```

---

### 6. Duplicate Gemini SDK Dependencies

**File:** `package.json` (lines 7-8)

```json
"@google/genai": "^1.35.0",
"@google/generative-ai": "^0.24.1",
```

**Issue:** Two different Gemini SDK packages. The codebase uses `@google/genai` (new SDK) but still has the old `@google/generative-ai` as a dependency.

**Fix:** Remove `@google/generative-ai` if not used.

---

### 7. Hardcoded Image MIME Type

**File:** `web/backend/app.py` (line 41)

```python
return {"mime_type": "image/jpeg", "data": base64_string}
```

**Issue:** All images are assumed to be JPEG regardless of actual format.

**Fix:**
```python
def decode_image(base64_string: str):
    if not base64_string:
        return None
    
    # Extract MIME type from data URI
    mime_type = "image/jpeg"  # default
    if "base64," in base64_string:
        header = base64_string.split("base64,")[0]
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"
        elif "image/gif" in header:
            mime_type = "image/gif"
        base64_string = base64_string.split("base64,")[1]
    
    return {"mime_type": mime_type, "data": base64_string}
```

---

### 8. Debug Print Statements in Production Code

**File:** `config/loader.py` (lines 30-43)

```python
print("=== CONFIG LOADING ===")
print(f"GEMINI_API_KEY env var exists: {bool(os.getenv('GEMINI_API_KEY'))}")
print(f"GOOGLE_API_KEY env var exists: {bool(os.getenv('GOOGLE_API_KEY'))}")
# ... more prints
```

**Impact:** Leaks config debugging info to stdout in production.

**Fix:** Replace with logger calls:
```python
logger.debug("=== CONFIG LOADING ===")
logger.debug(f"GEMINI_API_KEY env var exists: {bool(os.getenv('GEMINI_API_KEY'))}")
```

---

### 9. Overly Permissive CORS

**File:** `web/backend/app.py` (lines 127-133)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← Too permissive
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Impact:** Allows any origin to make credentialed requests. Security risk.

**Fix:**
```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    os.getenv("FRONTEND_URL", ""),  # Production URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

---

### 10. Deprecated FastAPI Event Handler

**File:** `web/backend/app.py` (line 227)

```python
@app.on_event("startup")
async def startup_event():
```

**Issue:** `@app.on_event` is deprecated in FastAPI. Use lifespan context manager instead.

**Fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global voice_engine
    # ... existing startup logic ...
    yield
    # Shutdown (optional cleanup)

app = FastAPI(title="EchoBot Web UI", lifespan=lifespan)
```

---

## 🟡 Minor Issues (Nice to Fix)

### 11. Inconsistent Error Handling in Hooks

**File:** `src/hooks/useConversationTree.ts`

Some functions have try/catch, others don't. For example, `addMessage` doesn't catch errors, but `loadConversation` does.

**Recommendation:** Add error boundaries around all state mutations.

---

### 12. Magic Numbers

**File:** `src/hooks/useSecureWebSocket.ts` (line 134)

```typescript
rateLimit = 60,  // messages per minute
```

**File:** `web/backend/app.py` (line 129)

```typescript
max_tokens: 150  // in _get_openai_response
```

**Recommendation:** Move to constants file with descriptive names.

---

### 13. Unused Imports

**File:** `web/backend/app.py`

```python
from services.plugin_manager import PluginManager
from services.audio.tts import TTSEngine
from services.audio.voice_engine import VoiceEngine
```

These are initialized but may not be used in the main chat flow (only for WebSocket/voice mode).

**Recommendation:** Lazy-load these only when voice mode is enabled.

---

### 14. `newdesign/` Directory

**Issue:** Appears to be abandoned experimental files.

**Recommendation:** Archive or remove from main branch.

---

### 15. Dev Utilities in Root

**Files:** `debug_gemini.js`, `test_api.js` (visible in GitHub repo)

**Recommendation:** Move to a `scripts/` directory or add to `.gitignore`.

---

## ✅ Things Done Well

### Architecture
- **Clean hook-based architecture** — Each concern (chat, speech, WebSocket, settings) isolated
- **Tree-based conversation model** — Supports branching, uncle navigation, import/export
- **Secure API proxy** — Frontend never touches API keys

### Security
- **DOMPurify sanitization** — XSS protection on messages
- **URL sanitization** — Blocks `javascript:` and `data:` protocols
- **Rate limiting** — Client-side WebSocket rate limiter
- **Heartbeat/ping-pong** — Connection health monitoring

### UX
- **Offline detection** — Shows banner when disconnected
- **Error boundaries** — Graceful failure at multiple levels
- **Keyboard shortcuts** — Power user support
- **PWA manifest** — Installable as app

### DevOps
- **Multi-stage Docker build** — Small production image
- **Environment variable injection** — Secure config management
- **Flexible static file detection** — Works in dev and Docker

---

## Priority Fix Order

1. **🔴 CRITICAL:** Fix `saveConversation()` dead code (users losing data)
2. **🔴 CRITICAL:** Add missing `src/types/index.ts`
3. **🔴 CRITICAL:** Add missing `src/constants/index.ts`
4. **🟠 IMPORTANT:** Update `.gitignore` for `*.db`, `*.log`
5. **🟠 IMPORTANT:** Remove duplicate Gemini SDK
6. **🟠 IMPORTANT:** Fix CORS to be more restrictive
7. **🟡 MINOR:** Replace print() with logger in config/loader.py
8. **🟡 MINOR:** Fix deprecated @app.on_event
9. **🟡 MINOR:** Clean up vestigial files and scripts

---

## Recommended Next Steps

1. Run the fixes above
2. Add unit tests for `useConversationTree` (especially branching logic)
3. Add E2E tests for the chat flow
4. Set up CI/CD with GitHub Actions
5. Add Sentry or similar for production error tracking

---

*Review complete. Let me know if you want me to generate the actual fix files.*
