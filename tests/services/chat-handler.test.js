// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatHandler } from '../../src/services/chat-handler';

// Mock global fetch
global.fetch = vi.fn();

describe('ChatHandler', () => {
    let chatHandler;

    beforeEach(() => {
        // Reset fetch mock before each test
        vi.resetAllMocks();

        // Create a new instance for each test
        chatHandler = new ChatHandler();

        // Use fake timers to control delays
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('sendMessage', () => {
        it('should send message successfully on first attempt', async () => {
            const mockResponse = {
                response: 'Hello from AI',
                timestamp: Date.now()
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await chatHandler.sendMessage('Hello');

            expect(result).toEqual({
                success: true,
                response: mockResponse.response,
                timestamp: mockResponse.timestamp
            });

            expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    message: 'Hello',
                    conversationHistory: []
                })
            }));
        });

        it('should include conversation history in request', async () => {
            const history = [{ role: 'user', content: 'Hi' }];
            const mockResponse = { response: 'Hello again', timestamp: Date.now() };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            await chatHandler.sendMessage('Hello', history);

            expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
                body: JSON.stringify({
                    message: 'Hello',
                    conversationHistory: history
                })
            }));
        });

        it('should retry on failure and succeed eventually', async () => {
            // First attempt fails
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            // Second attempt succeeds
            const mockResponse = { response: 'Success after retry', timestamp: 123 };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const promise = chatHandler.sendMessage('Hello');

            // Fast-forward time for retry delay
            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.response).toBe('Success after retry');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should succeed on the final retry attempt', async () => {
            // First two attempts fail
            global.fetch.mockRejectedValueOnce(new Error('Network error 1'))
                .mockRejectedValueOnce(new Error('Network error 2'));

            // Third attempt succeeds
            const mockResponse = { response: 'Success on final try', timestamp: 456 };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const promise = chatHandler.sendMessage('Hello');

            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.response).toBe('Success on final try');
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should wait with increasing delay between retries', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const promise = chatHandler.sendMessage('Hello');

            // Initially called once
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Advance time by 999ms (less than first delay of 1000ms)
            await vi.advanceTimersByTimeAsync(999);
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Advance time to 1000ms
            await vi.advanceTimersByTimeAsync(1);
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Advance time by 1999ms (less than second delay of 2000ms)
            await vi.advanceTimersByTimeAsync(1999);
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Advance time to 2000ms
            await vi.advanceTimersByTimeAsync(1);
            expect(global.fetch).toHaveBeenCalledTimes(3);

            // Resolve the remaining promise
            await vi.runAllTimersAsync();
            const result = await promise;
            expect(result.success).toBe(false);
        });

        it('should fail after max retry attempts', async () => {
            // All attempts fail
            global.fetch.mockRejectedValue(new Error('Network error'));

            const promise = chatHandler.sendMessage('Hello');

            // Fast-forward time for all retries
            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            // 3 attempts by default
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should handle HTTP error status', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal Server Error' })
            });

            const promise = chatHandler.sendMessage('Hello');
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('getUserFriendlyError', () => {
        it('should return network error message', () => {
            const error = new Error('Failed to fetch');
            expect(chatHandler.getUserFriendlyError(error)).toContain('Network connection issue');
        });

        it('should return timeout error message', () => {
            const error = new Error('The operation was aborted due to timeout'); // specific message might vary but contains 'timeout'
            // Mocking error message to include 'timeout' as per implementation
            const timeoutError = new Error('Request timeout');
            expect(chatHandler.getUserFriendlyError(timeoutError)).toContain('Request took too long');
        });

        it('should return generic error message for unknown errors', () => {
            const error = new Error('Unknown error');
            expect(chatHandler.getUserFriendlyError(error)).toContain('Something went wrong');
        });
    });

    describe('checkHealth', () => {
        it('should return true when API returns healthy', async () => {
            global.fetch.mockResolvedValueOnce({
                json: async () => ({ status: 'healthy' })
            });

            const isHealthy = await chatHandler.checkHealth();
            expect(isHealthy).toBe(true);
        });

        it('should return false when API returns unhealthy', async () => {
            global.fetch.mockResolvedValueOnce({
                json: async () => ({ status: 'unhealthy' })
            });

            const isHealthy = await chatHandler.checkHealth();
            expect(isHealthy).toBe(false);
        });

        it('should return false when fetch fails', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const isHealthy = await chatHandler.checkHealth();
            expect(isHealthy).toBe(false);
        });
    });
});
