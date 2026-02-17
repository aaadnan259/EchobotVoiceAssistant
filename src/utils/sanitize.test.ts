// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from './sanitize';

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
