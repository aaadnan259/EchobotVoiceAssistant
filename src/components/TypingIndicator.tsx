
import React from 'react';

export const TypingIndicator: React.FC = () => {
    return (
        <div className="flex justify-start w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white dark:bg-[#1C1F2E] border border-gray-200 dark:border-white/10 rounded-2xl rounded-tl-sm px-6 py-4 shadow-sm flex items-center space-x-1.5 w-fit">
                <div className="typing-dot w-2 h-2 bg-indigo-500 rounded-full"></div>
                <div className="typing-dot w-2 h-2 bg-indigo-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                <div className="typing-dot w-2 h-2 bg-indigo-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    );
};
