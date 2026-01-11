import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScrollBehaviorOptions {
    /** Dependencies that trigger auto-scroll when changed */
    scrollTriggers?: any[];
    /** Maximum scroll distance to calculate progress (default: 200) */
    maxScrollForProgress?: number;
}

export function useScrollBehavior(options: UseScrollBehaviorOptions = {}) {
    const { scrollTriggers = [], maxScrollForProgress = 200 } = options;

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Track scroll progress (0 to 1)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const progress = Math.min(1, scrollTop / maxScrollForProgress);
            setScrollProgress(progress);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [maxScrollForProgress]);

    // Auto-scroll to bottom when triggers change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, scrollTriggers);

    // Manual scroll to bottom
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ behavior });
    }, []);

    // Scroll to top
    const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
        containerRef.current?.scrollTo({ top: 0, behavior });
    }, []);

    return {
        containerRef,
        bottomRef,
        scrollProgress,
        scrollToBottom,
        scrollToTop
    };
}
