/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MessageBubble } from '../../MessageBubble';
import { BotFace } from '../BotFace';
import type { Message } from '../../../types';

const botMsg = (extra: Partial<Message> = {}): Message => ({ id: 'm1', role: 'model', text: 'Hi!', timestamp: 0, ...extra });
const moodOf = (container: HTMLElement) => container.querySelector('img[data-mood]')?.getAttribute('data-mood');

describe('EchoBot faces', () => {
    afterEach(cleanup);

    it('bot replies show the happy face', () => {
        const { container } = render(React.createElement(MessageBubble, { message: botMsg() }));
        expect(moodOf(container)).toBe('happy');
    });

    it('a reply still being written shows the talking face', () => {
        const { container } = render(React.createElement(MessageBubble, { message: botMsg(), isStreaming: true }));
        expect(moodOf(container)).toBe('talking');
    });

    it('error replies show the sad face', () => {
        const { container } = render(React.createElement(MessageBubble, { message: botMsg({ isError: true }) }));
        expect(moodOf(container)).toBe('sad');
    });

    it('user messages have no bot face', () => {
        const { container } = render(React.createElement(MessageBubble, { message: botMsg({ role: 'user' }) }));
        expect(moodOf(container)).toBeUndefined();
    });

    it('a labelled face is announced, a decorative one is hidden', () => {
        const { container } = render(React.createElement('div', null,
            React.createElement(BotFace, { label: 'EchoBot' }),
            React.createElement(BotFace, { mood: 'happy' })));
        const [a, b] = Array.from(container.querySelectorAll('img'));
        expect(a.getAttribute('alt')).toBe('EchoBot');
        expect(b.getAttribute('aria-hidden')).toBe('true');
    });
});
