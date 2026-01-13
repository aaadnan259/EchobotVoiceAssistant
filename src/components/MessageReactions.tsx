import React from 'react';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { Message } from '../types';

interface MessageReactionsProps {
    message: Message;
    onReaction: (messageId: string, reaction: 'thumbsUp' | 'thumbsDown' | 'starred') => void;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({ message, onReaction }) => {
    const isUser = message.role === 'user';
    const { thumbsUp, thumbsDown, starred } = message.reactions || {};

    return (
        <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {/* Bot only: Thumbs Up/Down */}
            {!isUser && (
                <>
                    <button
                        onClick={() => onReaction(message.id, 'thumbsUp')}
                        className={`p-1.5 rounded-full transition-all duration-200 
              ${thumbsUp
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-200'
                            }`}
                        title="Helpful"
                    >
                        <ThumbsUp className={`w-3.5 h-3.5 ${thumbsUp ? 'fill-current' : ''}`} />
                    </button>

                    <button
                        onClick={() => onReaction(message.id, 'thumbsDown')}
                        className={`p-1.5 rounded-full transition-all duration-200
              ${thumbsDown
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-200'
                            }`}
                        title="Not helpful"
                    >
                        <ThumbsDown className={`w-3.5 h-3.5 ${thumbsDown ? 'fill-current' : ''}`} />
                    </button>

                    <div className="w-px h-3 bg-gray-200 dark:bg-white/10 mx-1" />
                </>
            )}

            {/* Everyone: Star */}
            <button
                onClick={() => onReaction(message.id, 'starred')}
                className={`p-1.5 rounded-full transition-all duration-200
          ${starred
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-yellow-500'
                    }`}
                title={starred ? "Unstar" : "Star message"}
            >
                <Star className={`w-3.5 h-3.5 ${starred ? 'fill-current' : ''}`} />
            </button>
        </div>
    );
};
