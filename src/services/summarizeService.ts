import { Message } from '../types';
import { getGeminiResponse } from './geminiService';
import { APP_CONFIG } from '../constants'; // Assumed to exist, or we use hardcoded model for now

export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryFocus = 'general' | 'action-items' | 'decisions';

export interface SummaryOptions {
    length: SummaryLength;
    focus: SummaryFocus;
}

const LENGTH_PROMPTS: Record<SummaryLength, string> = {
    short: 'Summarize the following conversation in 2-3 concise sentences.',
    medium: 'Provide a summary of the conversation with key points, keeping it to about 1-2 paragraphs.',
    long: 'Provide a detailed summary of the conversation, including context, important details, and nuances.'
};

const FOCUS_PROMPTS: Record<SummaryFocus, string> = {
    general: 'Focus on providing a general overview of the discussion.',
    'action-items': 'Focus specifically on identifying any action items, tasks, or next steps mentioned. Format these as a bulleted list.',
    decisions: 'Focus on identifying any decisions made, conclusions reached, or agreements established.'
};

export async function summarizeConversation(
    messages: Message[],
    options: SummaryOptions = { length: 'medium', focus: 'general' },
    modelName: string = 'gemini-2.0-flash' // Default model
): Promise<string> {
    if (!messages || messages.length === 0) {
        return 'No conversation history to summarize.';
    }

    // Filter out system messages or errors if needed, but usually we want user/model interaction
    const relevantMessages = messages.filter(m => m.role === 'user' || m.role === 'model');

    if (relevantMessages.length === 0) {
        return 'No relevant messages to summarize.';
    }

    const lengthPrompt = LENGTH_PROMPTS[options.length];
    const focusPrompt = FOCUS_PROMPTS[options.focus];

    const systemInstruction = `You are a helpful assistant tasked with summarizing a conversation. 
${lengthPrompt}
${focusPrompt}
Output the summary in Markdown format.`;

    // We act as if the summary request is a new user turn
    // But since getGeminiResponse expects a "newMessage", we can craft one.
    // Actually, we can just pass the history and ask for summary in the "newMessage".

    const summaryRequest = "Please generating the summary now based on the conversation history above.";

    try {
        const summary = await getGeminiResponse(
            modelName,
            systemInstruction,
            relevantMessages,
            summaryRequest
        );
        return summary;
    } catch (error) {
        console.error('Summarization failed:', error);
        throw new Error('Failed to generate summary. Please try again.');
    }
}
