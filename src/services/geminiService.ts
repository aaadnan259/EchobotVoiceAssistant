import { Message } from "../types";
import { logger } from "../utils/logger";
import { getToken, refreshToken } from "./sessionService";

// Ensures at most one token refresh is in flight at a time, even if a 401
// from streamGeminiResponse and getGeminiResponse happen concurrently.
let refreshInFlight: Promise<string> | null = null;
function refreshTokenOnce(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = refreshToken().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/**
 * Streams response from Gemini via backend proxy.
 */
export async function* streamGeminiResponse(
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  images?: string[]
): AsyncGenerator<string, void, unknown> {
  const requestBody = JSON.stringify({
    modelName,
    systemInstruction,
    history: history.map(msg => ({
      role: msg.role,
      text: msg.text
    })),
    newMessage,
    images
  });

  const doRequest = (token: string) => fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: requestBody,
  });

  let token = await getToken();
  let response = await doRequest(token);

  if (response.status === 401) {
    try {
      token = await refreshTokenOnce();
      response = await doRequest(token);
    } catch (e) {
      logger.error('Token refresh failed after 401', e);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body received');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          // Stage 1: Parse JSON (swallow parse errors only)
          let data: any;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            logger.warn('Failed to parse SSE data:', line);
            continue;
          }

          // Stage 2: Handle data (errors propagate to caller)
          if (data.error) {
            throw new Error(data.error);
          }

          if (data.text) {
            yield data.text;
          }

          if (data.done) {
            return;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming response.
 */
export async function getGeminiResponse(
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  images?: string[]
): Promise<string> {
  const requestBody = JSON.stringify({
    modelName,
    systemInstruction,
    history: history.map(msg => ({
      role: msg.role,
      text: msg.text
    })),
    newMessage,
    images
  });

  const doRequest = (token: string) => fetch('/api/gemini/chat-simple', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: requestBody,
  });

  let token = await getToken();
  let response = await doRequest(token);

  if (response.status === 401) {
    try {
      token = await refreshTokenOnce();
      response = await doRequest(token);
    } catch (e) {
      logger.error('Token refresh failed after 401', e);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Legacy wrapper for SDK compatibility.
 */
export const streamGeminiResponseLegacy = async (
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  images?: string[]
) => {
  const generator = streamGeminiResponse(
    modelName,
    systemInstruction,
    history,
    newMessage,
    images
  );

  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        const result = await generator.next();
        return result.done
          ? { done: true, value: undefined }
          : { done: false, value: { text: () => result.value } };
      }
    })
  };
};