import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    onClear: () => void;
    resultCount: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    query,
    onQueryChange,
    onClear,
    resultCount
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                onClear();
                inputRef.current?.blur();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClear]);

    return (
        <div className="relative flex items-center w-full max-w-md mx-auto">
            <div className="absolute left-3 text-gray-400 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>

            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search messages (Ctrl+F)"
                className="w-full pl-10 pr-10 py-2 bg-black/5 dark:bg-white/10 border border-transparent focus:border-purple-500 rounded-full text-sm transition-all outline-none"
                aria-label="Search messages"
            />

            {query && (
                <button
                    onClick={onClear}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Clear search"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            )}

            {query && resultCount > 0 && (
                <div className="absolute right-10 text-xs text-gray-500 font-medium">
                    {resultCount}
                </div>
            )}
        </div>
    );
};
