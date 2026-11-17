/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import { Message } from '../../types';

const base: Message = { id: 'm1', role: 'model', text: 'Hello there', timestamp: 0 };

describe('MessageBubble tool chips', () => {
    afterEach(cleanup);

    it('renders a chip per tool call with name and status', () => {
        render(
            <MessageBubble
                message={{
                    ...base,
                    toolCalls: [
                        { id: 'a', name: 'get_weather', status: 'ok', summary: '12C' },
                        { id: 'b', name: 'lookup', status: 'failed', summary: 'not found' },
                        { id: 'c', name: 'search', status: 'running' },
                    ],
                }}
            />,
        );

        const chips = screen.getAllByTestId('tool-chip');
        expect(chips).toHaveLength(3);
        expect(within(chips[0]).getByText('get_weather')).toBeTruthy();
        expect(within(chips[0]).getByText('ok')).toBeTruthy();
        expect(chips[0].getAttribute('data-status')).toBe('ok');
        expect(within(chips[1]).getByText('failed')).toBeTruthy();
        expect(chips[1].getAttribute('data-status')).toBe('failed');
        expect(chips[1].getAttribute('title')).toBe('not found');
        expect(chips[2].getAttribute('data-status')).toBe('running');
    });

    it('renders nothing extra when there are no tool calls', () => {
        const { container: without } = render(<MessageBubble message={base} />);
        expect(screen.queryByTestId('tool-chip')).toBeNull();
        expect(screen.queryByLabelText('Tools used')).toBeNull();
        const htmlWithout = without.innerHTML;
        cleanup();

        const { container: empty } = render(<MessageBubble message={{ ...base, toolCalls: [] }} />);
        expect(screen.queryByLabelText('Tools used')).toBeNull();
        expect(empty.innerHTML).toBe(htmlWithout);
    });

    it('does not render chips on user messages', () => {
        render(
            <MessageBubble
                message={{ ...base, role: 'user', toolCalls: [{ id: 'a', name: 'x', status: 'ok' }] }}
            />,
        );
        expect(screen.queryByTestId('tool-chip')).toBeNull();
    });
});
