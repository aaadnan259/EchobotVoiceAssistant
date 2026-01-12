/**
 * =============================================================================
 * Logger Utility
 * =============================================================================
 * 
 * Centralized logging that respects environment.
 * - Development: All logs shown
 * - Production: Only warnings and errors
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('Detailed info for debugging');
 *   logger.info('General information');
 *   logger.warn('Warning message');
 *   logger.error('Error message', errorObject);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
    level: LogLevel;
    prefix: string;
    enableTimestamp: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4,
};

// Determine environment
const isDevelopment =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' ||
    typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

// Default configuration
const defaultConfig: LoggerConfig = {
    level: isDevelopment ? 'debug' : 'warn',
    prefix: '[EchoBot]',
    enableTimestamp: isDevelopment,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Format a log message with optional timestamp and prefix
 */
function formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (config.enableTimestamp) {
        parts.push(`[${new Date().toISOString()}]`);
    }

    if (config.prefix) {
        parts.push(config.prefix);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Logger object with methods for each log level
 */
export const logger = {
    /**
     * Debug level - detailed information for debugging
     * Only shown in development
     */
    debug(message: string, ...args: any[]): void {
        if (shouldLog('debug')) {
            console.debug(formatMessage('debug', message), ...args);
        }
    },

    /**
     * Info level - general information
     * Only shown in development
     */
    info(message: string, ...args: any[]): void {
        if (shouldLog('info')) {
            console.info(formatMessage('info', message), ...args);
        }
    },

    /**
     * Warn level - warning messages
     * Shown in all environments
     */
    warn(message: string, ...args: any[]): void {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message), ...args);
        }
    },

    /**
     * Error level - error messages
     * Shown in all environments
     */
    error(message: string, ...args: any[]): void {
        if (shouldLog('error')) {
            console.error(formatMessage('error', message), ...args);
        }
    },

    /**
     * Group related logs together (development only)
     */
    group(label: string): void {
        if (isDevelopment) {
            console.group(formatMessage('group', label));
        }
    },

    /**
     * End a log group
     */
    groupEnd(): void {
        if (isDevelopment) {
            console.groupEnd();
        }
    },

    /**
     * Log a table (development only)
     */
    table(data: any): void {
        if (isDevelopment) {
            console.table(data);
        }
    },

    /**
     * Time a operation (development only)
     */
    time(label: string): void {
        if (isDevelopment) {
            console.time(`${config.prefix} ${label}`);
        }
    },

    /**
     * End timing and log result
     */
    timeEnd(label: string): void {
        if (isDevelopment) {
            console.timeEnd(`${config.prefix} ${label}`);
        }
    },

    /**
     * Configure the logger
     */
    configure(newConfig: Partial<LoggerConfig>): void {
        config = { ...config, ...newConfig };
    },

    /**
     * Reset to default configuration
     */
    reset(): void {
        config = { ...defaultConfig };
    },

    /**
     * Get current configuration
     */
    getConfig(): Readonly<LoggerConfig> {
        return { ...config, ...defaultConfig }; // Added defaultConfig spread to ensure structure, user code just used config
    },

    /**
     * Check if currently in development mode
     */
    isDev(): boolean {
        return isDevelopment;
    },
};

// Also export individual functions for convenience
export const { debug, info, warn, error } = logger;

export default logger;
