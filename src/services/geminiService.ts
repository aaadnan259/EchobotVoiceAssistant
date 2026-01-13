import { Message } from "../types";
import { logger } from "../utils/logger";

/**
 * Streams a response from Gemini via the backend proxy.
 * This keeps the API key secure on the server side.
 * 
 * @param modelName - The Gemini model to use (e.g., "gemini-2.0-flash")
 * @param systemInstruction - System prompt for the AI
 * @param history - Previous messages in the conversation
 * @param newMessage - The new user message
 * @param image - Optional base64 data URI of an image
 * @returns An async generator that yields text chunks
 */
export async function* streamGeminiResponse(
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  images?: string[] // Changed from single image
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelName,
      systemInstruction,
      history: history.map(msg => ({
        role: msg.role,
        text: msg.text,
        images: msg.images, // Pass array
        image: msg.image    // Pass legacy too just in case
      })),
      newMessage,
      images
    }),
  });

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
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.text) {
              yield data.text;
            }

            if (data.done) {
              return;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            logger.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming version for simpler use cases.
 * Returns the complete response at once.
 */
export async function getGeminiResponse(
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  image?: string
): Promise<string> {
  const response = await fetch('/api/gemini/chat-simple', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelName,
      systemInstruction,
      history: history.map(msg => ({
        role: msg.role,
        text: msg.text,
        image: msg.image
      })),
      newMessage,
      image
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Wrapper that mimics the old API structure for easier migration.
 * Returns an object with an async iterator, similar to the Gemini SDK.
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

  // Return an object that mimics the Gemini SDK response structure
  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        const result = await generator.next();
        if (result.done) {
          return { done: true, value: undefined };
        }
        // Mimic the chunk structure from the Gemini SDK
        return {
          done: false,
          value: {
            text: () => result.value
          }
        };
      }
    })
  };
};