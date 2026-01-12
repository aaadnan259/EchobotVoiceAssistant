# WebSocket Authentication Migration Guide

## Overview

This guide explains how to upgrade your EchoBot WebSocket connection from unauthenticated to authenticated.

## Why Authenticate WebSockets?

Without authentication, anyone can:
- Connect to your WebSocket server
- Send/receive messages pretending to be other users
- Potentially overwhelm your server with connections

With authentication:
- Only verified clients can connect
- Each connection is tied to a client identity
- Rate limiting prevents abuse
- Origin validation blocks unauthorized sites

## Files Added

### Frontend
- `src/utils/wsAuth.ts` - Authentication utilities
- `src/hooks/useSecureWebSocket.ts` - Authenticated WebSocket hook

### Backend
- `routes/wsAuthMiddleware.js` - Server-side auth handler
- `server-with-ws-auth.js` - Example server implementation

## Migration Steps

### Step 1: Update Backend

Replace your WebSocket setup with the authenticated version:

```javascript
// Before (server.js)
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  // Handle messages directly
});

// After (server-with-ws-auth.js pattern)
import { createWSAuthHandler } from './routes/wsAuthMiddleware.js';

const wss = new WebSocketServer({ server, path: '/ws' });
const wsAuth = createWSAuthHandler({
  validateToken: async (token) => {
    // Your token validation logic
    return true;
  },
  requireAuth: process.env.NODE_ENV === 'production',
});

wss.on('connection', (ws, req) => {
  wsAuth.handleConnection(ws, req);
  
  ws.on('message', (data) => {
    if (!wsAuth.isAuthenticated(ws)) return;
    // Handle authenticated messages
  });
});
```

### Step 2: Update Frontend

Switch from `useWebSocket` to `useSecureWebSocket`:

```typescript
// Before
import { useWebSocket } from './hooks';

useWebSocket({
  onConnect: () => console.log('Connected'),
  onMessage: (data) => handleMessage(data),
});

// After
import { useSecureWebSocket } from './hooks';

const { isConnected, connectionState, send } = useSecureWebSocket({
  onConnect: () => console.log('Connected & Authenticated'),
  onMessage: (data) => handleMessage(data),
  onAuthError: (msg) => console.error('Auth failed:', msg),
  authConfig: {
    token: getAuthToken(), // Your auth token
  },
});
```

### Step 3: Environment Variables

Add these to your `.env`:

```env
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# For JWT token validation (if using)
JWT_SECRET=your-secret-key
```

## Authentication Flow

```
1. Client connects to WebSocket
   ↓
2. Server starts 10-second auth timeout
   ↓
3. Client sends auth message:
   {
     type: 'auth',
     token: 'optional-jwt-or-session-token',
     clientId: 'client_abc123',
     timestamp: 1234567890,
     origin: 'https://yourdomain.com'
   }
   ↓
4. Server validates:
   - Origin (in allowed list?)
   - Timestamp (not too old?)
   - Token (valid?)
   - Connection limit (not exceeded?)
   ↓
5. Server responds:
   { type: 'auth_response', success: true, sessionId: 'sess_xyz' }
   ↓
6. Client can now send/receive messages
```

## Security Features

### Client-Side

| Feature | Description |
|---------|-------------|
| **Rate Limiting** | 60 messages/minute default |
| **Heartbeat** | Ping/pong every 30s to detect dead connections |
| **Client ID** | Persistent ID stored in localStorage |
| **Token Storage** | Session token in sessionStorage |

### Server-Side

| Feature | Description |
|---------|-------------|
| **Origin Validation** | Reject connections from unauthorized origins |
| **Timestamp Check** | Reject old auth messages (replay attack prevention) |
| **Connection Limit** | Max 3 connections per client ID |
| **Auth Timeout** | Close unauthenticated connections after 10s |

## Customizing Token Validation

For production, implement proper token validation:

```javascript
// JWT Example
import jwt from 'jsonwebtoken';

const wsAuth = createWSAuthHandler({
  validateToken: async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return !!decoded.userId;
    } catch {
      return false;
    }
  },
});

// Session Example
const wsAuth = createWSAuthHandler({
  validateToken: async (token) => {
    const session = await sessionStore.get(token);
    return session && !session.expired;
  },
});
```

## Connection States

The `useSecureWebSocket` hook provides these states:

| State | Description |
|-------|-------------|
| `disconnected` | Not connected |
| `connecting` | WebSocket connecting |
| `authenticating` | Connected, sending auth |
| `connected` | Authenticated and ready |
| `error` | Connection or auth error |

## Backward Compatibility

The old `useWebSocket` hook still works for development or if you don't need authentication. You can gradually migrate by:

1. Deploy backend with auth (but `requireAuth: false`)
2. Update frontend to use `useSecureWebSocket`
3. Test everything works
4. Enable `requireAuth: true` in production

## Troubleshooting

### "Origin not allowed"
- Check `ALLOWED_ORIGINS` environment variable
- Make sure your domain is in the list

### "Authentication timeout"
- Client isn't sending auth message quickly enough
- Check network latency
- Increase `authTimeout` if needed

### "Too many connections"
- Client has > 3 tabs open
- Increase `maxConnectionsPerClient` or implement connection reuse

### "Invalid token"
- Token validation failing
- Check your `validateToken` implementation
- Verify token isn't expired
