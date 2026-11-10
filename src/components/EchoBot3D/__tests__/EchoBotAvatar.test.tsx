/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import EchoBotAvatar, { canUse3D } from '../EchoBotAvatar';
import { OrbState } from '../../../types';

describe('EchoBotAvatar', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('falls back to the classic orb when WebGL is unavailable', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        const { container, queryByTestId } = render(
            React.createElement(EchoBotAvatar, { state: OrbState.IDLE, scrollProgress: 0, audioLevel: 0 }),
        );
        expect(queryByTestId('echobot-3d')).toBeNull();
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('skips 3D when the visitor prefers reduced motion', () => {
        (window as any).WebGLRenderingContext = function () {};
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as any);
        window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
        expect(canUse3D()).toBe(false);
        window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
        expect(canUse3D()).toBe(true);
        delete (window as any).WebGLRenderingContext;
    });
});
