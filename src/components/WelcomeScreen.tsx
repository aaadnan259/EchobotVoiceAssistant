import React from 'react';
import { ARIA_LABELS } from '../utils/accessibility';

interface WelcomeScreenProps {
    onSuggestionClick: (suggestion: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
    const suggestions = [
        "Tell me a joke",
        "Help me brainstorm",
        "Explain a concept",
        "Write some code"
    ];

    return (
        <div className="flex flex-col items-center justify-start min-h-full w-full pt-[45vh] animate-in fade-in duration-700">
            <div className="space-y-3 mb-8 text-center px-4">
                <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    Welcome to EchoBot
                </h1>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-base">
                    Your AI companion. How can I help you today?
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-6">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="px-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200 text-sm text-center text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WelcomeScreen;
