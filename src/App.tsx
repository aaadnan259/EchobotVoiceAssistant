import React, { useState, useRef, useCallback, useEffect } from 'react';
import { OrbState, Message } from './types';
import { playSound, CHAT_MESSAGES } from './constants';
import {
  useMessages,
  useSettings,
  useSpeechRecognition,
  useSpeechSynthesis,
  useSecureWebSocket,
  useChat,
  useScrollBehavior,
  useAudioAnalyzer,
  useReducedMotion,
  useOnlineStatus,
  useMessageSearch
} from './hooks';
import { announce, ARIA_LABELS, getOrbStatusDescription } from './utils/accessibility';
import { logger } from './utils/logger';

import { toast, Toaster } from 'sonner';
import {
  WelcomeScreen,
  TopBar,
  InputArea,
  SmartMessageList,
  OrbCanvas,
  ErrorBoundary, // Assuming this is a generic ErrorBoundary, not the specific ones
  KeyboardShortcuts,
  SearchBar,
  SearchResults,
  Orb, // Orb is still needed
  SettingsModal // SettingsModal is still needed
} from './components';
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

// HeaderProps and Header component are removed as per the diff, replaced by TopBar
// ChatInputProps and ChatInput component are removed as per the diff, replaced by InputArea

// =============================================================================
// Main App Component
// =============================================================================

const App: React.FC = () => {
  // --- Custom Hooks ---
  const { messages, addMessage, addPlaceholder, updateMessage, clearMessages, exportMessages, addReaction } = useMessages();
  const { settings, setSettings, toggleTheme, isDarkMode } = useSettings();

  const { containerRef, bottomRef, scrollProgress } = useScrollBehavior({
    scrollTriggers: [messages]
  });

  const isOnline = useOnlineStatus();

  // Search Logic
  const {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch
  } = useMessageSearch(messages);

  // --- Local State ---
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // New ref for auto-scrolling

  const hasMessages = messages.length > 0; // New state for WelcomeScreen

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

  // --- WebSocket (Secure) ---
  useSecureWebSocket({
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

  const handleReset = useCallback(() => {
    clearMessages();
    setOrbState(OrbState.IDLE);
    setInputValue('');
    setSelectedImage(null);
    clearSearch();
    toast.success(SUCCESS.CHAT_RESET);
  }, [clearMessages, setOrbState, clearSearch]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
  }, []);

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
        href="#main-content"
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

      {/* Header (now TopBar) */}
      <TopBar
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        onReset={handleReset}
        onSaveChat={handleSaveChat}
        onClearChat={handleClearChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="w-full bg-yellow-500/90 text-black text-center py-1 px-4 text-sm font-medium sticky top-[64px] z-10 backdrop-blur-sm animate-in slide-in-from-top-2">
          You are currently offline. Messages will be sent when you reconnect.
        </div>
      )}

      {/* Search Bar Integration */}
      <div className="sticky top-[60px] z-20 px-4 py-2 bg-white/80 dark:bg-[#0B0D18]/80 backdrop-blur-md border-b border-white/10">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onClear={clearSearch}
          resultCount={results.length}
        />
      </div>

      {/* Main Chat Area */}
      <main
        ref={containerRef}
        id="main-content"
        className="flex-1 relative overflow-y-auto scroll-smooth custom-scrollbar"
        role="main"
        aria-label="Chat history"
      >
        {isSearching ? (
          <SearchResults
            results={results}
            onResultClick={(id) => {
              // Scroll to message logic could go here if virtualization exposes scrollToItem
              // For now, we just clear search to show the message in context
              clearSearch();
              // A timeout to let the list render before scrolling could work
              setTimeout(() => {
                const el = document.getElementById(`message-${id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            query={query}
          />
        ) : (
          <div className="w-full max-w-4xl mx-auto min-h-full pb-32 pt-4 px-4 sm:px-6">
            {!hasMessages ? (
              <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
            ) : (
              <SmartMessageList
                messages={messages}
                isThinking={orbState === OrbState.THINKING || orbState === OrbState.RESPONDING}
                onSpeak={handleSpeak}
                onReaction={addReaction}
                virtualizationThreshold={VIRTUALIZATION_THRESHOLD}
                autoScrollToBottom={true}
              />
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}

        {/* Orb status for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          {getOrbStatusDescription(orbState)}
        </div>

        {/* Orb */}
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
      </main>

      {/* Input (now InputArea) */}
      <InputArea
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