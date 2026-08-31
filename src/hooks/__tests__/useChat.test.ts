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
});
