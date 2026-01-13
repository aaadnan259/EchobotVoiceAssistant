import React from 'react';
import { ARIA_LABELS } from '../utils/accessibility';

interface WelcomeScreenProps {
    onSuggestionClick: (suggestion: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
    const suggestions = [
        "What can you do?",
        "Tell me a joke",
        "Write a short poem",
        "Help me with React"
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                    Welcome to EchoBot
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    Your AI-powered voice assistant. I can help you with writing, coding, analysis, and more.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-500 dark:hover:border-purple-500 transition-all text-sm text-left hover:shadow-md group"
                    >
                        <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {suggestion}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WelcomeScreen;
