import { useEffect, useRef, useCallback, useState } from 'react';
import { WEBSOCKET_CONFIG } from '../constants';

const {
    RECONNECT_INTERVAL,
    MAX_RECONNECT_DELAY,
    MAX_RECONNECT_ATTEMPTS: DEFAULT_MAX_ATTEMPTS,
    WS_PATH,
    DEV_WS_PORT
} = WEBSOCKET_CONFIG;

interface WebSocketMessage {
    type?: string;
    status?: string;
    text?: string;
    audio?: string;
    [key: string]: any;
}

interface UseWebSocketOptions {
    onMessage?: (data: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';

    // In development, backend might be on a different port
    const isDev = (import.meta as any).env?.DEV;
    if (isDev) {
        return `ws://${window.location.hostname}:${DEV_WS_PORT}${WS_PATH}`;
    }

    return `${protocol}//${host}${port}${WS_PATH}`;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const {
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        reconnectInterval = RECONNECT_INTERVAL,
        maxReconnectAttempts = DEFAULT_MAX_ATTEMPTS
    } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasConnectedOnce = useRef(false);

    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = getWebSocketUrl();
        setConnectionStatus('connecting');

        try {
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttempts.current = 0;

                if (!hasConnectedOnce.current) {
                    hasConnectedOnce.current = true;
                    onConnect?.();
                }
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage?.(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                onError?.(error);
            };

            socket.onclose = () => {
                setIsConnected(false);
                setConnectionStatus('disconnected');
                onDisconnect?.();

                // Attempt reconnection with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(
                        reconnectInterval * Math.pow(2, reconnectAttempts.current),
                        MAX_RECONNECT_DELAY
                    );

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            wsRef.current = socket;
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            setConnectionStatus('disconnected');
        }
    }, [onMessage, onConnect, onDisconnect, onError, reconnectInterval, maxReconnectAttempts]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
        wsRef.current?.close();
    }, [maxReconnectAttempts]);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected, cannot send message');
        return false;
    }, []);

    // Connect on mount
    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            wsRef.current?.close();
        };
    }, [connect]);

    return {
        isConnected,
        connectionStatus,
        send,
        connect,
        disconnect
    };
}
