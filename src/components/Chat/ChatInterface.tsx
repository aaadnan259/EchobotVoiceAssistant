import React, { useCallback } from 'react';
import { toast } from 'sonner';
import {
    TopBar,
    InputArea,
    SmartMessageList,
    SearchResults,
    Orb as OrbComponent,
    ImageDropZone,
    OrbErrorBoundary
} from '..';
import { useChatContext } from '../../contexts/ChatContext';
import { useUI } from '../../contexts/UIContext';
import { useSettings } from '../../hooks';
import { useScrollBehavior, useAudioAnalyzer, useKeyboardShortcuts } from '../../hooks';
import { CHAT_MESSAGES } from '../../constants';

const { SUCCESS, ERRORS, CONFIRMATIONS } = CHAT_MESSAGES;
const VIRTUALIZATION_THRESHOLD = 50;

export const ChatInterface: React.FC = () => {
    const {
        messages,
        addReaction,
        createBranch,
        navigateUncles,
        getSiblingInfo,
        // Chat State
        orbState,
        isGenerating,
        isThinking,
        isResponding,
        stopGeneration,
        sendMessage,
        // Input
        inputValue,
        setInputValue,
        images,
        handleFileSelect,
        handleDrop,
        handlePaste,
        removeImage,
        clearImages,
        fileInputRef,
        // Voice
        isListening,
        isSpeechSupported,
        toggleListening,
        speak,
        // Search
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        clearSearch,
        // Actions
        clearMessages,
        exportMessages
    } = useChatContext();

    const {
        isOnline,
        isDragging,
        setDragging,
        setSettingsOpen,
        setExportOpen,
        setImportOpen,
        setSummaryOpen,
        setShortcutsOpen,
        isShortcutsOpen // for keyboard shortcut toggle
    } = useUI();

    const { settings, toggleTheme, isDarkMode } = useSettings();

    // --- Local State / Refs ---
    const { containerRef, bottomRef, scrollProgress } = useScrollBehavior({
        scrollTriggers: [messages]
    });

    // We need a ref for messages end to scroll to
    // useScrollBehavior uses bottomRef, so we can use that?
    // App.tsx used messagesEndRef separate from bottomRef?
    // App.tsx: const { containerRef, bottomRef, scrollProgress } = useScrollBehavior...
    // And: <div ref={messagesEndRef} className="h-4" />
    // useScrollBehavior implementation might expect bottomRef to be the element at bottom.
    // Let's use bottomRef for the empty div at bottom.

    // --- Audio Analyzer ---
    const audioLevel = useAudioAnalyzer(
        isListening,
        isResponding
    );

    // --- Handlers ---
    const handleMicClick = useCallback(() => {
        if (!isSpeechSupported) {
            alert(ERRORS.VOICE_NOT_SUPPORTED);
            return;
        }
        toggleListening();
    }, [isSpeechSupported, toggleListening]);

    const handleClearChat = useCallback(() => {
        if (window.confirm(CONFIRMATIONS.CLEAR_CHAT)) {
            clearMessages();
        }
    }, [clearMessages]);

    const handleReset = useCallback(() => {
        clearMessages();
        setInputValue('');
        clearImages();
        clearSearch();
        toast.success(SUCCESS.CHAT_RESET);
    }, [clearMessages, setInputValue, clearImages, clearSearch]);

    const handleSaveChat = useCallback(() => {
        if (exportMessages()) {
            toast.success(SUCCESS.CHAT_SAVED);
        } else {
            toast.error('Failed to save chat');
        }
    }, [exportMessages]);

    // --- Keyboard Shortcuts ---
    useKeyboardShortcuts({
        'mod+enter': sendMessage,
        'mod+k': handleClearChat,
        'mod+/': () => setShortcutsOpen(!isShortcutsOpen),
        'mod+,': () => setSettingsOpen(true),
        'mod+f': () => {
            const searchInput = document.querySelector('input[placeholder="Search messages..."]') as HTMLInputElement;
            searchInput?.focus();
        },
        'escape': () => {
            setSettingsOpen(false);
            setExportOpen(false);
            setImportOpen(false);
            setShortcutsOpen(false);
            setSummaryOpen(false);
            clearSearch();
        },
        'mod+shift+v': handleMicClick,
        'mod+e': () => setExportOpen(true),
        'mod+i': () => setImportOpen(true),
        'mod+j': toggleTheme
    });

    return (
        <>
            <TopBar
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                onReset={handleReset}
                onSaveChat={handleSaveChat}
                onClearChat={handleClearChat}
                onOpenSettings={() => setSettingsOpen(true)}
                isMicActive={isListening}
                onMicToggle={handleMicClick}
                isVoiceEnabled={!!settings.voiceSettings?.voiceURI}
                onVoiceToggle={() => {/* toggle voice logic if needed */ }}
                onExportClick={() => setExportOpen(true)}
                onImportClick={() => setImportOpen(true)}
                onShortcutsClick={() => setShortcutsOpen(true)}
                onSummarizeClick={() => setSummaryOpen(true)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {!isOnline && (
                <div className="w-full bg-yellow-500/90 text-black text-center py-1 px-4 text-sm font-medium sticky top-[64px] z-10 backdrop-blur-sm animate-in slide-in-from-top-2">
                    You are currently offline. Messages will be sent when you reconnect.
                </div>
            )}

            <ImageDropZone
                isDragging={isDragging}
                onDrop={(e) => {
                    setDragging(false);
                    handleDrop(e);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                className="flex-1 min-h-0 flex flex-col"
            >
                <main
                    ref={containerRef}
                    id="main-content"
                    className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative"
                    role="main"
                    aria-label="Chat history"
                >
                    {/* Orb */}
                    <div className="sticky top-0 z-10 w-full flex justify-center pt-20 pb-6 pointer-events-none">
                        <div className="relative">
                            <OrbErrorBoundary>
                                <OrbComponent state={orbState} scrollProgress={scrollProgress} audioLevel={audioLevel} />
                            </OrbErrorBoundary>
                        </div>
                    </div>

                    {isSearching ? (
                        <SearchResults
                            results={searchResults}
                            onResultClick={(id) => {
                                clearSearch();
                                setTimeout(() => {
                                    const el = document.getElementById('message-' + id);
                                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                            }}
                            query={searchQuery}
                        />
                    ) : (
                        <div className="w-full max-w-4xl mx-auto pb-32 px-4 sm:px-6">
                            <SmartMessageList
                                messages={messages}
                                isTyping={isThinking}
                                onSpeak={speak}
                                onReaction={addReaction}
                                getSiblingInfo={getSiblingInfo}
                                onNavigateBranch={navigateUncles}
                                onBranchCreate={createBranch}
                                virtualizationThreshold={VIRTUALIZATION_THRESHOLD}
                                autoScrollToBottom={true}
                            />
                            <div ref={bottomRef} className="h-4" />
                        </div>
                    )}
                </main>
            </ImageDropZone>

            <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-gray-50 via-gray-50/95 dark:from-[#0B0D18] dark:via-[#0B0D18]/95 to-transparent pt-4 backdrop-blur-sm">
                <InputArea
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onSend={sendMessage}
                    onMicClick={handleMicClick}
                    images={images}
                    onImageSelect={handleFileSelect}
                    onRemoveImage={removeImage}
                    onPaste={handlePaste}
                    onStopGeneration={stopGeneration}
                    isGenerating={isGenerating}
                    isListening={isListening}
                    fileInputRef={fileInputRef}
                />
            </div>
        </>
    );
};
