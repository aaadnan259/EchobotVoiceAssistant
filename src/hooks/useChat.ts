import { useState, useRef, useCallback } from 'react';
import { Message, OrbState, AppSettings } from '../types';
import { playSound, CHAT_MESSAGES, UI_CONFIG } from '../constants';
import { streamGeminiResponse } from '../services/geminiService';
import { logger } from '../utils/logger';

const { ERRORS } = CHAT_MESSAGES;
const { ERROR_DISPLAY_DURATION } = UI_CONFIG;

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

    const updateOrbState = useCallback((state: OrbState) => {
        setOrbState(state);
        onStateChange?.(state);
    }, [onStateChange]);

    const sendMessage = useCallback(async (
        text: string,
        image?: string
    ) => {
        if (!text.trim() && !image) return;

        const userText = text.trim();

        // Add user message
        addMessage({
            role: 'user',
            text: userText,
            image
        });
        playSound('send');

        // Set up for response
        updateOrbState(OrbState.THINKING);
        setIsGenerating(true);
        stopGenerationRef.current = false;

        // Create placeholder for bot response
        const botMsgId = addPlaceholder('model');

        try {
            const stream = await streamGeminiResponse(
                settings.model,
                settings.systemPrompt,
                messages,
                userText,
                image
            );

            updateOrbState(OrbState.RESPONDING);
            playSound('receive');

            let fullText = '';
            let groundingMetadata: any = undefined;

            for await (const chunk of stream) {
                if (stopGenerationRef.current) break;

                const chunkText = chunk.text || '';
                fullText += chunkText;

                // Extract grounding metadata if present
                if (chunk.candidates?.[0]?.groundingMetadata) {
                    groundingMetadata = chunk.candidates[0].groundingMetadata;
                }

                updateMessage(botMsgId, {
                    text: fullText,
                    groundingMetadata: groundingMetadata
                });
            }

            updateOrbState(OrbState.IDLE);

        } catch (error: any) {
            logger.error('Chat error:', error);

            if (!stopGenerationRef.current) {
                updateOrbState(OrbState.ERROR);
                playSound('error');

                const errorMessage = error.message
                    ? `Error: ${error.message}`
                    : ERRORS.GENERIC;

                updateMessage(botMsgId, { text: errorMessage });

                setTimeout(() => updateOrbState(OrbState.IDLE), ERROR_DISPLAY_DURATION);
            } else {
                updateOrbState(OrbState.IDLE);
            }
        } finally {
            setIsGenerating(false);
        }
    }, [messages, settings, addMessage, addPlaceholder, updateMessage, updateOrbState]);

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
