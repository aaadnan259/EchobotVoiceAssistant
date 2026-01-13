
import { useEffect, useCallback } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutMap {
    [key: string]: KeyHandler;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
            const mod = ctrlKey || metaKey; // 'mod' matches Ctrl on Windows/Linux, Cmd on Mac

            // Build the key string for matching
            const parts = [];
            if (mod) parts.push('mod');
            if (shiftKey) parts.push('shift');
            if (altKey) parts.push('alt');

            // Handle special keys
            if (key === 'Escape') parts.push('escape');
            else if (key === 'Enter') parts.push('enter');
            else if (key === ' ') parts.push('space');
            else if (key.length === 1) parts.push(key.toLowerCase());
            else parts.push(key.toLowerCase()); // For other keys like ArrowUp, etc.

            const shortcutKey = parts.join('+');
            const handler = shortcuts[shortcutKey];

            // Also check specific key matches if exact modifier combo isn't found?
            // For now, strict matching based on the generated string.

            if (handler) {
                // Prevent default only if handled (except for specific cases where we might want default)
                // Usually we want to prevent default for app shortcuts.
                // But let's let the handler decide or prevent by default if it's a 'mod' shortcut.

                // Check if we are in an input field (unless the shortcut uses 'mod')
                const target = event.target as HTMLElement;
                const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

                // Allow 'mod' shortcuts and 'escape' even in inputs
                if (isInput && !mod && key !== 'Escape') {
                    return;
                }

                event.preventDefault();
                handler(event);
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
};
