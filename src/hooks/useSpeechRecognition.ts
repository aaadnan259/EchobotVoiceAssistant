import { useEffect, useRef, useCallback, useState } from 'react';
import { SPEECH_CONFIG } from '../constants';
import { logger } from '../utils/logger';

const {
    RECOGNITION_LANG,
    CONTINUOUS_RECOGNITION,
    INTERIM_RESULTS
} = SPEECH_CONFIG;

interface UseSpeechRecognitionOptions {
    onResult?: (transcript: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
    const {
        onResult,
        onStart,
        onEnd,
        onError,
        continuous = CONTINUOUS_RECOGNITION,
        interimResults = INTERIM_RESULTS,
        lang = RECOGNITION_LANG
    } = options;

    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onstart = () => {
            setIsListening(true);
            onStart?.();
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onResult?.(transcript);
        };

        recognition.onerror = (event: any) => {
            logger.error('Speech recognition error:', event.error);
            setIsListening(false);
            onError?.(event.error);
        };

        recognition.onend = () => {
            setIsListening(false);
            onEnd?.();
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [continuous, interimResults, lang, onResult, onStart, onEnd, onError]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            logger.warn('Speech recognition not supported');
            return false;
        }

        try {
            recognitionRef.current.start();
            return true;
        } catch (e) {
            logger.error('Failed to start speech recognition:', e);
            return false;
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    return {
        isListening,
        isSupported,
        startListening,
        stopListening,
        toggleListening
    };
}
