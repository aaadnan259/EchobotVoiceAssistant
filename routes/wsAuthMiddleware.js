/**
 * =============================================================================
 * WebSocket Authentication Middleware (Backend)
 * =============================================================================
 * 
 * Express/Node.js middleware for authenticating WebSocket connections.
 * 
 * Usage:
 *   import { WebSocketServer } from 'ws';
 *   import { createWSAuthHandler } from './wsAuthMiddleware.js';
 *   
 *   const wss = new WebSocketServer({ server });
 *   const wsAuth = createWSAuthHandler({ validateToken: myValidator });
 *   
 *   wss.on('connection', (ws, req) => {
 *     wsAuth.handleConnection(ws, req);
 *   });
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} WSAuthMessage
 * @property {'auth'} type
 * @property {string} [token]
 * @property {string} clientId
 * @property {number} timestamp
 * @property {string} origin
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} WSAuthConfig
 * @property {function(string): Promise<boolean>} [validateToken] - Custom token validator
 * @property {string[]} [allowedOrigins] - Allowed origins (default: all)
 * @property {number} [authTimeout] - Auth timeout in ms (default: 10000)
 * @property {number} [maxConnectionsPerClient] - Max connections per client ID
 * @property {boolean} [requireAuth] - Whether auth is required (default: true)
 */

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG = {
    authTimeout: 10000,
    maxConnectionsPerClient: 5,
    requireAuth: true,
    allowedOrigins: null, // null = allow all
};

// =============================================================================
// Connection Tracking
// =============================================================================

/** @type {Map<string, Set<WebSocket>>} */
const clientConnections = new Map();

/** @type {Map<WebSocket, string>} */
const connectionClients = new Map();

/** @type {Map<WebSocket, { authenticated: boolean, clientId: string | null, sessionId: string | null }>} */
const connectionState = new Map();

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a session ID
 * @returns {string}
 */
function generateSessionId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validate origin against allowed list
 * @param {string} origin 
 * @param {string[] | null} allowedOrigins 
 * @returns {boolean}
 */
function validateOrigin(origin, allowedOrigins) {
    if (!allowedOrigins || allowedOrigins.length === 0) {
        return true; // Allow all if not specified
    }
    return allowedOrigins.includes(origin);
}

/**
 * Check message age (prevent replay attacks)
 * @param {number} timestamp 
 * @param {number} maxAge - Maximum age in ms (default: 5 minutes)
 * @returns {boolean}
 */
function validateTimestamp(timestamp, maxAge = 5 * 60 * 1000) {
    const age = Date.now() - timestamp;
    return age >= 0 && age <= maxAge;
}

/**
 * Default token validator (always returns true - override in production!)
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function defaultTokenValidator(token) {
    // In production, validate against your auth system
    // This default just checks if token exists and is non-empty
    return typeof token === 'string' && token.length > 0;
}

// =============================================================================
// Auth Handler Factory
// =============================================================================

/**
 * Create a WebSocket authentication handler
 * @param {WSAuthConfig} config 
 */
export function createWSAuthHandler(config = {}) {
    const {
        validateToken = defaultTokenValidator,
        allowedOrigins = DEFAULT_CONFIG.allowedOrigins,
        authTimeout = DEFAULT_CONFIG.authTimeout,
        maxConnectionsPerClient = DEFAULT_CONFIG.maxConnectionsPerClient,
        requireAuth = DEFAULT_CONFIG.requireAuth,
    } = config;

    /**
     * Send auth response to client
     * @param {WebSocket} ws 
     * @param {boolean} success 
     * @param {string} [message] 
     * @param {string} [sessionId] 
     */
    function sendAuthResponse(ws, success, message, sessionId) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
                type: 'auth_response',
                success,
                message,
                sessionId,
            }));
        }
    }

    /**
     * Handle incoming auth message
     * @param {WebSocket} ws 
     * @param {WSAuthMessage} authMessage 
     */
    async function handleAuthMessage(ws, authMessage) {
        const state = connectionState.get(ws);
        if (!state) return;

        // Already authenticated
        if (state.authenticated) {
            sendAuthResponse(ws, true, 'Already authenticated', state.sessionId);
            return;
        }

        const { token, clientId, timestamp, origin } = authMessage;

        // Validate origin
        if (!validateOrigin(origin, allowedOrigins)) {
            console.warn(`[WS Auth] Origin rejected: ${origin}`);
            sendAuthResponse(ws, false, 'Origin not allowed');
            ws.close(4001, 'Origin not allowed');
            return;
        }

        // Validate timestamp (prevent replay attacks)
        if (!validateTimestamp(timestamp)) {
            console.warn(`[WS Auth] Invalid timestamp: ${timestamp}`);
            sendAuthResponse(ws, false, 'Invalid or expired auth message');
            ws.close(4002, 'Auth message expired');
            return;
        }

        // Check client connection limit
        const existingConnections = clientConnections.get(clientId);
        if (existingConnections && existingConnections.size >= maxConnectionsPerClient) {
            console.warn(`[WS Auth] Too many connections for client: ${clientId}`);
            sendAuthResponse(ws, false, 'Too many connections');
            ws.close(4003, 'Connection limit exceeded');
            return;
        }

        // Validate token (if provided or required)
        if (requireAuth || token) {
            try {
                const isValid = await validateToken(token || '');
                if (!isValid) {
                    console.warn(`[WS Auth] Token validation failed for client: ${clientId}`);
                    sendAuthResponse(ws, false, 'Invalid token');
                    ws.close(4004, 'Invalid token');
                    return;
                }
            } catch (error) {
                console.error('[WS Auth] Token validation error:', error);
                sendAuthResponse(ws, false, 'Authentication error');
                ws.close(4005, 'Authentication error');
                return;
            }
        }

        // Authentication successful
        const sessionId = generateSessionId();

        state.authenticated = true;
        state.clientId = clientId;
        state.sessionId = sessionId;

        // Track connection
        if (!clientConnections.has(clientId)) {
            clientConnections.set(clientId, new Set());
        }
        clientConnections.get(clientId).add(ws);
        connectionClients.set(ws, clientId);

        console.log(`[WS Auth] Client authenticated: ${clientId} (session: ${sessionId})`);
        sendAuthResponse(ws, true, 'Authenticated', sessionId);
    }

    /**
     * Handle new WebSocket connection
     * @param {WebSocket} ws 
     * @param {import('http').IncomingMessage} req 
     */
    function handleConnection(ws, req) {
        // Initialize connection state
        connectionState.set(ws, {
            authenticated: false,
            clientId: null,
            sessionId: null,
        });

        // Set auth timeout
        const authTimer = setTimeout(() => {
            const state = connectionState.get(ws);
            if (state && !state.authenticated) {
                console.warn('[WS Auth] Authentication timeout');
                sendAuthResponse(ws, false, 'Authentication timeout');
                ws.close(4006, 'Authentication timeout');
            }
        }, authTimeout);

        // Handle messages
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                // Handle auth message
                if (message.type === 'auth') {
                    clearTimeout(authTimer);
                    await handleAuthMessage(ws, message);
                    return;
                }

                // Handle ping
                if (message.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                // For other messages, check if authenticated
                const state = connectionState.get(ws);
                if (requireAuth && (!state || !state.authenticated)) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        text: 'Not authenticated',
                    }));
                    return;
                }

                // Message is valid, can be processed by application
                // The application should handle this in wss.on('message')

            } catch (error) {
                console.error('[WS Auth] Message parse error:', error);
            }
        });

        // Handle close
        ws.on('close', () => {
            clearTimeout(authTimer);

            const clientId = connectionClients.get(ws);
            if (clientId) {
                const connections = clientConnections.get(clientId);
                if (connections) {
                    connections.delete(ws);
                    if (connections.size === 0) {
                        clientConnections.delete(clientId);
                    }
                }
                connectionClients.delete(ws);
            }

            connectionState.delete(ws);
        });

        // Handle error
        ws.on('error', (error) => {
            console.error('[WS Auth] WebSocket error:', error);
        });
    }

    /**
     * Check if a connection is authenticated
     * @param {WebSocket} ws 
     * @returns {boolean}
     */
    function isAuthenticated(ws) {
        const state = connectionState.get(ws);
        return state?.authenticated || false;
    }

    /**
     * Get client ID for a connection
     * @param {WebSocket} ws 
     * @returns {string | null}
     */
    function getClientId(ws) {
        return connectionState.get(ws)?.clientId || null;
    }

    /**
     * Get all connections for a client
     * @param {string} clientId 
     * @returns {Set<WebSocket>}
     */
    function getClientConnections(clientId) {
        return clientConnections.get(clientId) || new Set();
    }

    /**
     * Broadcast message to all authenticated connections
     * @param {any} data 
     * @param {function(WebSocket): boolean} [filter] - Optional filter function
     */
    function broadcast(data, filter) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);

        for (const [ws, state] of connectionState.entries()) {
            if (state.authenticated && ws.readyState === 1) {
                if (!filter || filter(ws)) {
                    ws.send(message);
                }
            }
        }
    }

    return {
        handleConnection,
        isAuthenticated,
        getClientId,
        getClientConnections,
        broadcast,
    };
}

// =============================================================================
// Express Middleware (for HTTP upgrade)
// =============================================================================

/**
 * Express middleware to validate WebSocket upgrade requests
 * @param {WSAuthConfig} config 
 */
export function wsUpgradeMiddleware(config = {}) {
    const { allowedOrigins } = config;

    return (req, res, next) => {
        // Only handle WebSocket upgrade requests
        if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
            return next();
        }

        // Validate origin
        const origin = req.headers.origin;
        if (allowedOrigins && allowedOrigins.length > 0) {
            if (!origin || !allowedOrigins.includes(origin)) {
                console.warn(`[WS Upgrade] Origin rejected: ${origin}`);
                return res.status(403).send('Origin not allowed');
            }
        }

        next();
    };
}

export default {
    createWSAuthHandler,
    wsUpgradeMiddleware,
};
