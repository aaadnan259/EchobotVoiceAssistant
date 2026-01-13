import React, { useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Square, Paperclip, X, Image as ImageIcon } from 'lucide-react';

interface InputBarProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSend: () => void;
  onMicClick: () => void;
  isMicActive: boolean;
  isListening: boolean;
  isGenerating: boolean;
  onStopGeneration: () => void;
  images: string[];
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function InputBar({
  inputValue,
  setInputValue,
  onSend,
  onMicClick,
  isMicActive,
  isListening, // Used for visual state if needed, or redundant with isMicActive
  isGenerating,
  onStopGeneration,
  images,
  onImageSelect,
  onRemoveImage,
  onPaste,
  fileInputRef
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() || images.length > 0) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-transparent">
      <div className="relative flex items-end gap-2 bg-white dark:bg-[#1E2335] border border-black/5 dark:border-white/10 rounded-3xl p-2 shadow-lg transition-all duration-300 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500/50">

        {/* File Input (Hidden) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onImageSelect}
          className="hidden"
          accept="image/png, image/jpeg, image/webp, image/gif"
          multiple
        />

        {/* Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          title="Attach images"
        >
          <Paperclip size={20} />
        </button>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Image Previews */}
          {images.length > 0 && (
            <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar">
              {images.map((img, index) => (
                <div key={index} className="relative group shrink-0">
                  <img
                    src={img}
                    alt={`Attachment ${index + 1}`}
                    className="h-16 w-16 object-cover rounded-lg border border-black/10 dark:border-white/10"
                  />
                  <button
                    onClick={() => onRemoveImage(index)}
                    className="absolute -top-1 -right-1 bg-gray-900/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text Input */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder="Message EchoBot..."
            className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 text-base p-3 focus:outline-none resize-none max-h-[200px]"
            rows={1}
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pb-1">
          {/* Mic Button */}
          <button
            onClick={onMicClick}
            className={`p-3 rounded-full transition-all duration-300 ${isMicActive
                ? 'bg-red-500/10 text-red-500 animate-pulse'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            title={isMicActive ? 'Stop listening' : 'Start voice input'}
          >
            {isMicActive ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Send / Stop Button */}
          {isGenerating ? (
            <button
              onClick={onStopGeneration}
              className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg shadow-red-500/20 transition-all active:scale-95"
              title="Stop generating"
            >
              <Square size={20} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!inputValue.trim() && images.length === 0}
              className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              title="Send message"
            >
              <Send size={20} className={inputValue.trim() || images.length > 0 ? 'ml-0.5' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Footer / Hint */}
      <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-600">
        EchoBot can make mistakes. Check important info.
      </div>
    </div>
  );
}

// Add type definition for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export function InputBar({ onSendMessage, onMicClick, isMicActive, onTypingStateChange }: InputBarProps) {
  const [input, setInput] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (input.length > 0) {
      onTypingStateChange(true);
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStateChange(false);
      }, 1500);
    } else {
      onTypingStateChange(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [input, onTypingStateChange]);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        onSendMessage(transcript); // Auto-send
        onMicClick(); // Toggle off in parent
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        onMicClick(); // Toggle off in parent
      };

      recognition.onend = () => {
        // Ensure state is synced if it stops naturally
        if (isMicActive) {
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Web Speech API not supported in this browser.");
    }
  }, []); // Empty dependency array to init once

  // Handle Mic Toggle based on prop
  useEffect(() => {
    if (isMicActive && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
      }
    } else if (!isMicActive && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
  }, [isMicActive]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        {/* Internal Glow Removed - Handled by Parent Wrapper */}

        <div className="relative flex items-center gap-3">
          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => onTypingStateChange(true)}
            onBlur={() => onTypingStateChange(false)}
            placeholder="Ask me anything…"
            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-lg py-3"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={onMicClick}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${isMicActive
                ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                : 'bg-muted hover:bg-muted/80 text-foreground hover:text-primary dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70'
                }`}
              aria-label="Voice input"
            >
              {isMicActive ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-primary/30"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}