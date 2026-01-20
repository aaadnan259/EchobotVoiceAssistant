import { useEffect, useRef, useCallback, useState } from 'react';
import { WEBSOCKET_CONFIG } from '../constants';
import { logger } from '../utils/logger';
import {
    createAuthMessage,
    serializeAuthMessage,
    createHeartbeat,
    createRateLimiter,
    getClientId,
    WSAuthConfig,
    WSAuthResponse,
} from '../utils/wsAuth';

const {
    RECONNECT_INTERVAL,
    MAX_RECONNECT_DELAY,
    MAX_RECONNECT_ATTEMPTS: DEFAULT_MAX_ATTEMPTS,
    WS_PATH,
    DEV_WS_PORT,
} = WEBSOCKET_CONFIG;



interface WebSocketMessage {
    type?: string;
    status?: string;
    text?: string;
    audio?: string;
    [key: string]: any;
}

type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected'
    | 'error';

interface UseSecureWebSocketOptions {
    /** Called when a message is received */
    onMessage?: (data: WebSocketMessage) => void;
    /** Called when connection is established and authenticated */
    onConnect?: () => void;
    /** Called when connection is lost */
    onDisconnect?: () => void;
    /** Called on connection error */
    onError?: (error: Event | Error) => void;
    /** Called when authentication fails */
    onAuthError?: (message: string) => void;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    authConfig?: WSAuthConfig;
    enableHeartbeat?: boolean;
    heartbeatInterval?: number;
    enableRateLimit?: boolean;
    rateLimit?: number;
    allowedOrigins?: string[];
}

interface UseSecureWebSocketReturn {
    /** Whether the connection is established and authenticated */
    isConnected: boolean;
    /** Current connection state */
    connectionState: ConnectionState;
    /** Send a message (returns false if rate limited or not connected) */
    send: (data: any) => boolean;
    /** Manually connect */
    connect: () => void;
    /** Manually disconnect */
    disconnect: () => void;
    /** Current client ID */
    clientId: string;
    /** Session ID (if authenticated) */
    sessionId: string | null;
}

// =============================================================================
// URL Helper
// =============================================================================

function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';

    const isDev = (import.meta as any).env?.DEV;
    if (isDev) {
        return `ws://${window.location.hostname}:${DEV_WS_PORT}${WS_PATH}`;
    }

    return `${protocol}//${host}${port}${WS_PATH}`;
}

export function useSecureWebSocket(
    options: UseSecureWebSocketOptions = {}
): UseSecureWebSocketReturn {
    const {
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        onAuthError,
        reconnectInterval = RECONNECT_INTERVAL,
        maxReconnectAttempts = DEFAULT_MAX_ATTEMPTS,
        authConfig = {},
        enableHeartbeat = true,
        heartbeatInterval = 30000,
        enableRateLimit = true,
        rateLimit = 60,
    } = options;

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasConnectedOnce = useRef(false);
    const heartbeatRef = useRef<ReturnType<typeof createHeartbeat> | null>(null);
    const rateLimiterRef = useRef(
        createRateLimiter({ maxMessages: rateLimit, windowMs: 60000 })
    );

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const clientId = getClientId();

    // Computed
    const isConnected = connectionState === 'connected';

    // ==========================================================================
    // Send Message
    // ==========================================================================

    const send = useCallback((data: any): boolean => {
        // Check connection
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            logger.warn('WebSocket not connected, cannot send message');
            return false;
        }

        // Check rate limit
        if (enableRateLimit && !rateLimiterRef.current.recordMessage()) {
            logger.warn('Rate limit exceeded, message not sent');
            return false;
        }

        try {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            wsRef.current.send(message);
            return true;
        } catch (e) {
            logger.error('Failed to send WebSocket message:', e);
            return false;
        }
    }, [enableRateLimit]);

    // ==========================================================================
    // Handle Authentication
    // ==========================================================================

    const authenticate = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        setConnectionState('authenticating');

        const authMessage = createAuthMessage({
            ...authConfig,
            clientId,
        });

        wsRef.current.send(serializeAuthMessage(authMessage));
        logger.debug('Sent authentication message');
    }, [authConfig, clientId]);

    const handleAuthResponse = useCallback((response: WSAuthResponse) => {
        if (response.success) {
            setConnectionState('connected');
            setSessionId(response.sessionId || null);
            logger.info('WebSocket authenticated successfully');

            if (!hasConnectedOnce.current) {
                hasConnectedOnce.current = true;
                onConnect?.();
            }

            // Start heartbeat after successful auth
            if (enableHeartbeat && heartbeatRef.current) {
                heartbeatRef.current.start();
            }
        } else {
            setConnectionState('error');
            logger.error('WebSocket authentication failed:', response.message);
            onAuthError?.(response.message || 'Authentication failed');
            wsRef.current?.close();
        }
    }, [onConnect, onAuthError, enableHeartbeat]);

    // ==========================================================================
    // Connect
    // ==========================================================================

    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = getWebSocketUrl();
        setConnectionState('connecting');
        logger.debug('Connecting to WebSocket:', wsUrl);

        try {
            const socket = new WebSocket(wsUrl);

            // Create heartbeat manager
            if (enableHeartbeat) {
                heartbeatRef.current = createHeartbeat(
                    () => {
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ type: 'ping' }));
                        }
                    },
                    {
                        interval: heartbeatInterval,
                        timeout: 5000,
                        onDead: () => {
                            logger.warn('WebSocket connection dead, reconnecting...');
                            socket.close();
                        },
                    }
                );
            }

            socket.onopen = () => {
                logger.debug('WebSocket connected, authenticating...');
                reconnectAttempts.current = 0;
                authenticate();
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Handle pong response
                    if (data.type === 'pong') {
                        heartbeatRef.current?.receivedPong();
                        return;
                    }

                    // Handle auth response
                    if (data.type === 'auth_response') {
                        handleAuthResponse(data as WSAuthResponse);
                        return;
                    }

                    // Handle regular messages (only if authenticated)
                    if (connectionState === 'connected' || data.type === 'auth_response') {
                        onMessage?.(data);
                    }
                } catch (e) {
                    logger.error('Failed to parse WebSocket message:', e);
                }
            };

            socket.onerror = (error) => {
                logger.error('WebSocket error:', error);
                setConnectionState('error');
                onError?.(error);
            };

            socket.onclose = () => {
                setConnectionState('disconnected');
                setSessionId(null);
                heartbeatRef.current?.stop();
                onDisconnect?.();

                // Attempt reconnection with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(
                        reconnectInterval * Math.pow(2, reconnectAttempts.current),
                        MAX_RECONNECT_DELAY
                    );

                    logger.debug(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            wsRef.current = socket;
        } catch (e) {
            logger.error('Failed to create WebSocket:', e);
            setConnectionState('error');
            onError?.(e as Error);
        }
    }, [
        authenticate,
        handleAuthResponse,
        onMessage,
        onDisconnect,
        onError,
        reconnectInterval,
        maxReconnectAttempts,
        enableHeartbeat,
        heartbeatInterval,
        connectionState,
    ]);

    // ==========================================================================
    // Disconnect
    // ==========================================================================

    const disconnect = useCallback(() => {
        // Prevent auto-reconnect
        reconnectAttempts.current = maxReconnectAttempts;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        heartbeatRef.current?.stop();
        wsRef.current?.close();
        setConnectionState('disconnected');
        setSessionId(null);
    }, [maxReconnectAttempts]);

    // ==========================================================================
    // Lifecycle
    // ==========================================================================

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            heartbeatRef.current?.stop();
            wsRef.current?.close();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        isConnected,
        connectionState,
        send,
        connect,
        disconnect,
        clientId,
        sessionId,
    };
}

export default useSecureWebSocket;
