import { useEffect, useRef, useCallback, useState } from 'react';

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
    // Note: relying on side-effects of import.meta from usage context can be tricky,
    // but we can try to check it or fallback.
    // Accessing import.meta directly here might require 'esnext' or similar TS settings.
    // We'll use a pragmatic approach checking if port is 5173 or 3000 -> then use 8000/3001?

    // The user provided implementation:
    const isDev = (import.meta as any).env?.DEV;
    if (isDev) {
        // Assuming python backend is 8000 as per original App.tsx logic
        return `ws://${window.location.hostname}:8000/ws`;
    }

    return `${protocol}//${host}${port}/ws`;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const {
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        reconnectInterval = 5000,
        maxReconnectAttempts = Infinity
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
                        30000 // Max 30 seconds
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
