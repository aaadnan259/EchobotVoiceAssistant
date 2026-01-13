import { useState, useMemo, useCallback } from 'react';
import { Message } from '../types';

interface UseMessageSearchReturn {
    query: string;
    setQuery: (q: string) => void;
    results: Message[];
    isSearching: boolean;
    clearSearch: () => void;
}

export function useMessageSearch(messages: Message[]): UseMessageSearchReturn {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        if (!query.trim()) return [];

        const lowerQuery = query.toLowerCase();
        return messages.filter(msg =>
            msg.text.toLowerCase().includes(lowerQuery)
        );
    }, [messages, query]);

    const clearSearch = useCallback(() => {
        setQuery('');
    }, []);

    return {
        query,
        setQuery,
        results,
        isSearching: !!query.trim(),
        clearSearch
    };
}
