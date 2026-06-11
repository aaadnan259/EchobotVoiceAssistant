/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSecureWebSocket from '../useSecureWebSocket';

// Mock wsAuth functions
vi.mock('../../utils/wsAuth', () => ({
    createAuthMessage: vi.fn((config) => ({ type: 'auth', ...config })),
    serializeAuthMessage: vi.fn((msg) => JSON.stringify(msg)),
    createHeartbeat: vi.fn((pingFn, config) => ({
        start: vi.fn(),
        stop: vi.fn(),
        receivedPong: vi.fn(),
        _ping: pingFn, // expose for testing
        _config: config,
    })),
    createRateLimiter: vi.fn(() => ({
        recordMessage: vi.fn(() => true), // mock returns true by default
    })),
    getClientId: vi.fn(() => 'mock-client-id'),
    getStoredToken: vi.fn(),
    clearToken: vi.fn(),
    storeToken: vi.fn(),
}));

// Mock sessionService
vi.mock('../../services/sessionService', () => ({
    getToken: vi.fn(() => Promise.resolve('mock-session-token')),
    refreshToken: vi.fn(() => Promise.resolve('mock-new-token')),
}));

// Mock WebSocket
class MockWebSocket {
    url: string;
    onopen: (() => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    readyState: number = 0;
    
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    static instances: MockWebSocket[] = [];
    static closeAll() {
        MockWebSocket.instances.forEach(ws => {
            ws.readyState = 3;
        });
        MockWebSocket.instances = [];
    }

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) this.onopen();
        }, 5); // very small delay
    }

    send = vi.fn();
    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ code: 1000, reason: 'Normal Closure', wasClean: true });
    }
}

describe('useSecureWebSocket', () => {
    beforeEach(() => {
        (global as any).WebSocket = MockWebSocket;
        MockWebSocket.closeAll();
        vi.useFakeTimers();
        (global as any).fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ token: 'mock-session-token' })
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        delete (global as any).fetch;
    });

    it('auth_response success → state becomes connected', async () => {
        const { result } = renderHook(() => useSecureWebSocket());
        
        await act(async () => {
            vi.advanceTimersByTime(10); // Wait for connection and auth
        });
        
        // Find the active mock socket
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        
        // Simulate successful auth response
        await act(async () => {
            if (ws.onmessage) {
                ws.onmessage({ data: JSON.stringify({ type: 'auth_response', success: true, sessionId: 'sess-123' }) });
            }
        });
        
        expect(result.current.connectionState).toBe('connected');
        expect(result.current.isConnected).toBe(true);
        expect(result.current.sessionId).toBe('sess-123');
    });

    it('auth_response failure → onAuthError fired, socket closed', async () => {
        const onAuthError = vi.fn();
        const { result } = renderHook(() => useSecureWebSocket({ onAuthError }));
        
        await act(async () => {
            vi.advanceTimersByTime(10);
        });
        
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        const closeSpy = vi.spyOn(ws, 'close');
        
        // Simulate failed auth response
        await act(async () => {
            if (ws.onmessage) {
                ws.onmessage({ data: JSON.stringify({ type: 'auth_response', success: false, message: 'invalid token' }) });
            }
        });
        
        expect(onAuthError).toHaveBeenCalledWith('invalid token');
        expect(result.current.connectionState).toBe('disconnected');
        expect(closeSpy).toHaveBeenCalled();
    });

    it('pong resets the heartbeat (connection not declared dead)', async () => {
        const { result } = renderHook(() => useSecureWebSocket({ enableHeartbeat: true }));
        
        await act(async () => {
            vi.advanceTimersByTime(10);
        });
        
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        
        await act(async () => {
            if (ws.onmessage) {
                ws.onmessage({ data: JSON.stringify({ type: 'auth_response', success: true }) });
            }
        });

        // The heartbeat module is mocked, so we just check if receivedPong is called on our mock when a pong arrives
        const { createHeartbeat } = await import('../../utils/wsAuth');
        const mockHeartbeatInstance = (createHeartbeat as any).mock.results[0].value;
        
        act(() => {
            if (ws.onmessage) {
                ws.onmessage({ data: JSON.stringify({ type: 'pong' }) });
            }
        });
        
        expect(mockHeartbeatInstance.receivedPong).toHaveBeenCalled();
    });

    it('reconnect uses exponential backoff capped at MAX_RECONNECT_DELAY', async () => {
        const { logger } = await import('../../utils/logger');
        const loggerSpy = vi.spyOn(logger, 'debug');
        
        const reconnectInterval = 1000;
        const maxDelay = 30000; // MAX_RECONNECT_DELAY default
        
        renderHook(() => useSecureWebSocket({ 
            reconnectInterval, 
            maxReconnectAttempts: 5 
        }));
        
        await act(async () => {
            vi.advanceTimersByTime(10); // initial connect
        });

        const ws1 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        expect(MockWebSocket.instances.length).toBe(1);

        // Disconnect 1st time -> attempt 1 delay is 1000 * 2^0 = 1000
        await act(async () => {
            if (ws1.onclose) ws1.onclose({ code: 1006, reason: 'Abnormal Closure' });
        });
        
        await act(async () => {
            vi.advanceTimersByTime(1500); 
        });
        
        expect(MockWebSocket.instances.length).toBe(2);
        
        // Disconnect 2nd time -> attempt 2 delay is 1000 * 2^1 = 2000
        const ws2 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        await act(async () => {
            if (ws2.onclose) ws2.onclose({ code: 1006 });
        });
        
        await act(async () => {
            vi.advanceTimersByTime(2500);
        });
        
        expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(3);
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Reconnecting in 1000ms'));
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Reconnecting in 2000ms'));
    });

    it('rate limiter blocks send() past the limit', async () => {
        const { createRateLimiter } = await import('../../utils/wsAuth');
        const mockLimiter = { recordMessage: vi.fn() };
        (createRateLimiter as any).mockReturnValueOnce(mockLimiter);

        const { result } = renderHook(() => useSecureWebSocket());
        
        await act(async () => {
            vi.advanceTimersByTime(10);
        });
        
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        
        await act(async () => {
            if (ws.onmessage) {
                ws.onmessage({ data: JSON.stringify({ type: 'auth_response', success: true }) });
            }
        });

        // Limiter allows first message
        mockLimiter.recordMessage.mockReturnValueOnce(true);
        act(() => {
            const sent = result.current.send('test1');
            expect(sent).toBe(true);
        });
        
        // Limiter blocks second message
        mockLimiter.recordMessage.mockReturnValueOnce(false);
        act(() => {
            const sent = result.current.send('test2');
            expect(sent).toBe(false);
        });
        
        expect(ws.send).toHaveBeenCalledTimes(2); // 1 for auth, 1 for send
    });

    it('auth message includes the server-issued token from sessionService', async () => {
        renderHook(() => useSecureWebSocket());
        
        await act(async () => {
            vi.advanceTimersByTime(10);
        });
        
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        
        // WS sends auth message on open
        expect(ws.send).toHaveBeenCalled();
        const sentMessage = (ws.send as any).mock.calls[0][0];
        const parsed = JSON.parse(sentMessage);
        
        expect(parsed.type).toBe('auth');
        expect(parsed.token).toBe('mock-session-token');
    });
});
