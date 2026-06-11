import { describe, it, expect, vi } from 'vitest';
import { streamGeminiResponse } from '../geminiService';

vi.mock('../../utils/wsAuth', () => ({
    getAuthToken: vi.fn(() => Promise.resolve('mock-token')),
    getStoredToken: vi.fn(() => 'mock-token'),
}));

describe('geminiService', () => {
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
});
