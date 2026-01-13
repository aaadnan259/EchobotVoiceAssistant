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
          className="p-3 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
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
            className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-base p-3 focus:outline-none resize-none max-h-[200px]"
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
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
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

