/**
 * =============================================================================
 * Accessibility Utilities
 * =============================================================================
 * 
 * Helpers for building accessible components.
 */

import React from 'react';

/**
 * ARIA live region announcements
 * Use for dynamic content updates that screen readers should announce
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    // Find or create the live region
    let liveRegion = document.getElementById('aria-live-region');

    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'aria-live-region';
        liveRegion.setAttribute('aria-live', priority);
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
    } else {
        liveRegion.setAttribute('aria-live', priority);
    }

    // Clear and set message (necessary for re-announcements)
    liveRegion.textContent = '';
    setTimeout(() => {
        liveRegion!.textContent = message;
    }, 100);
}

/**
 * Screen reader only CSS class
 * Visually hidden but accessible to screen readers
 */
export const SR_ONLY_CLASS = 'sr-only';

/**
 * Generate unique IDs for accessibility relationships
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
    return `${prefix}-${++idCounter}`;
}

/**
 * Keyboard key codes for event handling
 */
export const Keys = {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
} as const;

/**
 * Check if a keyboard event is an activation key (Enter or Space)
 */
export function isActivationKey(event: React.KeyboardEvent): boolean {
    return event.key === Keys.ENTER || event.key === Keys.SPACE;
}

/**
 * Handle keyboard activation for custom interactive elements
 */
export function handleKeyboardActivation(
    event: React.KeyboardEvent,
    callback: () => void
): void {
    if (isActivationKey(event)) {
        event.preventDefault();
        callback();
    }
}

/**
 * Focus trap for modals and dialogs
 */
export function createFocusTrap(containerRef: React.RefObject<HTMLElement>) {
    const getFocusableElements = (): HTMLElement[] => {
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
    };

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

    const activate = () => {
        document.addEventListener('keydown', handleKeyDown);
        // Focus first focusable element
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    };

    const deactivate = () => {
        document.removeEventListener('keydown', handleKeyDown);
    };

    return { activate, deactivate };
}

/**
 * ARIA labels for common actions
 */
export const ARIA_LABELS = {
    // Header actions
    SAVE_CHAT: 'Save chat history to file',
    CLEAR_CHAT: 'Clear all chat messages',
    TOGGLE_THEME: 'Toggle dark/light theme',
    OPEN_SETTINGS: 'Open settings',
    CLOSE_SETTINGS: 'Close settings',

    // Chat input
    MESSAGE_INPUT: 'Type your message',
    SEND_MESSAGE: 'Send message',
    STOP_GENERATION: 'Stop generating response',
    VOICE_INPUT: 'Start voice input',
    STOP_VOICE_INPUT: 'Stop voice input',
    ATTACH_IMAGE: 'Attach an image',
    REMOVE_IMAGE: 'Remove attached image',

    // Messages
    USER_MESSAGE: 'Your message',
    BOT_MESSAGE: 'EchoBot response',
    SPEAK_MESSAGE: 'Read message aloud',
    COPY_MESSAGE: 'Copy message to clipboard',

    // Orb
    ORB_IDLE: 'EchoBot is idle',
    ORB_LISTENING: 'EchoBot is listening',
    ORB_THINKING: 'EchoBot is thinking',
    ORB_RESPONDING: 'EchoBot is responding',
    ORB_ERROR: 'EchoBot encountered an error',

    // Status
    LOADING: 'Loading',
    CONNECTED: 'Connected to server',
    DISCONNECTED: 'Disconnected from server',
} as const;

/**
 * Get orb status description for screen readers
 */
export function getOrbStatusDescription(state: string): string {
    const descriptions: Record<string, string> = {
        idle: ARIA_LABELS.ORB_IDLE,
        listening: ARIA_LABELS.ORB_LISTENING,
        thinking: ARIA_LABELS.ORB_THINKING,
        responding: ARIA_LABELS.ORB_RESPONDING,
        error: ARIA_LABELS.ORB_ERROR,
    };
    return descriptions[state.toLowerCase()] || ARIA_LABELS.ORB_IDLE;
}

/**
 * Reduced motion preference check
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hook-friendly reduced motion check
 */
export function getMotionPreference(): 'no-preference' | 'reduce' {
    return prefersReducedMotion() ? 'reduce' : 'no-preference';
}

export default {
    announce,
    generateId,
    Keys,
    isActivationKey,
    handleKeyboardActivation,
    createFocusTrap,
    ARIA_LABELS,
    getOrbStatusDescription,
    prefersReducedMotion,
    getMotionPreference,
};
