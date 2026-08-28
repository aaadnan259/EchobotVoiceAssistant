/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useScrollBehavior } from '../useScrollBehavior';

// Test harness: useScrollBehavior only returns refs for the caller to attach,
// so a real host component is needed to get real DOM nodes wired up before
// the hook's effects run (a bare renderHook() call has nothing to attach to).
function TestHarness({ trigger }: { trigger: any[] }) {
    const { containerRef, bottomRef } = useScrollBehavior({ scrollTriggers: trigger });
    return React.createElement(
        'div',
        { ref: containerRef, 'data-testid': 'container' },
        React.createElement('div', { style: { height: '1000px' } }),
        React.createElement('div', { ref: bottomRef, 'data-testid': 'bottom' })
    );
}

// jsdom doesn't compute real layout, so scrollHeight/clientHeight are
// read-only getters stuck at 0 - override them per test to simulate a
// scrolled state. scrollTop is a plain read/write property in jsdom already,
// but redefining it too keeps all three consistent and safe to reassign.
function setScrollMetrics(
    el: HTMLElement,
    { scrollTop, scrollHeight, clientHeight }: { scrollTop: number; scrollHeight: number; clientHeight: number }
) {
    Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
}

describe('useScrollBehavior', () => {
    let scrollIntoViewMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        scrollIntoViewMock = vi.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    });

    afterEach(() => {
        cleanup();
    });

    it('scrolls to the bottom instantly (not smoothly) on initial mount', () => {
        render(React.createElement(TestHarness, { trigger: [['a', 'b']] }));

        expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'instant' });
    });

    it('follows new content with a smooth scroll when the user is already near the bottom', () => {
        const { rerender, getByTestId } = render(React.createElement(TestHarness, { trigger: [['a']] }));
        const container = getByTestId('container');

        // Simulate the user sitting at the bottom already.
        setScrollMetrics(container, { scrollTop: 900, scrollHeight: 1000, clientHeight: 100 });
        act(() => {
            container.dispatchEvent(new Event('scroll'));
        });

        scrollIntoViewMock.mockClear();
        rerender(React.createElement(TestHarness, { trigger: [['a', 'b']] }));

        expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('does not yank the view down when the user has scrolled up to read history', () => {
        const { rerender, getByTestId } = render(React.createElement(TestHarness, { trigger: [['a']] }));
        const container = getByTestId('container');

        // Simulate the user having scrolled well away from the bottom.
        setScrollMetrics(container, { scrollTop: 0, scrollHeight: 1000, clientHeight: 100 });
        act(() => {
            container.dispatchEvent(new Event('scroll'));
        });

        scrollIntoViewMock.mockClear();
        rerender(React.createElement(TestHarness, { trigger: [['a', 'b']] }));

        expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });
});
