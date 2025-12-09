import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

// Global constant defined in vite.config.ts
declare const __APP_API_KEY__: string;

export const streamGeminiResponse = async (
  modelName: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  image?: string // Base64 Data URI
) => {
  // Priority: 1. Injected Build Constant 2. Legacy Envs 3. Vite Envs
  const apiKey = (typeof __APP_API_KEY__ !== 'undefined' ? __APP_API_KEY__ : '') ||
    process.env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    (import.meta as any).env.VITE_GEMINI_API_KEY;

  if (!apiKey) throw new Error("Missing API Key. Please check Render Dashboard > Environment Variables.");
  const ai = new GoogleGenAI({ apiKey });

  // Format history for the API
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.text }];
    // If history has images, we can attach them. 
    if (msg.image) {
      // Extract base64 data and mime type
      const [mimeType, data] = msg.image.split(';base64,');
      parts.unshift({
        inlineData: {
          mimeType: mimeType.replace('data:', ''),
          data: data
        }
      });
    }
    return {
      role: msg.role,
      parts: parts
    };
  });

  // Construct current message parts
  const currentParts: any[] = [{ text: newMessage }];
  if (image) {
    const [mimeType, data] = image.split(';base64,');
    currentParts.unshift({
      inlineData: {
        mimeType: mimeType.replace('data:', ''),
        data: data
      }
    });
  }

  // Add the new message to contents
  contents.push({
    role: 'user',
    parts: currentParts
  });

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }], // Enable Search Grounding
      },
      contents: contents
    });

    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to communicate with the orb.");
  }
};