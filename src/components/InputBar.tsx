import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onMicClick: () => void; // Kept for parent state updates if needed, but logic moves here
  isMicActive: boolean;
  onTypingStateChange: (isTyping: boolean) => void;
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
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70'
                }`}
              aria-label="Voice input"
            >
              {isMicActive ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-indigo-500/30"
              aria-label="Send message"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}