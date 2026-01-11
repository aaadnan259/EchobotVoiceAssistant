import { useState, useEffect, useCallback } from 'react';
import { Message } from '../types';
import { INITIAL_GREETING } from '../constants';
import { sanitizeMessage, sanitizeImageDataUri, sanitizeForStorage } from '../utils/sanitize';

const STORAGE_KEY = 'echoBotMessages_v3';
const MAX_MESSAGES = 500; // Prevent localStorage overflow
const MAX_MESSAGE_LENGTH = 50000; // ~50KB per message

const createInitialMessage = (): Message => ({
    id: '1',
    role: 'model',
    text: INITIAL_GREETING,
    timestamp: Date.now()
});

/**
 * Sanitize a message before storing/displaying
 */
function sanitizeMessageData(message: Partial<Message>): Partial<Message> {
    const sanitized: Partial<Message> = { ...message };

    // Truncate if too long
    if (sanitized.text && sanitized.text.length > MAX_MESSAGE_LENGTH) {
        sanitized.text = sanitized.text.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated]';
    }

    // Validate and sanitize image data
    if (sanitized.image) {
        const sanitizedImage = sanitizeImageDataUri(sanitized.image);
        if (!sanitizedImage) {
            delete sanitized.image; // Remove invalid image
        } else {
            sanitized.image = sanitizedImage;
        }
    }

    return sanitized;
}

/**
 * Load messages from localStorage with validation
 */
function loadMessages(): Message[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [createInitialMessage()];

        const parsed = JSON.parse(saved);

        // Validate it's an array
        if (!Array.isArray(parsed)) {
            console.warn('Invalid messages format in localStorage');
            return [createInitialMessage()];
        }

        // Validate each message
        const validMessages = parsed
            .filter((msg: any) =>
                msg &&
                typeof msg.id === 'string' &&
                typeof msg.text === 'string' &&
                (msg.role === 'user' || msg.role === 'model')
            )
            .slice(-MAX_MESSAGES);

        return validMessages.length > 0 ? validMessages : [createInitialMessage()];
    } catch (e) {
        console.error('Failed to load messages:', e);
        return [createInitialMessage()];
    }
}

/**
 * Save messages to localStorage with size checking
 */
function saveMessages(messages: Message[]): boolean {
    try {
        const trimmedMessages = messages.slice(-MAX_MESSAGES);
        const sanitized = sanitizeForStorage(trimmedMessages);

        if (!sanitized) {
            // Try saving without images as fallback
            const withoutImages = trimmedMessages.map(m => ({ ...m, image: undefined }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutImages));
            return true;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        return true;
    } catch (e) {
        console.error('Failed to save messages:', e);

        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            const reduced = messages.slice(-Math.floor(messages.length / 2));
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
                return true;
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        return false;
    }
}

export function useMessages() {
    const [messages, setMessages] = useState<Message[]>(loadMessages);

    // Persist messages to localStorage
    useEffect(() => {
        saveMessages(messages);
    }, [messages]);

    // Add a new message
    const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
        const sanitized = sanitizeMessageData(message);
        const newMessage: Message = {
            ...sanitized,
            id: Date.now().toString(),
            timestamp: Date.now(),
            role: message.role,
            text: message.text
        } as Message;

        setMessages(prev => [...prev, newMessage].slice(-MAX_MESSAGES));
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
        const sanitized = sanitizeMessageData(updates);
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...sanitized } : msg
        ));
    }, []);

    // Append text to a message (for streaming)
    const appendToMessage = useCallback((id: string, text: string, groundingMetadata?: any) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id !== id) return msg;

            const newText = msg.text + text;
            const truncatedText = newText.length > MAX_MESSAGE_LENGTH
                ? newText.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated]'
                : newText;

            return {
                ...msg,
                text: truncatedText,
                groundingMetadata: groundingMetadata || msg.groundingMetadata
            };
        }));
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

    // Get sanitized message text for display
    const getSanitizedText = useCallback((messageId: string): string => {
        const message = messages.find(m => m.id === messageId);
        return message ? sanitizeMessage(message.text) : '';
    }, [messages]);

    return {
        messages,
        addMessage,
        addPlaceholder,
        updateMessage,
        appendToMessage,
        clearMessages,
        exportMessages,
        getSanitizedText,
        setMessages
    };
}
