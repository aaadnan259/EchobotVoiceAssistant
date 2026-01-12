/**
 * =============================================================================
 * WebSocket Authentication
 * =============================================================================
 * 
 * Provides secure authentication for WebSocket connections.
 * 
 * Security features:
 * - Token-based authentication
 * - Origin validation
 * - Connection rate limiting
 * - Heartbeat/ping-pong for connection health
 */

import { logger } from './logger';

// =============================================================================
// Types
// =============================================================================

export interface WSAuthConfig {
    /** Authentication token (from session, JWT, etc.) */
    token?: string;
    /** Client identifier */
    clientId?: string;
    /** Additional metadata to send with auth */
    metadata?: Record<string, string>;
}

export interface WSAuthMessage {
    type: 'auth';
    token?: string;
    clientId: string;
    timestamp: number;
    origin: string;
    metadata?: Record<string, string>;
}

export interface WSAuthResponse {
    type: 'auth_response';
    success: boolean;
    message?: string;
    sessionId?: string;
}

// =============================================================================
// Client ID Generation
// =============================================================================

const CLIENT_ID_KEY = 'echobot_client_id';

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `client_${timestamp}_${randomPart}`;
}

/**
 * Get or create a persistent client ID
 */
export function getClientId(): string {
    try {
        let clientId = localStorage.getItem(CLIENT_ID_KEY);
        if (!clientId) {
            clientId = generateClientId();
            localStorage.setItem(CLIENT_ID_KEY, clientId);
        }
        return clientId;
    } catch {
        // Fallback for when localStorage is unavailable
        return generateClientId();
    }
}

// =============================================================================
// Authentication Message Creation
// =============================================================================

/**
 * Create an authentication message to send over WebSocket
 */
export function createAuthMessage(config: WSAuthConfig = {}): WSAuthMessage {
    return {
        type: 'auth',
        token: config.token,
        clientId: config.clientId || getClientId(),
        timestamp: Date.now(),
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        metadata: config.metadata,
    };
}

/**
 * Serialize auth message for sending
 */
export function serializeAuthMessage(message: WSAuthMessage): string {
    return JSON.stringify(message);
}

// =============================================================================
// Token Management
// =============================================================================

const TOKEN_KEY = 'echobot_ws_token';

/**
 * Store authentication token
 */
export function storeToken(token: string): void {
    try {
        sessionStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
        logger.warn('Failed to store WebSocket token:', e);
    }
}

/**
 * Retrieve stored authentication token
 */
export function getStoredToken(): string | null {
    try {
        return sessionStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Clear stored authentication token
 */
export function clearToken(): void {
    try {
        sessionStorage.removeItem(TOKEN_KEY);
    } catch {
        // Ignore errors
    }
}

// =============================================================================
// Simple Token Generation (for demo/development)
// =============================================================================

/**
 * Generate a simple token for development/demo purposes.
 * In production, tokens should come from your auth server.
 */
export function generateSimpleToken(): string {
    const payload = {
        clientId: getClientId(),
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2),
    };

    // Base64 encode (NOT secure, just for demo)
    return btoa(JSON.stringify(payload));
}

/**
 * Validate a simple token (development only)
 */
export function validateSimpleToken(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token));

        // Check token age (valid for 24 hours)
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - payload.timestamp > maxAge) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// Heartbeat Management
// =============================================================================

export interface HeartbeatConfig {
    /** Interval between pings in ms (default: 30000) */
    interval?: number;
    /** Timeout to wait for pong response in ms (default: 5000) */
    timeout?: number;
    /** Callback when connection is considered dead */
    onDead?: () => void;
}

/**
 * Create a heartbeat manager for WebSocket connection health
 */
export function createHeartbeat(
    sendPing: () => void,
    config: HeartbeatConfig = {}
) {
    const {
        interval = 30000,
        timeout = 5000,
        onDead
    } = config;

    let pingInterval: NodeJS.Timeout | null = null;
    let pongTimeout: NodeJS.Timeout | null = null;
    let isAlive = true;

    const start = () => {
        stop(); // Clear any existing intervals

        pingInterval = setInterval(() => {
            if (!isAlive) {
                logger.warn('WebSocket connection appears dead (no pong received)');
                onDead?.();
                stop();
                return;
            }

            isAlive = false;
            sendPing();

            // Set timeout for pong response
            pongTimeout = setTimeout(() => {
                if (!isAlive) {
                    logger.warn('WebSocket pong timeout');
                    onDead?.();
                }
            }, timeout);
        }, interval);
    };

    const receivedPong = () => {
        isAlive = true;
        if (pongTimeout) {
            clearTimeout(pongTimeout);
            pongTimeout = null;
        }
    };

    const stop = () => {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (pongTimeout) {
            clearTimeout(pongTimeout);
            pongTimeout = null;
        }
        isAlive = true;
    };

    return {
        start,
        stop,
        receivedPong,
        isAlive: () => isAlive,
    };
}

// =============================================================================
// Rate Limiting (Client-side)
// =============================================================================

export interface RateLimitConfig {
    /** Maximum messages per window */
    maxMessages: number;
    /** Time window in ms */
    windowMs: number;
}

/**
 * Create a client-side rate limiter
 */
export function createRateLimiter(config: RateLimitConfig) {
    const { maxMessages, windowMs } = config;
    const timestamps: number[] = [];

    const canSend = (): boolean => {
        const now = Date.now();

        // Remove timestamps outside the window
        while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
            timestamps.shift();
        }

        return timestamps.length < maxMessages;
    };

    const recordMessage = (): boolean => {
        if (!canSend()) {
            return false;
        }
        timestamps.push(Date.now());
        return true;
    };

    const remainingMessages = (): number => {
        const now = Date.now();
        const validTimestamps = timestamps.filter(t => t >= now - windowMs);
        return Math.max(0, maxMessages - validTimestamps.length);
    };

    const reset = () => {
        timestamps.length = 0;
    };

    return {
        canSend,
        recordMessage,
        remainingMessages,
        reset,
    };
}

// =============================================================================
// Export
// =============================================================================

export default {
    getClientId,
    createAuthMessage,
    serializeAuthMessage,
    storeToken,
    getStoredToken,
    clearToken,
    generateSimpleToken,
    validateSimpleToken,
    createHeartbeat,
    createRateLimiter,
};
