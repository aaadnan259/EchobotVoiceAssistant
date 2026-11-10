/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DownloadsModal, DOWNLOADS } from '../DownloadsModal';

describe('DownloadsModal', () => {
    afterEach(cleanup);

    it('renders nothing when closed', () => {
        const { container } = render(<DownloadsModal isOpen={false} onClose={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    it('links every item to its file on the site', () => {
        render(<DownloadsModal isOpen onClose={() => {}} />);
        for (const d of DOWNLOADS) {
            const link = screen.getByRole('link', { name: `Download ${d.title}` });
            expect(link.getAttribute('href')).toBe(
                `/downloads/${d.file}`,
            );
        }
    });

    it('closes on Escape and on the backdrop, not on the dialog', () => {
        const onClose = vi.fn();
        render(<DownloadsModal isOpen onClose={onClose} />);
        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('dialog').parentElement!);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
