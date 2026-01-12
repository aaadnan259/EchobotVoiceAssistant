/**
 * =============================================================================
 * Example: Server with Authenticated WebSocket
 * =============================================================================
 * 
 * This shows how to set up the Express server with authenticated WebSocket.
 * Merge this with your existing server.js.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import chatRoutes from './routes/chat.js';
import geminiRoutes from './routes/gemini.js';
import { createWSAuthHandler, wsUpgradeMiddleware } from './routes/wsAuthMiddleware.js';

const app = express();
const server = createServer(app);

// =============================================================================
// Middleware
// =============================================================================

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('build'));

// WebSocket upgrade origin check
app.use(wsUpgradeMiddleware({
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(','),
}));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// =============================================================================
// HTTP Routes
// =============================================================================

app.use('/api', chatRoutes);
app.use('/api/gemini', geminiRoutes);

// SPA Fallback
app.get(/.*/, (req, res) => {
    res.sendFile('index.html', { root: 'build' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// =============================================================================
// WebSocket Server with Authentication
// =============================================================================

const wss = new WebSocketServer({ server, path: '/ws' });

// Create auth handler with custom token validator
const wsAuth = createWSAuthHandler({
    // Custom token validator - integrate with your auth system
    validateToken: async (token) => {
        // Example: Validate JWT token
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // return !!decoded;

        // For development, accept any non-empty token
        if (process.env.NODE_ENV === 'development') {
            return true;
        }

        // In production, implement proper validation
        return token && token.length > 0;
    },

    // Allowed origins (from environment)
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(','),

    // Auth timeout (10 seconds)
    authTimeout: 10000,

    // Max connections per client
    maxConnectionsPerClient: 3,

    // Require authentication
    requireAuth: process.env.NODE_ENV === 'production',
});

// Handle new connections
wss.on('connection', (ws, req) => {
    console.log(`[WS] New connection from ${req.socket.remoteAddress}`);

    // Let auth handler manage the connection
    wsAuth.handleConnection(ws, req);

    // Handle authenticated messages
    ws.on('message', (data) => {
        // Skip if not authenticated (auth handler already responded)
        if (!wsAuth.isAuthenticated(ws)) {
            return;
        }

        try {
            const message = JSON.parse(data.toString());

            // Skip system messages (handled by auth handler)
            if (['auth', 'ping'].includes(message.type)) {
                return;
            }

            const clientId = wsAuth.getClientId(ws);
            console.log(`[WS] Message from ${clientId}:`, message.type || 'unknown');

            // Handle your application messages here
            handleClientMessage(ws, message, clientId);

        } catch (error) {
            console.error('[WS] Message handling error:', error);
        }
    });
});

/**
 * Handle application-specific WebSocket messages
 */
function handleClientMessage(ws, message, clientId) {
    switch (message.type) {
        case 'chat':
            // Handle chat message
            // Could forward to AI, store in DB, etc.
            ws.send(JSON.stringify({
                type: 'chat_response',
                text: `Received: ${message.text}`,
            }));
            break;

        case 'status':
            // Send current status
            ws.send(JSON.stringify({
                type: 'status',
                status: 'idle',
                clientId,
            }));
            break;

        default:
            console.log(`[WS] Unknown message type: ${message.type}`);
    }
}

// =============================================================================
// Broadcast Example
// =============================================================================

/**
 * Broadcast a message to all authenticated clients
 * @param {any} data - Data to broadcast
 */
function broadcastToAll(data) {
    wsAuth.broadcast(data);
}

/**
 * Send message to specific client
 * @param {string} clientId - Target client ID
 * @param {any} data - Data to send
 */
function sendToClient(clientId, data) {
    const connections = wsAuth.getClientConnections(clientId);
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    for (const ws of connections) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(message);
        }
    }
}

// =============================================================================
// Start Server
// =============================================================================

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');

    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
    });

    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`✓ Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});

export { broadcastToAll, sendToClient };
