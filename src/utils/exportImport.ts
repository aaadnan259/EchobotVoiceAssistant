import { Message, Conversation } from '../types';
import { sanitizeMessage } from './sanitize';

export interface ExportOptions {
    includeImages: boolean;
    dateRange?: { start: number; end: number };
}

export type ExportFormat = 'json' | 'markdown' | 'html';

/**
 * Filter messages based on options
 */
const filterMessages = (messages: Message[], options?: ExportOptions): Message[] => {
    let filtered = [...messages];

    if (options?.dateRange) {
        filtered = filtered.filter(
            m => m.timestamp >= options.dateRange!.start && m.timestamp <= options.dateRange!.end
        );
    }

    // Note: Image exclusion is handled during formatting or sanitization
    // We can strip them here if needed, but easier to do in formatting

    return filtered;
};

/**
 * Generate a JSON string for the full conversation tree (Backup)
 */
export const generateJSON = (conversation: Conversation, options?: ExportOptions): string => {
    // If excluding images, deep clone and strip
    if (options && !options.includeImages) {
        const clone = JSON.parse(JSON.stringify(conversation)) as Conversation;
        Object.values(clone.messages).forEach(msg => {
            delete msg.image;
        });
        return JSON.stringify(clone, null, 2);
    }
    return JSON.stringify(conversation, null, 2);
};

/**
 * Generate Markdown for a linear message history
 */
export const generateMarkdown = (messages: Message[], options?: ExportOptions): string => {
    const filtered = filterMessages(messages, options);
    const date = new Date().toLocaleDateString();

    let md = `# EchoBot Conversation\nExported: ${date}\n\n`;

    filtered.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const roleName = msg.role === 'user' ? 'You' : 'EchoBot';

        md += `## ${roleName} (${time})\n\n`;

        if (msg.image && options?.includeImages) {
            md += `![Attached Image](${msg.image})\n\n`;
        } else if (msg.image && !options?.includeImages) {
            md += `*[Image attachment excluded]*\n\n`;
        }

        // Sanitize text slightly to prevent breaking MD structure if needed, 
        // though usually raw text is fine unless it has unclosed code blocks.
        md += `${msg.text}\n\n`;

        if (msg.role === 'model' && msg.reactions) {
            const reactions = [];
            if (msg.reactions.thumbsUp) reactions.push('👍');
            if (msg.reactions.thumbsDown) reactions.push('👎');
            if (msg.reactions.starred) reactions.push('⭐');
            if (reactions.length) md += `Reaction: ${reactions.join(' ')}\n\n`;
        }

        md += `---\n\n`;
    });

    return md;
};

/**
 * Generate HTML for a linear message history
 */
export const generateHTML = (messages: Message[], options?: ExportOptions): string => {
    const filtered = filterMessages(messages, options);
    const date = new Date().toLocaleDateString();

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EchoBot Conversation ${date}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #f9f9f9; color: #333; }
    .message { margin-bottom: 2rem; padding: 1.5rem; border-radius: 8px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .user { border-left: 4px solid #6366f1; }
    .model { border-left: 4px solid #a855f7; }
    .header { font-size: 0.875rem; color: #666; margin-bottom: 0.5rem; font-weight: bold; }
    .content { line-height: 1.6; white-space: pre-wrap; }
    .image { max-width: 100%; border-radius: 4px; margin-top: 0.5rem; }
    .reaction { font-size: 1.25rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>EchoBot Conversation</h1>
  <p>Exported: ${date}</p>
  <hr style="margin: 2rem 0; border: none; border-top: 1px solid #ddd;">
`;

    filtered.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const roleName = msg.role === 'user' ? 'You' : 'EchoBot';
        const msgClass = msg.role;

        html += `  <div class="message ${msgClass}">\n`;
        html += `    <div class="header">${roleName} • ${time}</div>\n`;

        if (msg.image && options?.includeImages) {
            html += `    <img src="${msg.image}" alt="Attachment" class="image" />\n`;
        } else if (msg.image && !options?.includeImages) {
            html += `    <div style="color: #999; font-style: italic;">[Image attachment excluded]</div>\n`;
        }

        // Basic HTML escaping for text
        const escapedText = msg.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        html += `    <div class="content">${escapedText}</div>\n`;

        if (msg.role === 'model' && msg.reactions) {
            const reactions = [];
            if (msg.reactions.thumbsUp) reactions.push('👍');
            if (msg.reactions.thumbsDown) reactions.push('👎');
            if (msg.reactions.starred) reactions.push('⭐');
            if (reactions.length) html += `    <div class="reaction">${reactions.join(' ')}</div>\n`;
        }

        html += `  </div>\n`;
    });

    html += `</body></html>`;
    return html;
};

/**
 * Validate imported JSON data
 */
export const validateImport = (data: any): data is Conversation => {
    if (!data || typeof data !== 'object') return false;

    // Basic structural check for V2 format
    const hasMessages = data.messages && typeof data.messages === 'object';
    const hasBranches = data.branches && typeof data.branches === 'object';
    const hasActiveBranch = typeof data.activeBranchId === 'string';

    if (hasMessages && hasBranches && hasActiveBranch) return true;

    // Check for legacy V1 format (array of messages)
    if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].text) {
        return true; // We will handle migration in the hook
    }

    // Empty array is also valid legacy
    if (Array.isArray(data) && data.length === 0) return true;

    return false;
};
