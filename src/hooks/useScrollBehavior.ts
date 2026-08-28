import { useEffect, useRef, useState, useCallback } from 'react';
import { UI_CONFIG } from '../constants';

const { ORB_SCROLL_DISTANCE, NEAR_BOTTOM_THRESHOLD } = UI_CONFIG;

interface UseScrollBehaviorOptions {
    /** Dependencies that trigger auto-scroll when changed */
    scrollTriggers?: any[];
    /** Maximum scroll distance to calculate progress (default: 200) */
    maxScrollForProgress?: number;
}

export function useScrollBehavior(options: UseScrollBehaviorOptions = {}) {
    const { scrollTriggers = [], maxScrollForProgress = ORB_SCROLL_DISTANCE } = options;

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Whether the user is currently scrolled near the bottom of the chat.
    // Starts true so the very first auto-scroll (on mount) always happens;
    // updated on every scroll event thereafter.
    const isNearBottomRef = useRef(true);
    // Distinguishes the initial mount's auto-scroll from later updates, so the
    // initial one can jump instantly instead of animating from wherever the
    // browser happened to render the container's scroll position first.
    const hasScrolledOnceRef = useRef(false);

    // Track scroll progress (0 to 1) and whether the user is near the bottom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const progress = Math.min(1, scrollTop / maxScrollForProgress);
            setScrollProgress(progress);

            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [maxScrollForProgress]);

    // Auto-scroll to bottom when triggers change (new/updated messages).
    // - On initial mount: always jump to the bottom instantly (no visible
    //   animation from wherever the container starts).
    // - On every later trigger (new message, streamed token, etc.): only
    //   follow along with a smooth scroll if the user was already near the
    //   bottom, so it never yanks someone back down while they're reading
    //   older history further up.
    useEffect(() => {
        if (!bottomRef.current) return;

        if (!hasScrolledOnceRef.current) {
            hasScrolledOnceRef.current = true;
            // 'instant', not 'auto' - the container has CSS `scroll-behavior:
            // smooth` (Tailwind's scroll-smooth class), and 'auto' explicitly
            // means "defer to that CSS", which would animate. 'instant' is
            // the only value that bypasses it for a true no-animation jump.
            bottomRef.current.scrollIntoView({ behavior: 'instant' });
            return;
        }

        if (isNearBottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
