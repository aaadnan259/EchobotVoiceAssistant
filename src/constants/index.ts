/**
 * =============================================================================
 * EchoBot Configuration & Constants
 * =============================================================================
 * 
 * Centralized configuration for the entire application.
 * Edit values here instead of hunting through components.
 */

// =============================================================================
// Storage Keys
// =============================================================================

export const STORAGE_KEYS = {
    MESSAGES: 'echoBotMessages_v3',
    SETTINGS: 'echoBotSettings',
    THEME: 'echoBotTheme',
} as const;

// =============================================================================
// API Configuration
// =============================================================================

export const API_CONFIG = {
    /** Gemini model to use */
    MODEL_NAME: 'gemini-2.0-flash',

    /** Base URL for API endpoints */
    API_BASE_URL: '/api',

    /** Gemini chat endpoint */
    GEMINI_CHAT_ENDPOINT: '/api/gemini/chat',

    /** Request timeout in milliseconds */
    REQUEST_TIMEOUT: 30000,

    /** Max retries for failed requests */
    MAX_RETRIES: 3,
} as const;

// =============================================================================
// WebSocket Configuration
// =============================================================================

export const WEBSOCKET_CONFIG = {
    /** Initial reconnect delay in ms */
    RECONNECT_INTERVAL: 5000,

    /** Maximum reconnect delay in ms */
    MAX_RECONNECT_DELAY: 30000,

    /** Maximum reconnection attempts (Infinity for unlimited) */
    MAX_RECONNECT_ATTEMPTS: Infinity,

    /** WebSocket endpoint path */
    WS_PATH: '/ws',

    /** Development WebSocket port */
    DEV_WS_PORT: 8000,
} as const;

// =============================================================================
// Message Limits
// =============================================================================

export const MESSAGE_LIMITS = {
    /** Maximum messages to store in localStorage */
    MAX_STORED_MESSAGES: 500,

    /** Maximum character length per message */
    MAX_MESSAGE_LENGTH: 50000,

    /** Maximum image data URI size in bytes (~10MB) */
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,

    /** Maximum localStorage size in bytes (~5MB) */
    MAX_STORAGE_SIZE: 5 * 1024 * 1024,

    /** Truncation suffix */
    TRUNCATION_SUFFIX: '... [truncated]',
} as const;

// =============================================================================
// UI Configuration
// =============================================================================

export const UI_CONFIG = {
    /** Scroll distance (px) for orb animation progress */
    ORB_SCROLL_DISTANCE: 200,

    /** Default theme */
    DEFAULT_THEME: 'dark' as const,

    /** Toast notification position */
    TOAST_POSITION: 'top-center' as const,

    /** Error state display duration in ms */
    ERROR_DISPLAY_DURATION: 3000,

    /** Animation durations in ms */
    ANIMATIONS: {
        FADE_IN: 200,
        SLIDE_IN: 300,
        ORB_PULSE: 1000,
        THEME_TRANSITION: 300,
    },
} as const;

// =============================================================================
// Speech Configuration
// =============================================================================

export const SPEECH_CONFIG = {
    /** Speech recognition language */
    RECOGNITION_LANG: 'en-US',

    /** Whether to use continuous recognition */
    CONTINUOUS_RECOGNITION: false,

    /** Whether to show interim results */
    INTERIM_RESULTS: true,
} as const;

// =============================================================================
// Chat Messages
// =============================================================================

export const CHAT_MESSAGES = {
    /** Initial greeting from the bot */
    INITIAL_GREETING: "Hey there! I'm EchoBot, your AI assistant. How can I help you today?",

    /** Placeholder text for input */
    INPUT_PLACEHOLDER: 'Type a message...',

    /** Placeholder when listening */
    LISTENING_PLACEHOLDER: 'Listening...',

    /** Error messages */
    ERRORS: {
        GENERIC: "My neural pathways are a bit jammed right now. Can you try that again?",
        RATE_LIMIT: "I'm getting too many requests at once. Give me a moment to cool down.",
        SAFETY: "I can't respond to that due to my safety protocols.",
        NO_API_KEY: "I seem to be missing my API key. Please configure it in your environment to proceed.",
        VOICE_NOT_SUPPORTED: "Voice input is not supported in this browser.",
        WEBSOCKET_ERROR: "Connection error. Attempting to reconnect...",
        MESSAGE_DISPLAY: "[Message could not be displayed]",
    },

    /** Success messages */
    SUCCESS: {
        CHAT_SAVED: 'Chat saved to device',
        CONNECTED: 'Connected to EchoBot Brain',
    },

    /** Confirmation messages */
    CONFIRMATIONS: {
        CLEAR_CHAT: 'Are you sure you want to clear the chat history?',
    },
} as const;

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_SETTINGS = {
    model: API_CONFIG.MODEL_NAME,
    systemPrompt: `You are EchoBot, a helpful, friendly, and knowledgeable AI assistant. 
You communicate in a warm, conversational tone while being precise and informative.
You can help with a wide variety of tasks including answering questions, creative writing, 
coding assistance, and general conversation.`,
    voiceURI: null as string | null,
    theme: UI_CONFIG.DEFAULT_THEME,
} as const;

// =============================================================================
// Sound Effects
// =============================================================================

export const SOUNDS = {
    SEND: 'send',
    RECEIVE: 'receive',
    ERROR: 'error',
} as const;

/**
 * Play a sound effect
 */
export function playSound(sound: keyof typeof SOUNDS): void {
    // Sound implementation - could be expanded with actual audio files
    // For now, using Web Audio API for simple tones
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Different frequencies for different sounds
        const frequencies: Record<string, number> = {
            send: 880,    // A5
            receive: 660, // E5
            error: 220,   // A3
        };

        oscillator.frequency.value = frequencies[sound] || 440;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Silently fail if audio isn't available
        console.debug('Sound playback not available:', e);
    }
}

// =============================================================================
// CSS Classes (for consistency)
// =============================================================================

export const CSS_CLASSES = {
    /** Common button styles */
    BUTTON: {
        PRIMARY: 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors',
        SECONDARY: 'px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors',
        DANGER: 'px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors',
        ICON: 'p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors',
    },

    /** Input styles */
    INPUT: 'w-full p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none',

    /** Card styles */
    CARD: 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6',
} as const;

// =============================================================================
// Regex Patterns
// =============================================================================

export const PATTERNS = {
    /** Valid image data URI */
    IMAGE_DATA_URI: /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/,

    /** Dangerous URL protocols */
    DANGEROUS_PROTOCOLS: /^(javascript|data|vbscript|file):/i,

    /** Safe URL protocols */
    SAFE_PROTOCOLS: /^(https?|mailto|tel):/i,
} as const;

// =============================================================================
// Export legacy names for backward compatibility
// =============================================================================

export const MODEL_NAME = API_CONFIG.MODEL_NAME;
export const DEFAULT_SYSTEM_PROMPT = DEFAULT_SETTINGS.systemPrompt;
export const INITIAL_GREETING = CHAT_MESSAGES.INITIAL_GREETING;
