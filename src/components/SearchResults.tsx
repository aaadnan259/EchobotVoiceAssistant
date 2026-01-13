import React from 'react';
import { Message } from '../types';

interface SearchResultsProps {
    results: Message[];
    onResultClick: (messageId: string) => void;
    query: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    onResultClick,
    query
}) => {
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 animate-in fade-in">
                <p>No messages found matching "{query}"</p>
            </div>
        );
    }

    const highlightText = (text: string, highlight: string) => {
        if (!highlight.trim()) return text;

        // Escape special regex characters in the query
        const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedHighlight})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) =>
            regex.test(part) ? (
                <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-black dark:text-yellow-100 font-medium rounded px-0.5">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    return (
        <div className="w-full max-w-2xl px-4 py-2 space-y-2 animate-in slide-in-from-bottom-2">
            <h3 className="text-sm font-semibold text-gray-500 mb-4 px-2">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
            </h3>

            {results.map((msg) => (
                <button
                    key={msg.id}
                    onClick={() => onResultClick(msg.id)}
                    className="w-full text-left p-3 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-purple-500/30 transition-all group"
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-indigo-500' : 'text-purple-500'
                            }`}>
                            {msg.role === 'user' ? 'You' : 'EchoBot'}
                        </span>
                        <span className="text-xs text-gray-400">
                            {new Date(msg.timestamp).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                        {highlightText(msg.text, query)}
                    </p>
                </button>
            ))}

            <div className="h-20" /> {/* Spacer */}
        </div>
    );
};
