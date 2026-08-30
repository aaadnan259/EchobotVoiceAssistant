import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamGeminiResponse, getGeminiResponse } from '../geminiService';
import { getToken, refreshToken } from '../sessionService';

vi.mock('../../utils/wsAuth', () => ({
    getAuthToken: vi.fn(() => Promise.resolve('mock-token')),
    getStoredToken: vi.fn(() => 'mock-token'),
}));

vi.mock('../sessionService', () => ({
    getToken: vi.fn(),
    refreshToken: vi.fn(),
}));

describe('geminiService', () => {
    beforeEach(() => {
        vi.mocked(getToken).mockReset().mockResolvedValue('mock-token');
        vi.mocked(refreshToken).mockReset().mockResolvedValue('refreshed-token');
    });

    it('yields text chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"text": "hello"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"text": " world"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"done": true}\n\n'));
                controller.close();
            }
        });
        
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: stream,
        });

        let result = '';
        for await (const chunk of streamGeminiResponse('test', '', [], 'test')) {
            result += chunk;
        }
        
        expect(result).toBe('hello world');
    });

    it('throws on SSE error frame', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"error": "Server error"}\n\n'));
                controller.close();
            }
        });
        
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: stream,
        });

        await expect(async () => {
            for await (const chunk of streamGeminiResponse('test', '', [], 'test')) {}
        }).rejects.toThrow('Server error');
    });

    it('handles partial-line buffering', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"text": "par'));
                controller.enqueue(new TextEncoder().encode('tial"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"done": true}\n\n'));
                controller.close();
            }
        });
        
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: stream,
        });

        let result = '';
        for await (const chunk of streamGeminiResponse('test', '', [], 'test')) {
            result += chunk;
        }
        
        expect(result).toBe('partial');
    });

    it('retries the request once and succeeds after a 401 triggers a token refresh', async () => {
        vi.mocked(getToken).mockResolvedValue('stale-token');
        vi.mocked(refreshToken).mockResolvedValue('fresh-token');

        const successStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"text": "hi"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"done": true}\n\n'));
                controller.close();
            }
        });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Invalid or expired token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                body: successStream,
            });
        global.fetch = fetchMock as any;

        let result = '';
        for await (const chunk of streamGeminiResponse('test', '', [], 'test')) {
            result += chunk;
        }

        expect(result).toBe('hi');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(refreshToken).toHaveBeenCalledTimes(1);
        const secondCallHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
        expect(secondCallHeaders.Authorization).toBe('Bearer fresh-token');
    });

    it('throws exactly once and does not retry again when the refreshed request also fails', async () => {
        vi.mocked(getToken).mockResolvedValue('stale-token');
        vi.mocked(refreshToken).mockResolvedValue('still-bad-token');

        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Invalid or expired token' }),
        });
        global.fetch = fetchMock as any;

        await expect(async () => {
            for await (const chunk of streamGeminiResponse('test', '', [], 'test')) { /* noop */ }
        }).rejects.toThrow('Invalid or expired token');

        // Exactly the original request plus one retry - never a second retry (no loop).
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(refreshToken).toHaveBeenCalledTimes(1);
    });

    it('does not attempt a token refresh or retry for non-401 errors', async () => {
        vi.mocked(getToken).mockResolvedValue('stale-token');

        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' }),
        });
        global.fetch = fetchMock as any;

        await expect(async () => {
            for await (const chunk of streamGeminiResponse('test', '', [], 'test')) { /* noop */ }
        }).rejects.toThrow('Server error');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(refreshToken).not.toHaveBeenCalled();
    });

    it('getGeminiResponse also retries once after a 401 and succeeds (non-streaming parity)', async () => {
        vi.mocked(getToken).mockResolvedValue('stale-token');
        vi.mocked(refreshToken).mockResolvedValue('fresh-token');

        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Invalid or expired token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ text: 'hi there' }),
            });
        global.fetch = fetchMock as any;

        const result = await getGeminiResponse('test', '', [], 'test');

        expect(result).toBe('hi there');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(refreshToken).toHaveBeenCalledTimes(1);
    });
});
