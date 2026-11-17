import { useState, useRef, useCallback } from 'react';
import { Message, OrbState, AppSettings, ToolCallInfo, ToolStreamEvent } from '../types';
import { playSound, CHAT_MESSAGES, UI_CONFIG } from '../constants';
import { streamGeminiResponse } from '../services/geminiService';
import { logger } from '../utils/logger';

const { ERRORS } = CHAT_MESSAGES;
const { ERROR_DISPLAY_DURATION } = UI_CONFIG;

// F4: the backend now sends one of exactly these four safe category codes
// (never raw exception text) in the streamed error event -- see
// _categorize_llm_error in web/backend/app.py. Matched by exact equality,
// not substring parsing, so an unrecognized code always falls back to
// ERRORS.GENERIC rather than accidentally matching something unintended.
const ERROR_CODE_MESSAGES: Record<string, string> = {
    rate_limit: ERRORS.RATE_LIMIT,
    safety: ERRORS.SAFETY,
    no_api_key: ERRORS.NO_API_KEY,
};

interface UseChatOptions {
    messages: Message[];
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    addPlaceholder: (role: 'user' | 'model') => string;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    settings: AppSettings;
    onStateChange?: (state: OrbState) => void;
}

export function useChat({
    messages,
    addMessage,
    addPlaceholder,
    updateMessage,
    settings,
    onStateChange
}: UseChatOptions) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [orbState, setOrbState] = useState<OrbState>(OrbState.IDLE);
    const stopGenerationRef = useRef(false);
    
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const updateOrbState = useCallback((state: OrbState) => {
        setOrbState(state);
        onStateChange?.(state);
    }, [onStateChange]);

    const sendMessage = useCallback(async (
        text: string,
        images?: string[]
    ) => {
        if (!text.trim() && (!images || images.length === 0)) return;

        const userText = text.trim();

        // Add user message
        addMessage({
            role: 'user',
            text: userText,
            images,
            image: images?.[0] // Backward compat
        });
        playSound('SEND');

        // Set up for response
        updateOrbState(OrbState.THINKING);
        setIsGenerating(true);
        stopGenerationRef.current = false;

        // Create placeholder for bot response
        const botMsgId = addPlaceholder('model');

        // Stays empty (and is never written to the message) unless the backend
        // sends tool events, so replies are unchanged when tools are off.
        let toolCalls: ToolCallInfo[] = [];
        const onToolEvent = (event: ToolStreamEvent) => {
            if (event.type === 'tool_call') {
                if (toolCalls.some(t => t.id === event.id)) return;
                toolCalls = [...toolCalls, { id: event.id, name: event.name, status: 'running' }];
            } else {
                const status = event.ok ? 'ok' : 'failed';
                toolCalls = toolCalls.some(t => t.id === event.id)
                    ? toolCalls.map(t => t.id === event.id ? { ...t, status, summary: event.summary } : t)
                    : [...toolCalls, { id: event.id, name: event.name, status, summary: event.summary }];
            }
            updateMessage(botMsgId, { toolCalls });
        };

        try {
            const stream = await streamGeminiResponse(
                settings.model,
                settings.systemPrompt,
                messagesRef.current,
                userText,
                images,
                onToolEvent
            );

            updateOrbState(OrbState.RESPONDING);
            playSound('RECEIVE');

            let fullText = '';
            let groundingMetadata: any = undefined;

            for await (const chunk of stream) {
                if (stopGenerationRef.current) break;

                const chunkText = typeof chunk === 'string' ? chunk : ((chunk as any)?.text || '');
                fullText += chunkText;

                // Grounding metadata would be processed here if provided by backend

                updateMessage(botMsgId, {
                    text: fullText
                });
            }

            // A stopped stream can leave calls without a result; don't show them as running forever.
            if (toolCalls.some(t => t.status === 'running')) {
                toolCalls = toolCalls.map(t => t.status === 'running' ? { ...t, status: 'failed' as const } : t);
                updateMessage(botMsgId, { toolCalls });
            }

            updateOrbState(OrbState.IDLE);

        } catch (error: any) {
            logger.error('Chat error:', error);

            if (!stopGenerationRef.current) {
                updateOrbState(OrbState.ERROR);
                playSound('ERROR');

                const errorMessage = ERROR_CODE_MESSAGES[error.message] ?? ERRORS.GENERIC;

                updateMessage(botMsgId, { text: errorMessage, isError: true });

                setTimeout(() => updateOrbState(OrbState.IDLE), ERROR_DISPLAY_DURATION);
            } else {
                updateOrbState(OrbState.IDLE);
            }
        } finally {
            setIsGenerating(false);
        }
    }, [settings, addMessage, addPlaceholder, updateMessage, updateOrbState]);

    const stopGeneration = useCallback(() => {
        stopGenerationRef.current = true;
        setIsGenerating(false);
        updateOrbState(OrbState.IDLE);
    }, [updateOrbState]);

    return {
        isGenerating,
        orbState,
        setOrbState: updateOrbState,
        sendMessage,
        stopGeneration
    };
}
