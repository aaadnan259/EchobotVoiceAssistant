// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeRichText, sanitizeUrl, sanitizeImageDataUri, sanitizeText } from './sanitize';

describe('sanitizeText', () => {
    it('should return empty string for null/undefined/non-string input', () => {
        expect(sanitizeText(null as any)).toBe('');
        expect(sanitizeText(undefined as any)).toBe('');
        expect(sanitizeText(123 as any)).toBe('');
    });

    it('should strip all HTML tags', () => {
        const input = '<p>Paragraph</p><b>Bold</b>';
        expect(sanitizeText(input)).toBe('ParagraphBold');
    });

    it('should handle nested tags', () => {
        const input = '<div><p>Nested</p></div>';
        expect(sanitizeText(input)).toBe('Nested');
    });

    it('should strip attributes', () => {
        const input = '<a href="https://example.com" class="link">Link</a>';
        expect(sanitizeText(input)).toBe('Link');
    });

    it('should strip script tags and their content', () => {
        const input = '<script>alert("xss")</script>';
        expect(sanitizeText(input)).toBe('');
    });

    it('should handle malformed HTML', () => {
        const input = '<p>Text';
        expect(sanitizeText(input)).toBe('Text');
    });

    it('should preserve plain text', () => {
        const input = 'Just plain text';
        expect(sanitizeText(input)).toBe('Just plain text');
    });

    it('should handle HTML entities', () => {
        const input = '&lt;p&gt;Text&lt;/p&gt;';
        // Entities representing tags should be treated as text and preserved
        expect(sanitizeText(input)).toBe(input);
    });
});

describe('sanitizeRichText', () => {
    it('should return empty string for null/undefined/non-string input', () => {
        expect(sanitizeRichText(null as any)).toBe('');
        expect(sanitizeRichText(undefined as any)).toBe('');
        expect(sanitizeRichText(123 as any)).toBe('');
    });

    it('should allow safe tags', () => {
        const input = '<p>Paragraph</p><b>Bold</b><i>Italic</i><strong>Strong</strong><em>Em</em><br/>';
        // DOMPurify might normalize <br/> to <br> or keep it.
        // Let's be flexible or check specifically.
        const output = sanitizeRichText(input);
        expect(output).toContain('<p>Paragraph</p>');
        expect(output).toContain('<b>Bold</b>');
        expect(output).toContain('<i>Italic</i>');
        expect(output).toContain('<strong>Strong</strong>');
        expect(output).toContain('<em>Em</em>');
    });

    it('should strip unsafe tags', () => {
        const input = '<script>alert("xss")</script><iframe></iframe><object></object><embed>';
        expect(sanitizeRichText(input)).toBe('');
    });

    it('should allow safe attributes', () => {
        const input = '<a href="https://example.com" class="link">Link</a>';
        const output = sanitizeRichText(input);
        expect(output).toContain('href="https://example.com"');
        expect(output).toContain('class="link"');
    });

    it('should strip unsafe attributes', () => {
        const input = '<p onclick="alert(1)" onmouseover="evil()">Text</p>';
        expect(sanitizeRichText(input)).toBe('<p>Text</p>');
    });

    it('should add target="_blank" and rel="noopener noreferrer" to links', () => {
        const input = '<a href="https://example.com">Link</a>';
        const output = sanitizeRichText(input);
        expect(output).toContain('target="_blank"');
        expect(output).toContain('rel="noopener noreferrer"');
    });

    it('should handle headers', () => {
        const input = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
        expect(sanitizeRichText(input)).toBe(input);
    });

    it('should handle lists', () => {
        const input = '<ul><li>Item 1</li></ul><ol><li>Item 2</li></ol>';
        expect(sanitizeRichText(input)).toBe(input);
    });

    it('should handle blockquotes and code blocks', () => {
        const input = '<blockquote>Quote</blockquote><pre><code>Code</code></pre>';
        expect(sanitizeRichText(input)).toBe(input);
    });

    it('should sanitize javascript: links', () => {
        const input = '<a href="javascript:alert(1)">Click me</a>';
        const output = sanitizeRichText(input);
        expect(output).not.toContain('javascript:');
        expect(output).not.toContain('alert(1)');
    });

    it('should allow div, span, u, s tags', () => {
        const input = '<div>Div</div><span>Span</span><u>Underline</u><s>Strikethrough</s>';
        const output = sanitizeRichText(input);
        expect(output).toContain('<div>Div</div>');
        expect(output).toContain('<span>Span</span>');
        expect(output).toContain('<u>Underline</u>');
        expect(output).toContain('<s>Strikethrough</s>');
    });

    it('should strip data attributes', () => {
        const input = '<div data-test="test">Div</div>';
        const output = sanitizeRichText(input);
        expect(output).toBe('<div>Div</div>');
    });
});

describe('sanitizeUrl', () => {
    it('should return empty string for null/undefined/non-string input', () => {
        expect(sanitizeUrl(null as any)).toBe('');
        expect(sanitizeUrl(undefined as any)).toBe('');
        expect(sanitizeUrl(123 as any)).toBe('');
    });

    it('should return original url if it starts with safe protocol', () => {
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
        expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
        expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
    });

    it('should return original url if it is relative or anchor', () => {
        expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
        expect(sanitizeUrl('./path/to/resource')).toBe('./path/to/resource');
        expect(sanitizeUrl('../path/to/resource')).toBe('../path/to/resource');
        expect(sanitizeUrl('#anchor')).toBe('#anchor');
    });

    it('should prepend https:// if no protocol is present', () => {
        expect(sanitizeUrl('example.com')).toBe('https://example.com');
        expect(sanitizeUrl('www.google.com')).toBe('https://www.google.com');
    });

    it('should return empty string for dangerous protocols', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('');
        expect(sanitizeUrl('data:text/html,alert(1)')).toBe('');
        expect(sanitizeUrl('vbscript:alert(1)')).toBe('');
        expect(sanitizeUrl('file:///etc/passwd')).toBe('');
    });

    it('should handle case insensitivity for dangerous protocols', () => {
        expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
        expect(sanitizeUrl('Data:text/html,alert(1)')).toBe('');
    });

    it('should handle whitespace around url', () => {
        expect(sanitizeUrl('  javascript:alert(1)  ')).toBe('');
        expect(sanitizeUrl('  http://example.com  ')).toBe('  http://example.com  '); // trimmed check, but returns original?
        // Wait, implementation:
        // const trimmed = url.trim().toLowerCase();
        // if (hasProtocol...) return url;
        // So it returns the UNTRIMMED url.
    });

    it('should return empty string for unknown protocols with ://', () => {
        // 'ftp://example.com' - ftp is not in safeProtocols.
        // trimmed includes '://'.
        // So it returns ''.
        expect(sanitizeUrl('ftp://example.com')).toBe('');
    });

    it('should be robust against bypass attempts', () => {
        // javascript :alert(1) - space before colon. Not a valid protocol.
        // Should be treated as domain/path and prepended with https:// or kept if relative?
        // 'javascript :alert(1)'.trim().toLowerCase() = 'javascript :alert(1)'
        // No protocol match.
        // No :// match.
        // Returns https://javascript :alert(1). Safe.
        expect(sanitizeUrl('javascript :alert(1)')).toBe('https://javascript :alert(1)');
    });
});

describe('sanitizeImageDataUri', () => {
    it('should validate valid PNG data URI', () => {
        const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        expect(sanitizeImageDataUri(validPng)).toBe(validPng);
    });

    it('should validate valid JPEG data URI', () => {
        const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
        expect(sanitizeImageDataUri(validJpeg)).toBe(validJpeg);
    });

    it('should validate valid GIF data URI', () => {
        const validGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        expect(sanitizeImageDataUri(validGif)).toBe(validGif);
    });

    it('should validate valid WEBP data URI', () => {
        const validWebp = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
        expect(sanitizeImageDataUri(validWebp)).toBe(validWebp);
    });

    it('should validate valid SVG data URI', () => {
        const validSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';
        expect(sanitizeImageDataUri(validSvg)).toBe(validSvg);
    });

    it('should return null for null/undefined/empty input', () => {
        expect(sanitizeImageDataUri(null as any)).toBeNull();
        expect(sanitizeImageDataUri(undefined as any)).toBeNull();
        expect(sanitizeImageDataUri('')).toBeNull();
    });

    it('should return null for non-string input', () => {
        expect(sanitizeImageDataUri(123 as any)).toBeNull();
        expect(sanitizeImageDataUri({} as any)).toBeNull();
    });

    it('should return null for invalid MIME type', () => {
        const invalidMime = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
        expect(sanitizeImageDataUri(invalidMime)).toBeNull();
    });

    it('should return null for string not starting with data:image/', () => {
        const invalidStart = 'https://example.com/image.png';
        expect(sanitizeImageDataUri(invalidStart)).toBeNull();
    });

    it('should accept lenient base64 if it starts with data:image/', () => {
        // The regex checks for strict base64, but the fallback allows any content as long as it starts with data:image/
        // and passes the size check.
        // This test verifies the fallback behavior.
        const lenient = 'data:image/png;base64,not-strictly-valid-base64-but-accepted-by-lenient-check';
        expect(sanitizeImageDataUri(lenient)).toBe(lenient);
    });

    it('should enforce size limit (10MB)', () => {
        const maxSize = 10 * 1024 * 1024;

        // Create a string slightly larger than 10MB
        // "data:image/png;base64," is 22 chars.
        // We need 10MB + 1 byte total length.
        const header = 'data:image/png;base64,';
        const largePayload = 'a'.repeat(maxSize - header.length + 1);
        const tooLarge = header + largePayload;

        expect(sanitizeImageDataUri(tooLarge)).toBeNull();

        // Create a string slightly smaller than 10MB
        const safePayload = 'a'.repeat(maxSize - header.length - 1);
        const safe = header + safePayload;
        expect(sanitizeImageDataUri(safe)).toBe(safe);
    });
});
