import React, { useRef, useEffect, useCallback, memo } from 'react';
import { VariableSizeList as List, ListChildComponentProps } from 'react-window';
import * as AutoSizerModule from 'react-virtualized-auto-sizer';

// Fix for production build where default export might be missing
const AutoSizer = (AutoSizerModule as any).default || AutoSizerModule;

import { Message } from '../types';
import MessageBubble from './MessageBubble';
import { MessageErrorBoundary } from './ErrorBoundaries';

interface VirtualizedMessageListProps {
    messages: Message[];
    onSpeak: (text: string) => void;
    /** Estimated height of each message row (will be measured dynamically) */
    estimatedItemSize?: number;
    /** Whether to auto-scroll to bottom when new messages arrive */
    autoScrollToBottom?: boolean;
}

// Cache for measured item heights
const itemHeightCache = new Map<string, number>();

// Default estimated height for messages
const DEFAULT_ITEM_HEIGHT = 80;

// Minimum height for a message
const MIN_ITEM_HEIGHT = 60;

/**
 * Memoized message row component
 */
const MessageRow = memo(({
    message,
    onSpeak,
    setHeight,
    style
}: {
    message: Message;
    onSpeak: (text: string) => void;
    setHeight: (id: string, height: number) => void;
    style: React.CSSProperties;
}) => {
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rowRef.current) {
            const height = rowRef.current.getBoundingClientRect().height;
            if (height > 0) {
                setHeight(message.id, height);
            }
        }
    }, [message.id, message.text, setHeight]);

    return (
        <div style={style}>
            <div ref={rowRef} className="py-1">
                <MessageErrorBoundary>
                    <MessageBubble message={message} onSpeak={onSpeak} />
                </MessageErrorBoundary>
            </div>
        </div>
    );
});

MessageRow.displayName = 'MessageRow';

/**
 * Virtualized message list that only renders visible messages.
 * Dramatically improves performance with 100+ messages.
 * 
 * Uses react-window for efficient virtualization.
 * 
 * @requires npm install react-window react-virtualized-auto-sizer
 * @requires npm install -D @types/react-window
 */
export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
    messages,
    onSpeak,
    estimatedItemSize = DEFAULT_ITEM_HEIGHT,
    autoScrollToBottom = true,
}) => {
    const listRef = useRef<List>(null);
    const heightCacheRef = useRef<Map<string, number>>(itemHeightCache);

    // Get item height from cache or return estimate
    const getItemHeight = useCallback((index: number): number => {
        const message = messages[index];
        if (!message) return estimatedItemSize;

        const cachedHeight = heightCacheRef.current.get(message.id);
        if (cachedHeight) return cachedHeight;

        // Estimate based on text length
        const textLength = message.text?.length || 0;
        const hasImage = !!message.image;

        let estimated = MIN_ITEM_HEIGHT;

        // Add height for text (roughly 20px per 80 chars)
        estimated += Math.ceil(textLength / 80) * 20;

        // Add height for image
        if (hasImage) {
            estimated += 200;
        }

        return Math.max(estimated, MIN_ITEM_HEIGHT);
    }, [messages, estimatedItemSize]);

    // Update height cache and recalculate list
    const setItemHeight = useCallback((id: string, height: number) => {
        const currentHeight = heightCacheRef.current.get(id);
        if (currentHeight !== height && height > 0) {
            heightCacheRef.current.set(id, height);

            // Reset the list's cached measurements
            if (listRef.current) {
                const index = messages.findIndex(m => m.id === id);
                if (index !== -1) {
                    listRef.current.resetAfterIndex(index);
                }
            }
        }
    }, [messages]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (autoScrollToBottom && listRef.current && messages.length > 0) {
            // Use requestAnimationFrame for smooth scrolling
            requestAnimationFrame(() => {
                listRef.current?.scrollToItem(messages.length - 1, 'end');
            });
        }
    }, [messages.length, autoScrollToBottom]);

    // Render each row
    const renderRow = useCallback(({ index, style }: ListChildComponentProps) => {
        const message = messages[index];
        if (!message) return null;

        return (
            <MessageRow
                key={message.id}
                message={message}
                onSpeak={onSpeak}
                setHeight={setItemHeight}
                style={style}
            />
        );
    }, [messages, onSpeak, setItemHeight]);

    // Item key for React reconciliation
    const getItemKey = useCallback((index: number) => {
        return messages[index]?.id || index;
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        ref={listRef}
                        height={height}
                        width={width}
                        itemCount={messages.length}
                        itemSize={getItemHeight}
                        itemKey={getItemKey}
                        estimatedItemSize={estimatedItemSize}
                        overscanCount={5} // Render 5 extra items above/below viewport
                        className="scrollbar-hide"
                    >
                        {renderRow}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
};

/**
 * Simple non-virtualized list for when you have few messages.
 * Falls back to this for better UX with < 50 messages.
 */
export const SimpleMessageList: React.FC<{
    messages: Message[];
    onSpeak: (text: string) => void;
}> = memo(({ messages, onSpeak }) => (
    <>
        {messages.map(msg => (
            <MessageErrorBoundary key={msg.id}>
                <MessageBubble message={msg} onSpeak={onSpeak} />
            </MessageErrorBoundary>
        ))}
    </>
));

SimpleMessageList.displayName = 'SimpleMessageList';

/**
 * Smart message list that switches between virtualized and simple
 * based on message count.
 */
export const SmartMessageList: React.FC<VirtualizedMessageListProps & {
    /** Threshold to switch to virtualized rendering (default: 50) */
    virtualizationThreshold?: number;
}> = ({
    messages,
    onSpeak,
    virtualizationThreshold = 50,
    ...props
}) => {
        // Use simple list for small message counts
        if (messages.length < virtualizationThreshold) {
            return <SimpleMessageList messages={messages} onSpeak={onSpeak} />;
        }

        // Use virtualized list for large message counts
        return (
            <VirtualizedMessageList
                messages={messages}
                onSpeak={onSpeak}
                {...props}
            />
        );
    };

export default VirtualizedMessageList;
