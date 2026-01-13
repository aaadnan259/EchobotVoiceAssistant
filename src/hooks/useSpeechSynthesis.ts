import { useCallback, useRef, useState } from 'react';

interface UseSpeechSynthesisOptions {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: any) => void;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
    const { onStart, onEnd, onError } = options;
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const speak = useCallback((text: string, options?: {
        voiceURI?: string | null;
        rate?: number;
        pitch?: number;
        volume?: number;
    }) => {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Apply options
        if (options?.rate) utterance.rate = options.rate;
        if (options?.pitch) utterance.pitch = options.pitch;
        if (options?.volume) utterance.volume = options.volume;

        const loadAndSpeak = () => {
            const voices = window.speechSynthesis.getVoices();
            const voiceURI = options?.voiceURI;

            if (voiceURI) {
                const selected = voices.find(v => v.voiceURI === voiceURI);
                if (selected) {
                    utterance.voice = selected;
                } else {
                    console.warn('Selected voice not found:', voiceURI);
                }
            }

            utterance.onstart = () => {
                setIsSpeaking(true);
                onStart?.();
            };

            utterance.onend = () => {
                setIsSpeaking(false);
                onEnd?.();
            };

            utterance.onerror = (e) => {
                console.error('Speech synthesis error:', e);
                setIsSpeaking(false);
                onError?.(e);
            };

            window.speechSynthesis.speak(utterance);
        };

        // Handle voice loading (voices may load async in some browsers)
        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                loadAndSpeak();
                window.speechSynthesis.onvoiceschanged = null;
            };
        } else {
            loadAndSpeak();
        }
    }, [onStart, onEnd, onError]);

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, []);

    const getVoices = useCallback(() => {
        return window.speechSynthesis.getVoices();
    }, []);

    return {
        speak,
        stop,
        isSpeaking,
        getVoices
    };
}
