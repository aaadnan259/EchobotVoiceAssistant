import DOMPurify from 'dompurify';

/**
 * Sanitization configuration for different contexts
 */
const SANITIZE_CONFIG = {
    // For plain text - strips ALL HTML
    text: {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    },

    // For markdown/rich content - allows safe formatting tags
    richText: {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'a', 'span', 'div', 'img'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'title'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'], // Allow target for links
        FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    },

    // For code blocks - escape everything
    code: {
        ALLOWED_TAGS: ['code', 'pre', 'span'],
        ALLOWED_ATTR: ['class'],
    }
};

/**
 * Sanitize plain text input - removes all HTML
 */
export function sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.text as any);
}

/**
 * Sanitize rich text/markdown content - allows safe formatting
 */
export function sanitizeRichText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Configure DOMPurify to open links in new tab safely
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    const clean = DOMPurify.sanitize(input, SANITIZE_CONFIG.richText as any);

    // Remove the hook to avoid memory leaks
    DOMPurify.removeHook('afterSanitizeAttributes');

    return clean;
}

/**
 * Sanitize code content
 */
export function sanitizeCode(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.code as any);
}

/**
 * Escape HTML entities for safe display as text
 * Use this when you want to SHOW HTML as text, not render it
 */
export function escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return input.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}

/**
 * Sanitize URL to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';

    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.some(protocol => trimmed.startsWith(protocol))) {
        // Exception for image data URIs which are handled separately/safely usually,
        // but here we block generic data: to be safe. SafeImage handles valid image data URIs.
        return '';
    }

    // Allow relative URLs and safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    const hasProtocol = safeProtocols.some(protocol => trimmed.startsWith(protocol));
    const isRelative = trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../');
    const isAnchor = trimmed.startsWith('#');

    if (hasProtocol || isRelative || isAnchor) {
        return url;
    }

    // If no protocol, assume https
    if (!trimmed.includes('://')) {
        return `https://${url}`;
    }

    return '';
}

/**
 * Sanitize data for localStorage storage
 * Validates and cleans data before storing
 */
export function sanitizeForStorage<T>(data: T, maxSize: number = 5 * 1024 * 1024): T | null {
    try {
        const serialized = JSON.stringify(data);

        // Check size limit (default 5MB)
        if (serialized.length > maxSize) {
            console.warn('Data exceeds storage size limit');
            return null;
        }

        // Parse and return to ensure valid JSON
        return JSON.parse(serialized);
    } catch (e) {
        console.error('Failed to sanitize data for storage:', e);
        return null;
    }
}

/**
 * Sanitize message content specifically
 * This is the main function to use for chat messages
 */
export function sanitizeMessage(text: string): string {
    if (!text || typeof text !== 'string') return '';

    // For chat messages, we want to preserve the text but prevent XSS
    // We escape HTML rather than stripping it, so code examples remain visible
    return escapeHtml(text);
}

/**
 * Sanitize base64 image data
 * Validates that the string is a proper base64 data URI for images
 */
export function sanitizeImageDataUri(dataUri: string): string | null {
    if (!dataUri || typeof dataUri !== 'string') return null;

    // Validate data URI format
    const dataUriRegex = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;

    if (!dataUriRegex.test(dataUri)) {
        // Try a more lenient check for valid base64 image
        if (!dataUri.startsWith('data:image/')) {
            console.warn('Invalid image data URI');
            return null;
        }
    }

    // Additional size check (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (dataUri.length > maxSize) {
        console.warn('Image data URI exceeds size limit');
        return null;
    }

    return dataUri;
}

export default {
    sanitizeText,
    sanitizeRichText,
    sanitizeCode,
    escapeHtml,
    sanitizeUrl,
    sanitizeForStorage,
    sanitizeMessage,
    sanitizeImageDataUri
};
