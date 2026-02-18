import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { OrbState, Message, AppSettings } from '../types';
import { playSound, CHAT_MESSAGES } from '../constants';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import {
    useConversationTree,
    useChat,
    useSpeechRecognition,
    useSpeechSynthesis,
    useSecureWebSocket,
    useImageInput,
    useMessageSearch,
    useSettings
} from '../hooks';
import { ExportFormat } from '../utils/exportImport';

const { SUCCESS, ERRORS } = CHAT_MESSAGES;

interface ChatContextType {
    // Conversation
    messages: Message[];
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    clearMessages: () => void;
    exportMessages: () => boolean;
    addReaction: (messageId: string, reactionType: 'thumbsUp' | 'thumbsDown' | 'starred') => void;

    // Branching
    createBranch: (messageId: string) => void;
    navigateUncles: (messageId: string, direction: 'prev' | 'next') => void;
    getSiblingInfo: (messageId: string) => { current: number; total: number; parentId: string | null } | null;

    // Export/Import Data
    exportData: (format: ExportFormat, options: { includeImages: boolean }) => Promise<Blob>;
    importData: (content: string) => Promise<boolean>;

    // Chat State
    orbState: OrbState;
    setOrbState: (state: OrbState) => void;
    isGenerating: boolean;
    stopGeneration: () => void;
    sendMessage: () => void; // Sends current input

    // Input State
    inputValue: string;
    setInputValue: (val: string) => void;
    images: string[];
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDrop: (e: React.DragEvent) => void;
    handlePaste: (e: React.ClipboardEvent) => void;
    removeImage: (index: number) => void;
    clearImages: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;

    // Voice
    isListening: boolean;
    isSpeechSupported: boolean;
    toggleListening: () => void;
    speak: (text: string) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: any[];
    isSearching: boolean;
    clearSearch: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings } = useSettings();

    // --- Conversation Management ---
    const {
        messages,
        addMessage,
        addPlaceholder,
        updateMessage,
        clearMessages,
        exportMessages,
        addReaction,
        createBranch,
        navigateUncles,
        getSiblingInfo,
        exportData,
        importData
    } = useConversationTree();

    // --- Search ---
    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        results: searchResults,
        isSearching,
        clearSearch
    } = useMessageSearch(messages);

    // --- Input State ---
    const [inputValue, setInputValue] = useState('');
    const {
        images,
        handleFileSelect,
        handleDrop,
        handlePaste,
        removeImage,
        clearImages
    } = useImageInput();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Chat Logic ---
    const { isGenerating, orbState, setOrbState, sendMessage: sendToLLM, stopGeneration } = useChat({
        messages,
        addMessage,
        addPlaceholder,
        updateMessage,
        settings
    });

    // --- Audio Refs ---
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- Voice Logic ---
    const { isListening, isSupported: isSpeechSupported, toggleListening } = useSpeechRecognition({
        onResult: (transcript) => setInputValue(transcript),
        onStart: () => setOrbState(OrbState.LISTENING),
        onEnd: () => setOrbState(OrbState.IDLE),
        onError: () => setOrbState(OrbState.IDLE)
    });

    const { speak: synthSpeak } = useSpeechSynthesis({
        onStart: () => setOrbState(OrbState.RESPONDING),
        onEnd: () => setOrbState(OrbState.IDLE),
        onError: () => setOrbState(OrbState.IDLE)
    });

    const speak = useCallback((text: string) => {
        synthSpeak(text, {
            voiceURI: settings.voiceSettings.voiceURI,
            rate: settings.voiceSettings.rate,
            pitch: settings.voiceSettings.pitch,
            volume: settings.voiceSettings.volume
        });
    }, [synthSpeak, settings.voiceSettings]);

    // --- WebSocket ---
    useSecureWebSocket({
        onConnect: () => toast.success(SUCCESS.CONNECTED),
        onMessage: (data) => {
            if (data.type === 'error') {
                toast.error(data.text || 'WebSocket error');
                return;
            }

            if (data.status) {
                const statusMap: Record<string, OrbState> = {
                    'listening': OrbState.LISTENING,
                    'processing': OrbState.THINKING,
                    'speaking': OrbState.RESPONDING,
                    'idle': OrbState.IDLE
                };
                if (statusMap[data.status]) {
                    setOrbState(statusMap[data.status]);
                }
                return;
            }

            if (data.text) {
                addMessage({ role: 'model', text: data.text });
                playSound('receive');
            }

            if (data.audio) {
                setOrbState(OrbState.RESPONDING);
                if (audioRef.current) audioRef.current.pause();
                const audioSrc = 'data:audio/mpeg;base64,' + data.audio;
                const audio = new Audio(audioSrc);
                audioRef.current = audio;
                audio.onended = () => setOrbState(OrbState.IDLE);
                audio.play().catch(e => logger.error('Audio playback failed:', e));
            }
        }
    });

    // --- High-level Handlers ---
    const sendMessage = useCallback(() => {
        sendToLLM(inputValue, images);
        setInputValue('');
        clearImages();
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [inputValue, images, sendToLLM, clearImages]);

    const value = {
        messages,
        addMessage,
        updateMessage,
        clearMessages,
        exportMessages,
        addReaction,
        createBranch,
        navigateUncles,
        getSiblingInfo,
        exportData,
        importData,
        orbState,
        setOrbState,
        isGenerating,
        stopGeneration,
        sendMessage,
        inputValue,
        setInputValue,
        images,
        handleFileSelect,
        handleDrop,
        handlePaste,
        removeImage,
        clearImages,
        fileInputRef,
        isListening,
        isSpeechSupported,
        toggleListening,
        speak,
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        clearSearch
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export function useChatContext() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChatContext must be used within a ChatProvider');
    }
    return context;
}
