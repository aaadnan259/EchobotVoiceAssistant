import { useState, useEffect, useRef } from 'react';
import { Send, Mic } from 'lucide-react';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onMicClick: () => void;
  isMicActive: boolean;
  onTypingStateChange: (isTyping: boolean) => void;
}

export function InputBar({ onSendMessage, onMicClick, isMicActive, onTypingStateChange }: InputBarProps) {
  const [input, setInput] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (input.length > 0) {
      // User is typing
      onTypingStateChange(true);

      // Set timeout to detect when user stops typing
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStateChange(false);
      }, 1500);
    } else {
      // Input is empty
      onTypingStateChange(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [input, onTypingStateChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        {/* Background with glassmorphism */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl" />
        
        <div className="relative flex items-center gap-3 px-6 py-3">
          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything…"
            className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={onMicClick}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                isMicActive
                  ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
                  : 'bg-white/10 hover:bg-white/15'
              }`}
              aria-label="Voice input"
            >
              <Mic className={`w-5 h-5 ${isMicActive ? 'text-white' : 'text-white/70'}`} />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-indigo-500/40"
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