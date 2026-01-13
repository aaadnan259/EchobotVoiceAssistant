import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { logger } from '../utils/logger';
import { STORAGE_KEYS } from '../constants';

/**
 * Error boundary for the entire app.
 * Shows a full-page error UI with reload option.
 */
export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
    const fallback = (error: Error, reset: () => void) => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0B0D18] p-6 text-center">
            <div className="text-purple-500 mb-6">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 15h8M9 9h.01M15 9h.01" />
                </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Oops! EchoBot hit a snag
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                We encountered an unexpected issue.
            </p>

            {/* Error Details Box */}
            <div className="w-full max-w-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                    Error Details
                </p>
                <code className="block text-sm text-red-700 dark:text-red-300 font-mono break-all whitespace-pre-wrap">
                    {error.message || 'Unknown error occurred'}
                </code>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-purple-500/25"
                >
                    Reload App
                </button>

                <button
                    onClick={() => {
                        localStorage.removeItem(STORAGE_KEYS.MESSAGES);
                        window.location.reload();
                    }}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-full font-medium transition-colors"
                >
                    Clear History & Reload
                </button>
            </div>
        </div>
    );

    return (
        <ErrorBoundary
            fallback={fallback}
            onError={(error, errorInfo) => {
                logger.error('App Error:', error);
                logger.error('Stack:', errorInfo.componentStack);
            }}
        >
            {children}
        </ErrorBoundary>
    );
};

/**
 * Error boundary for the chat/message area.
 * Allows retry without reloading the whole app.
 */
export const ChatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
    const fallback = (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-800/50 rounded-lg m-4">
            <div className="text-amber-500 mb-4">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Unable to display messages. Try scrolling or refreshing.
            </p>
        </div>
    );

    return (
        <ErrorBoundary fallback={fallback} showRetry>
            {children}
        </ErrorBoundary>
    );
};

/**
 * Error boundary for individual message bubbles.
 * Fails silently with a minimal error indicator.
 */
export const MessageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
    const fallback = (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 text-sm italic">
            [Message could not be displayed]
        </div>
    );

    return (
        <ErrorBoundary fallback={fallback} showRetry={false}>
            {children}
        </ErrorBoundary>
    );
};

/**
 * Error boundary for the settings modal.
 */
export const SettingsErrorBoundary: React.FC<{
    children: ReactNode;
    onClose: () => void;
}> = ({ children, onClose }) => {
    const fallback = (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Settings Error
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Unable to load settings. Your preferences are still saved.
                </p>
                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );

    return (
        <ErrorBoundary fallback={fallback} showRetry={false}>
            {children}
        </ErrorBoundary>
    );
};

/**
 * Error boundary for the Orb visualization.
 * Shows a static orb if the animated one fails.
 */
export const OrbErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
    const fallback = (
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/50 opacity-75" />
    );

    return (
        <ErrorBoundary fallback={fallback} showRetry={false}>
            {children}
        </ErrorBoundary>
    );
};

export default {
    AppErrorBoundary,
    ChatErrorBoundary,
    MessageErrorBoundary,
    SettingsErrorBoundary,
    OrbErrorBoundary
};
