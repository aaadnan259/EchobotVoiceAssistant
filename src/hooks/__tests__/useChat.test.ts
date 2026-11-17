/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';
import { streamGeminiResponse } from '../../services/geminiService';
import { CHAT_MESSAGES } from '../../constants';
import { OrbState } from '../../types';

const { ERRORS } = CHAT_MESSAGES;

vi.mock('../../services/geminiService', () => ({
    streamGeminiResponse: vi.fn(),
}));

describe('useChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // F4: the backend now sends one of exactly four safe category codes
    // (never raw exception text) in the streamed error event -- see
    // _categorize_llm_error in web/backend/app.py and the
    // ERROR_CODE_MESSAGES lookup in useChat.ts. Each code must map to the
    // exact same user-facing ERRORS.* message as before, via exact string
    // matching rather than substring parsing, and an unrecognized code must
    // still fall back to ERRORS.GENERIC.
    it.each([
        ['rate_limit', 'ERRORS.RATE_LIMIT', ERRORS.RATE_LIMIT],
        ['safety', 'ERRORS.SAFETY', ERRORS.SAFETY],
        ['no_api_key', 'ERRORS.NO_API_KEY', ERRORS.NO_API_KEY],
        ['some_unrecognized_code', 'ERRORS.GENERIC', ERRORS.GENERIC],
    ])('error code %s maps to %s, replaces placeholder, and resets isGenerating', async (errorCode, _label, expectedMessage) => {
        const mockStream = async function* () {
            throw new Error(errorCode);
        };
        (streamGeminiResponse as any).mockImplementation(mockStream);

        let updateId = '';
        let updateData: any = {};
        const updateMessage = vi.fn((id, updates) => {
            updateId = id;
            updateData = updates;
        });

        const { result } = renderHook(() => useChat({
            messages: [],
            addMessage: vi.fn(),
            addPlaceholder: vi.fn(() => 'placeholder-id'),
            updateMessage,
            settings: { model: 'test', systemPrompt: '' } as any
        }));

        await act(async () => {
            await result.current.sendMessage('Hello');
        });

        expect(result.current.isGenerating).toBe(false);
        expect(updateId).toBe('placeholder-id');
        expect(updateData.text).toContain(expectedMessage);
        // flagged so the reply avatar can show EchoBot's sad face
        expect(updateData.isError).toBe(true);
    });

    it('sets isGenerating to true during stream and resets to false on success', async () => {
        const mockStream = async function* () {
            yield 'Hello';
            yield ' World';
        };
        (streamGeminiResponse as any).mockImplementation(mockStream);

        const { result } = renderHook(() => useChat({
            messages: [],
            addMessage: vi.fn(),
            addPlaceholder: vi.fn(() => 'placeholder-id'),
            updateMessage: vi.fn(),
            settings: { model: 'test', systemPrompt: '' } as any
        }));

        let promise: Promise<void>;
        act(() => {
            promise = result.current.sendMessage('Hi');
        });

        expect(result.current.isGenerating).toBe(true);

        await act(async () => {
            await promise;
        });

        expect(result.current.isGenerating).toBe(false);
    });

    describe('tool events', () => {
        const setup = (updateMessage = vi.fn()) => renderHook(() => useChat({
            messages: [],
            addMessage: vi.fn(),
            addPlaceholder: vi.fn(() => 'placeholder-id'),
            updateMessage,
            settings: { model: 'test', systemPrompt: '' } as any
        }));

        it('records tool calls on the bot message as running, then ok/failed', async () => {
            (streamGeminiResponse as any).mockImplementation(async function* (...args: any[]) {
                const onToolEvent = args[5];
                onToolEvent({ type: 'tool_call', id: 'a', name: 'get_weather' });
                onToolEvent({ type: 'tool_call', id: 'b', name: 'lookup' });
                onToolEvent({ type: 'tool_result', id: 'a', name: 'get_weather', ok: true, summary: '12C' });
                onToolEvent({ type: 'tool_result', id: 'b', name: 'lookup', ok: false, summary: 'nope' });
                yield 'Done';
            });
            const updateMessage = vi.fn();
            const { result } = setup(updateMessage);

            await act(async () => { await result.current.sendMessage('Hi'); });

            const withTools = updateMessage.mock.calls.filter(([, u]) => u.toolCalls);
            expect(withTools[0][1].toolCalls).toEqual([
                { id: 'a', name: 'get_weather', status: 'running' },
            ]);
            expect(withTools[withTools.length - 1][1].toolCalls).toEqual([
                { id: 'a', name: 'get_weather', status: 'ok', summary: '12C' },
                { id: 'b', name: 'lookup', status: 'failed', summary: 'nope' },
            ]);
            expect(updateMessage).toHaveBeenCalledWith('placeholder-id', { text: 'Done' });
        });

        it('never writes toolCalls when no tool events arrive', async () => {
            (streamGeminiResponse as any).mockImplementation(async function* () {
                yield 'Hello';
            });
            const updateMessage = vi.fn();
            const { result } = setup(updateMessage);

            await act(async () => { await result.current.sendMessage('Hi'); });

            expect(updateMessage.mock.calls.every(([, u]) => !('toolCalls' in u))).toBe(true);
        });
    });
});
