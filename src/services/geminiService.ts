import { Message } from "../types";
import { logger } from "../utils/logger";
import { getToken } from "./sessionService";

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
  const token = await getToken();
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      modelName,
      systemInstruction,
      history: history.map(msg => ({
        role: msg.role,
        text: msg.text
      })),
      newMessage,
      images
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const { refreshToken } = await import('./sessionService');
      refreshToken().catch(e => logger.error('Background token refresh failed', e));
    }
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
  image?: string
): Promise<string> {
  const token = await getToken();
  const response = await fetch('/api/gemini/chat-simple', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      modelName,
      systemInstruction,
      history: history.map(msg => ({
        role: msg.role,
        text: msg.text
      })),
      newMessage,
      image
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const { refreshToken } = await import('./sessionService');
      refreshToken().catch(e => logger.error('Background token refresh failed', e));
    }
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
  image?: string
) => {
  const generator = streamGeminiResponse(
    modelName,
    systemInstruction,
    history,
    newMessage,
    image
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