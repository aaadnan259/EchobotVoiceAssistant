import React, { useState, useRef, useCallback, useEffect } from 'react';
import { OrbState, Message } from './types';
import { playSound, CHAT_MESSAGES } from './constants';
import {
  useMessages,
  useSettings,
  useSpeechRecognition,
  useSpeechSynthesis,
  useWebSocket,
  useChat,
  useScrollBehavior,
  useAudioAnalyzer,
  useReducedMotion
} from './hooks';
import { announce, ARIA_LABELS, getOrbStatusDescription } from './utils/accessibility';
import { logger } from './utils/logger';

import Orb from './components/Orb';
import SettingsModal from './components/SettingsModal';
import { SmartMessageList } from './components/VirtualizedMessageList';
import { toast, Toaster } from 'sonner';
import {
  AppErrorBoundary,
  ChatErrorBoundary,
  SettingsErrorBoundary,
  OrbErrorBoundary
} from './components/ErrorBoundaries';

const { SUCCESS, ERRORS, CONFIRMATIONS } = CHAT_MESSAGES;

/** Threshold for switching to virtualized rendering */
const VIRTUALIZATION_THRESHOLD = 50;

// =============================================================================
// Sub-Components (could be moved to separate files)
// =============================================================================

interface HeaderProps {
  onSaveChat: () => void;
  onClearChat: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onSaveChat,
  onClearChat,
  onToggleTheme,
  onOpenSettings,
  isDarkMode
}) => (
  <header
    className="flex items-center justify-between px-6 py-4 z-20 backdrop-blur-sm bg-white/50 dark:bg-black/20 border-b border-gray-200/50 dark:border-white/5 sticky top-0"
    role="banner"
  >
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-full shadow-lg shadow-purple-500/40 overflow-hidden transition-transform hover:scale-110"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <radialGradient id="logoGradient" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#d8b4fe" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#logoGradient)" />
          <ellipse cx="30" cy="30" rx="15" ry="8" fill="white" opacity="0.3" transform="rotate(-45 30 30)" />
          <ellipse cx="38" cy="50" rx="5" ry="9" fill="white" />
          <ellipse cx="62" cy="50" rx="5" ry="9" fill="white" />
        </svg>
      </div>
      <h1 className="font-semibold text-lg tracking-tight">EchoBot</h1>
    </div>

    <nav className="flex items-center gap-2" aria-label="Main actions">
      <button
        onClick={onSaveChat}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors border border-white/10"
        aria-label={ARIA_LABELS.SAVE_CHAT}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        <span>Save Chat</span>
      </button>

      <button
        onClick={onClearChat}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors border border-white/10 text-gray-500 hover:text-red-400 dark:text-gray-400"
        aria-label={ARIA_LABELS.CLEAR_CHAT}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span className="hidden md:inline">Clear</span>
      </button>

      <button
        onClick={onToggleTheme}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-pressed={isDarkMode}
      >
        {isDarkMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        )}
      </button>

      <button
        onClick={onOpenSettings}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        aria-label={ARIA_LABELS.OPEN_SETTINGS}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
    </nav>
  </header>
);

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMicClick: () => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStopGeneration: () => void;
  onClearImage: () => void;
  selectedImage: string | null;
  isGenerating: boolean;
  isListening: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  onInputChange,
  onSend,
  onMicClick,
  onImageSelect,
  onStopGeneration,
  onClearImage,
  selectedImage,
  isGenerating,
  isListening,
  fileInputRef
}) => (
  <footer
    className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0B0D18] dark:via-[#0B0D18] dark:to-transparent z-20 flex justify-center flex-col items-center"
    role="contentinfo"
  >
    {/* Image Preview */}
    {selectedImage && (
      <div className="w-full max-w-2xl mb-2 flex justify-start animate-[fadeIn_0.2s]">
        <div className="relative group">
          <img
            src={selectedImage}
            alt="Attached image preview"
            className="h-16 w-16 object-cover rounded-xl border border-purple-500 shadow-lg"
          />
          <button
            onClick={onClearImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:scale-110 transition-transform"
            aria-label={ARIA_LABELS.REMOVE_IMAGE}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    )}

    <form
      className="w-full max-w-2xl bg-gray-100/80 dark:bg-[#1A1D2D]/80 backdrop-blur-md border border-white/20 dark:border-white/10 p-2 rounded-[2rem] shadow-xl flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-purple-500/30 ring-offset-2 dark:ring-offset-[#0B0D18]"
      onSubmit={(e) => { e.preventDefault(); if (!isGenerating) onSend(); }}
      role="search"
      aria-label="Chat message input"
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={onImageSelect}
        className="hidden"
        aria-label={ARIA_LABELS.ATTACH_IMAGE}
      />

      {/* Attachment Button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-3 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
        aria-label={ARIA_LABELS.ATTACH_IMAGE}
        disabled={isGenerating}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
      </button>

      {/* Text Input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={isListening ? "Listening..." : "Type a message..."}
        disabled={isGenerating}
        className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-400/70 text-base px-2 h-10 min-w-0"
        aria-label={ARIA_LABELS.MESSAGE_INPUT}
        aria-describedby={isListening ? "listening-status" : undefined}
      />
      {isListening && (
        <span id="listening-status" className="sr-only">Voice input is active</span>
      )}

      <div className="flex items-center gap-1 pr-1">
        {/* Mic Button */}
        <button
          type="button"
          onClick={onMicClick}
          disabled={isGenerating}
          className={`p-2.5 rounded-full transition-all duration-300 flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-white/10'}`}
          aria-label={isListening ? ARIA_LABELS.STOP_VOICE_INPUT : ARIA_LABELS.VOICE_INPUT}
          aria-pressed={isListening}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>

        {/* Send / Stop Button */}
        {isGenerating ? (
          <button
            type="button"
            onClick={onStopGeneration}
            className="p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
            aria-label={ARIA_LABELS.STOP_GENERATION}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!inputValue.trim() && !selectedImage}
            className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-all shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
            aria-label={ARIA_LABELS.SEND_MESSAGE}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        )}
      </div>
    </form>
  </footer>
);

// =============================================================================
// Main App Component
// =============================================================================

const App: React.FC = () => {
  // --- Custom Hooks ---
  const { messages, addMessage, addPlaceholder, updateMessage, clearMessages, exportMessages } = useMessages();
  const { settings, setSettings, toggleTheme, isDarkMode } = useSettings();

  const { containerRef, bottomRef, scrollProgress } = useScrollBehavior({
    scrollTriggers: [messages]
  });

  // --- Local State ---
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Chat Hook ---
  const { isGenerating, orbState, setOrbState, sendMessage, stopGeneration } = useChat({
    messages,
    addMessage,
    addPlaceholder,
    updateMessage,
    settings
  });

  // --- Audio Analyzer ---
  const audioLevel = useAudioAnalyzer(
    orbState === OrbState.LISTENING,
    orbState === OrbState.RESPONDING
  );

  // --- Speech Recognition ---
  const { isListening, isSupported: isSpeechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => setInputValue(transcript),
    onStart: () => setOrbState(OrbState.LISTENING),
    onEnd: () => setOrbState(OrbState.IDLE),
    onError: () => setOrbState(OrbState.IDLE)
  });

  // --- Speech Synthesis ---
  const { speak } = useSpeechSynthesis({
    onStart: () => setOrbState(OrbState.RESPONDING),
    onEnd: () => setOrbState(OrbState.IDLE),
    onError: () => setOrbState(OrbState.IDLE)
  });

  // --- WebSocket ---
  useWebSocket({
    onConnect: () => toast.success(SUCCESS.CONNECTED),
    onMessage: (data) => {
      if (data.type === 'error') {
        toast.error(data.text || 'WebSocket error');
        return;
      }

      // Handle status updates
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

      // Handle incoming text/audio from backend
      if (data.text) {
        addMessage({ role: 'model', text: data.text });
        playSound('receive');
      }

      if (data.audio) {
        setOrbState(OrbState.RESPONDING);
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audioRef.current = audio;
        audio.onended = () => setOrbState(OrbState.IDLE);
        audio.play().catch(e => logger.error('Audio playback failed:', e));
      }
    }
  });

  // --- Handlers ---
  const handleSend = useCallback(() => {
    sendMessage(inputValue, selectedImage || undefined);
    setInputValue('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [inputValue, selectedImage, sendMessage]);

  const handleMicClick = useCallback(() => {
    if (!isSpeechSupported) {
      alert(ERRORS.VOICE_NOT_SUPPORTED);
      return;
    }
    toggleListening();
  }, [isSpeechSupported, toggleListening]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleClearImage = useCallback(() => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClearChat = useCallback(() => {
    if (window.confirm(CONFIRMATIONS.CLEAR_CHAT)) {
      clearMessages();
      setOrbState(OrbState.IDLE);
    }
  }, [clearMessages, setOrbState]);

  const handleSaveChat = useCallback(() => {
    if (exportMessages()) {
      toast.success(SUCCESS.CHAT_SAVED);
    } else {
      toast.error('Failed to save chat');
    }
  }, [exportMessages]);

  const handleSpeak = useCallback((text: string) => {
    speak(text, settings.voiceURI);
  }, [speak, settings.voiceURI]);

  // --- Accessibility: Announce orb state changes ---
  useEffect(() => {
    const stateDescriptions: Record<OrbState, string> = {
      [OrbState.IDLE]: '',
      [OrbState.LISTENING]: 'Listening for voice input',
      [OrbState.THINKING]: 'Processing your message',
      [OrbState.RESPONDING]: 'EchoBot is responding',
      [OrbState.ERROR]: 'An error occurred',
    };

    const description = stateDescriptions[orbState];
    if (description) {
      announce(description, orbState === OrbState.ERROR ? 'assertive' : 'polite');
    }
  }, [orbState]);

  // --- Reduced motion preference ---
  const prefersReducedMotion = useReducedMotion();

  // --- Render ---
  return (
    <div className="relative flex flex-col h-screen bg-gray-50 dark:bg-[#0B0D18] transition-colors duration-300 text-gray-900 dark:text-white overflow-hidden">
      <Toaster position="top-center" />

      {/* Skip to main content link for keyboard users */}
      <a
        href="#chat-messages"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg"
      >
        Skip to chat
      </a>

      {/* ARIA live region for announcements */}
      <div
        id="aria-live-region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0B0D18] to-[#000000]" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" aria-hidden="true" />

      {/* Header */}
      <Header
        onSaveChat={handleSaveChat}
        onClearChat={handleClearChat}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
      />

      {/* Main Chat Area */}
      <main
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center pt-8 pb-40 md:pb-48 px-4 z-10"
        role="main"
        aria-label="Chat conversation"
      >
        <div
          className="sticky top-0 z-0 w-full flex justify-center h-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className={`absolute top-0 transform -translate-y-4 ${prefersReducedMotion ? 'motion-reduce' : ''}`}>
            <OrbErrorBoundary>
              <Orb state={orbState} scrollProgress={scrollProgress} audioLevel={audioLevel} />
            </OrbErrorBoundary>
          </div>
        </div>

        {/* Orb status for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          {getOrbStatusDescription(orbState)}
        </div>

        <div className="h-[200px] w-full shrink-0" aria-hidden="true" />

        <div
          id="chat-messages"
          className={`w-full max-w-2xl flex flex-col ${messages.length >= VIRTUALIZATION_THRESHOLD ? 'h-[calc(100vh-400px)]' : ''}`}
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <ChatErrorBoundary>
            <SmartMessageList
              messages={messages}
              onSpeak={handleSpeak}
              virtualizationThreshold={VIRTUALIZATION_THRESHOLD}
              autoScrollToBottom={true}
            />
          </ChatErrorBoundary>
          {messages.length < VIRTUALIZATION_THRESHOLD && <div ref={bottomRef} />}
        </div>
      </main>

      {/* Input */}
      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSend}
        onMicClick={handleMicClick}
        onImageSelect={handleImageSelect}
        onStopGeneration={stopGeneration}
        onClearImage={handleClearImage}
        selectedImage={selectedImage}
        isGenerating={isGenerating}
        isListening={isListening}
        fileInputRef={fileInputRef}
      />

      {/* Settings Modal */}
      <SettingsErrorBoundary onClose={() => setIsSettingsOpen(false)}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={setSettings}
        />
      </SettingsErrorBoundary>
    </div>
  );
};

// Wrap the entire app with AppErrorBoundary
const AppWithErrorBoundary: React.FC = () => (
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

export default AppWithErrorBoundary;