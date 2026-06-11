/**
 * Server-issued session token management.
 * Replaces the fake base64 tokens from wsAuth.ts.
 */
import { logger } from '../utils/logger';
import { storeToken, getStoredToken, clearToken } from '../utils/wsAuth';

const SESSION_ENDPOINT = '/api/session';
const COLD_START_TOAST_DELAY = 5000;

let tokenPromise: Promise<string> | null = null;

/** Fetch a new session token from the server. */
async function fetchToken(): Promise<string> {
    const controller = new AbortController();
    const toastTimeout = setTimeout(() => {
        // Show cold-start toast if fetch takes > 5s (Render free-tier ~50s cold start)
        try {
            // Dynamic import to avoid hard dep — sonner is already in package.json
            import('sonner').then(({ toast }) => {
                toast.info('Server is waking up…', { duration: 10000 });
            });
        } catch { /* noop */ }
    }, COLD_START_TOAST_DELAY);

    try {
        const response = await fetch(SESSION_ENDPOINT, { signal: controller.signal });
        clearTimeout(toastTimeout);
        if (!response.ok) throw new Error(`Session fetch failed: ${response.status}`);
        const data = await response.json();
        storeToken(data.token);
        return data.token;
    } catch (e) {
        clearTimeout(toastTimeout);
        throw e;
    }
}

/** Get a valid token, fetching if needed. */
export async function getToken(): Promise<string> {
    const stored = getStoredToken();
    if (stored) return stored;
    // Deduplicate concurrent fetches
    if (!tokenPromise) {
        tokenPromise = fetchToken().finally(() => { tokenPromise = null; });
    }
    return tokenPromise as Promise<string>;
}

/** Clear token and fetch a fresh one (called on 401). */
export async function refreshToken(): Promise<string> {
    clearToken();
    tokenPromise = null;
    return getToken();
}
