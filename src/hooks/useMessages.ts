import { useState, useEffect, useCallback } from 'react';
import { Message } from '../types';
import { INITIAL_GREETING } from '../constants';

const STORAGE_KEY = 'echoBotMessages_v3';

const createInitialMessage = (): Message => ({
    id: '1',
    role: 'model',
    text: INITIAL_GREETING,
    timestamp: Date.now()
});

export function useMessages() {
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [createInitialMessage()];
        } catch {
            return [createInitialMessage()];
        }
    });

    // Persist messages to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch (e) {
            console.warn('Failed to persist messages:', e);
        }
    }, [messages]);

    // Add a new message
    const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
            ...message,
            id: Date.now().toString(),
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        return newMessage.id;
    }, []);

    // Add a placeholder message (for streaming responses)
    const addPlaceholder = useCallback((role: 'user' | 'model'): string => {
        const id = Date.now().toString();
        const placeholder: Message = {
            id,
            role,
            text: '',
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, placeholder]);
        return id;
    }, []);

    // Update a message by ID
    const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
        ));
    }, []);

    // Append text to a message (for streaming)
    const appendToMessage = useCallback((id: string, text: string, groundingMetadata?: any) => {
        setMessages(prev => prev.map(msg =>
            msg.id === id
                ? {
                    ...msg,
                    text: msg.text + text,
                    groundingMetadata: groundingMetadata || msg.groundingMetadata
                }
                : msg
        ));
    }, []);

    // Clear all messages and reset to initial greeting
    const clearMessages = useCallback(() => {
        setMessages([{
            id: Date.now().toString(),
            role: 'model',
            text: INITIAL_GREETING,
            timestamp: Date.now()
        }]);
    }, []);

    // Export messages as JSON
    const exportMessages = useCallback(() => {
        try {
            const data = JSON.stringify(messages, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `echobot_history_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            console.error('Export failed:', e);
            return false;
        }
    }, [messages]);

    return {
        messages,
        addMessage,
        addPlaceholder,
        updateMessage,
        appendToMessage,
        clearMessages,
        exportMessages,
        setMessages // Escape hatch for complex updates
    };
}
