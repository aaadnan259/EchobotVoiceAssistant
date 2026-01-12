import { useRef, useCallback, useState, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';

interface UseVirtualizationOptions {
    /** Total item count */
    itemCount: number;
    /** Default estimated item height */
    estimatedItemSize?: number;
    /** Whether to auto-scroll to bottom on item count change */
    autoScrollToBottom?: boolean;
    /** Number of items to render outside visible area */
    overscanCount?: number;
}

interface UseVirtualizationReturn {
    /** Ref to attach to the List component */
    listRef: React.RefObject<List>;
    /** Get the height for an item at index */
    getItemHeight: (index: number) => number;
    /** Set/update the height for an item */
    setItemHeight: (index: number, height: number) => void;
    /** Scroll to a specific item */
    scrollToItem: (index: number, align?: 'start' | 'center' | 'end' | 'smart') => void;
    /** Scroll to bottom */
    scrollToBottom: () => void;
    /** Reset height cache (call when items change significantly) */
    resetHeights: () => void;
    /** Whether virtualization should be used (based on item count) */
    shouldVirtualize: boolean;
}

const DEFAULT_ESTIMATED_SIZE = 80;
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * Hook to manage virtualized list state and helpers
 */
export function useVirtualization({
    itemCount,
    estimatedItemSize = DEFAULT_ESTIMATED_SIZE,
    autoScrollToBottom = true,
    overscanCount = 5,
}: UseVirtualizationOptions): UseVirtualizationReturn {
    const listRef = useRef<List>(null);
    const heightCache = useRef<Map<number, number>>(new Map());
    const [, forceUpdate] = useState({});

    // Determine if we should use virtualization
    const shouldVirtualize = itemCount >= VIRTUALIZATION_THRESHOLD;

    // Get item height from cache or estimate
    const getItemHeight = useCallback((index: number): number => {
        return heightCache.current.get(index) || estimatedItemSize;
    }, [estimatedItemSize]);

    // Set item height and trigger recalculation
    const setItemHeight = useCallback((index: number, height: number) => {
        const currentHeight = heightCache.current.get(index);

        if (currentHeight !== height && height > 0) {
            heightCache.current.set(index, height);

            // Tell react-window to recalculate from this index
            if (listRef.current) {
                listRef.current.resetAfterIndex(index, false);
            }
        }
    }, []);

    // Scroll to specific item
    const scrollToItem = useCallback((
        index: number,
        align: 'start' | 'center' | 'end' | 'smart' = 'smart'
    ) => {
        if (listRef.current) {
            listRef.current.scrollToItem(index, align);
        }
    }, []);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        if (listRef.current && itemCount > 0) {
            requestAnimationFrame(() => {
                listRef.current?.scrollToItem(itemCount - 1, 'end');
            });
        }
    }, [itemCount]);

    // Reset all cached heights
    const resetHeights = useCallback(() => {
        heightCache.current.clear();
        if (listRef.current) {
            listRef.current.resetAfterIndex(0, true);
        }
        forceUpdate({});
    }, []);

    // Auto-scroll to bottom when item count changes
    useEffect(() => {
        if (autoScrollToBottom && itemCount > 0) {
            scrollToBottom();
        }
    }, [itemCount, autoScrollToBottom, scrollToBottom]);

    return {
        listRef,
        getItemHeight,
        setItemHeight,
        scrollToItem,
        scrollToBottom,
        resetHeights,
        shouldVirtualize,
    };
}

export default useVirtualization;
