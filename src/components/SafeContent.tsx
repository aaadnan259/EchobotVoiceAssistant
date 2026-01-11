import React, { useMemo } from 'react';
import { sanitizeRichText, escapeHtml, sanitizeUrl } from '../utils/sanitize';

interface SafeTextProps {
    /** The text content to render safely */
    content: string;
    /** Whether to allow basic HTML formatting (default: false) */
    allowFormatting?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Renders text content safely, preventing XSS attacks.
 * 
 * By default, escapes all HTML. If allowFormatting is true,
 * allows basic formatting tags like <b>, <i>, <a>, etc.
 */
export const SafeText: React.FC<SafeTextProps> = ({
    content,
    allowFormatting = false,
    className = ''
}) => {
    const sanitizedContent = useMemo(() => {
        if (!content) return '';

        if (allowFormatting) {
            return sanitizeRichText(content);
        }

        // For plain text, escape HTML entities
        return escapeHtml(content);
    }, [content, allowFormatting]);

    if (allowFormatting) {
        // Render as HTML (already sanitized)
        return (
            <span
                className={className}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
        );
    }

    // Render as plain text (React auto-escapes)
    return <span className={className}>{content}</span>;
};

interface SafeLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Renders a link safely, preventing javascript: and other dangerous URLs
 */
export const SafeLink: React.FC<SafeLinkProps> = ({
    href,
    children,
    className = ''
}) => {
    const safeHref = useMemo(() => sanitizeUrl(href), [href]);

    if (!safeHref) {
        // Return text without link if URL is unsafe
        return <span className={className}>{children}</span>;
    }

    return (
        <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            {children}
        </a>
    );
};

interface SafeImageProps {
    src: string;
    alt: string;
    className?: string;
    onError?: () => void;
}

/**
 * Renders an image safely, validating the source
 */
export const SafeImage: React.FC<SafeImageProps> = ({
    src,
    alt,
    className = '',
    onError
}) => {
    const safeSrc = useMemo(() => {
        // Allow data URIs for images
        if (src.startsWith('data:image/')) {
            return src;
        }
        // Sanitize regular URLs
        return sanitizeUrl(src);
    }, [src]);

    if (!safeSrc) {
        return null;
    }

    return (
        <img
            src={safeSrc}
            alt={escapeHtml(alt)}
            className={className}
            onError={onError}
            loading="lazy"
        />
    );
};

export default {
    SafeText,
    SafeLink,
    SafeImage
};
