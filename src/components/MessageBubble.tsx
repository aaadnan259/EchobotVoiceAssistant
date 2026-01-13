
import React from 'react';
import { Volume2, Copy, ThumbsUp, ThumbsDown, Star, RefreshCw } from 'lucide-react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onSpeak?: (text: string) => void;
  onCopy?: (text: string) => void;
  onRegenerate?: (messageId: string) => void;
  onReaction?: (messageId: string, reaction: 'up' | 'down' | 'star') => void;
  isLastBotMessage?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSpeak,
  onCopy,
  onRegenerate,
  onReaction,
  isLastBotMessage = false,
}) => {
  const isUser = message.role === 'user';
  const isBot = message.role === 'model';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    onCopy?.(message.text);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    // Outer container - Controls alignment
    // FIX 2: justify-start for bot, justify-end for user
    <div
      className={`
        group
        flex w-full mb-4
        ${isUser ? 'justify-end' : 'justify-start'}
      `}
    >
      {/* Bot Avatar - Only for bot messages, on LEFT */}
      {isBot && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="11" r="2.5" />
              <circle cx="15" cy="11" r="2.5" />
            </svg>
          </div>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`
          max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-md
          ${isUser
            ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-br-sm'
            : 'bg-white dark:bg-[#1E2335] border border-gray-100 dark:border-white/5 text-gray-800 dark:text-gray-100 rounded-bl-sm'
          }
        `}
      >
        {/* Image if present */}
        {message.image && (
          <img
            src={message.image}
            alt="Attached"
            className="max-w-full h-auto rounded-lg mb-2"
          />
        )}

        {/* Message Text */}
        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
          {message.text}
        </p>

        {/* Footer: Timestamp and Actions */}
        <div
          className={`
            flex items-center mt-2 pt-1
            ${isUser ? 'justify-end' : 'justify-between'}
          `}
        >
          {/* Timestamp */}
          <span
            className={`
              text-xs
              ${isUser ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}
            `}
          >
            {formatTime(message.timestamp)}
          </span>

          {/* FIX 4: Actions - Subtle until hover */}
          {isBot && (
            <div
              className="
                flex items-center gap-0.5 ml-3
                opacity-0 group-hover:opacity-100
                transition-opacity duration-200
              "
            >
              {/* Speak */}
              {onSpeak && (
                <button
                  onClick={() => onSpeak(message.text)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                  title="Read aloud"
                >
                  <Volume2 className="w-3.5 h-3.5 text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                </button>
              )}

              {/* Copy */}
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                title="Copy"
              >
                <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-900 dark:hover:text-white" />
              </button>

              {/* Thumbs Up */}
              <button
                onClick={() => onReaction?.(message.id, 'up')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                title="Good response"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-gray-400 hover:text-green-500 dark:hover:text-green-400" />
              </button>

              {/* Thumbs Down */}
              <button
                onClick={() => onReaction?.(message.id, 'down')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                title="Bad response"
              >
                <ThumbsDown className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400" />
              </button>

              {/* Star */}
              <button
                onClick={() => onReaction?.(message.id, 'star')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                title="Bookmark"
              >
                <Star className="w-3.5 h-3.5 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400" />
              </button>

              {/* Regenerate - Only show for last bot message */}
              {isLastBotMessage && onRegenerate && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;