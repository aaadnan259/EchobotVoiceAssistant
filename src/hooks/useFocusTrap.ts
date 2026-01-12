import { useEffect, useRef, useCallback } from 'react';
import { Keys } from '../utils/accessibility';

/**
 * Hook to trap focus within a container (for modals, dialogs, etc.)
 * 
 * Usage:
 * const { containerRef } = useFocusTrap(isOpen);
 * 
 * return (
 *   <div ref={containerRef}>
 *     <button>First focusable</button>
 *     <button>Last focusable</button>
 *   </div>
 * );
 */
export function useFocusTrap(isActive: boolean = true) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];

        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
        ].join(', ');

        return Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
        );
    }, []);

    useEffect(() => {
        if (!isActive) return;

        // Store currently focused element to restore later
        previousActiveElement.current = document.activeElement as HTMLElement;

        // Focus first focusable element
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
            // Small delay to ensure the modal is rendered
            setTimeout(() => focusable[0]?.focus(), 10);
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== Keys.TAB) return;

            const focusable = getFocusableElements();
            if (focusable.length === 0) return;

            const firstElement = focusable[0];
            const lastElement = focusable[focusable.length - 1];

            if (event.shiftKey) {
                // Shift + Tab: go backwards
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: go forwards
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // Restore focus to previously focused element
            if (previousActiveElement.current && previousActiveElement.current.focus) {
                previousActiveElement.current.focus();
            }
        };
    }, [isActive, getFocusableElements]);

    return { containerRef };
}

export default useFocusTrap;
