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

    it('error replaces placeholder with mapped ERRORS constant and resets isGenerating', async () => {
        const mockStream = async function* () {
            throw new Error('API Rate Limit Exceeded');
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
        expect(updateData.text).toContain(ERRORS.RATE_LIMIT);
    });
});
