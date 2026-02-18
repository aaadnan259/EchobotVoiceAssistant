import React, { ReactNode, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useTheme } from '../../hooks';
import { announce } from '../../utils/accessibility';
import { useChatContext } from '../../contexts/ChatContext';
import { OrbState } from '../../types';

export const MainLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    useTheme();

    // Accessibility announcements for OrbState
    const { orbState } = useChatContext();
    useEffect(() => {
        const stateDescriptions: Record<OrbState, string> = {
            [OrbState.IDLE]: '',
            [OrbState.LISTENING]: 'Listening for voice input',
            [OrbState.THINKING]: 'Processing your message',
            [OrbState.RESPONDING]: 'EchoBot is responding',
            [OrbState.ERROR]: 'An error occurred',
        };
        const description = stateDescriptions[orbState];
        if (description) {
            announce(description, orbState === OrbState.ERROR ? 'assertive' : 'polite');
        }
    }, [orbState]);

    return (
        <div className="relative flex flex-col h-screen bg-gray-50 dark:bg-[#0B0D18] transition-colors duration-300 text-gray-900 dark:text-white overflow-hidden">
            <Toaster position="top-center" />

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg"
            >
                Skip to chat
            </a>

            <div
                id="aria-live-region"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            />

            <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0B0D18] to-[#000000]" aria-hidden="true" />
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" aria-hidden="true" />

            {children}
        </div>
    );
};
