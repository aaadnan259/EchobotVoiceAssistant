# WebSocket Authentication

## Protocol Overview

Restricts WebSocket access to authorized clients via a token-based handshake.

1.  **Connection**: Client initiates WS connection to `/ws`.
2.  **Handshake**: Client sends auth payload within 10 seconds.
3.  **Validation**: Server verifies origin, timestamp, and token.
4.  **Session**: Valid connections receive a session ID; invalid ones are terminated.

## Configuration

Environment variables:

```ini
ALLOWED_ORIGINS=https://domain.com
JWT_SECRET=your_secret_key
```

## Client Implementation

Use `useSecureWebSocket` hook:

```typescript
import { useSecureWebSocket } from './hooks';

const { send } = useSecureWebSocket({
  authConfig: { token: getAuthToken() },
  onMessage: handleMessage
});
```

## Auth Payload Structure

```json
{
  "type": "auth",
  "token": "...",
  "clientId": "unique_client_id",
  "timestamp": 1234567890
}
```
