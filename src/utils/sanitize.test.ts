// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeRichText, sanitizeImageDataUri } from './sanitize';

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
