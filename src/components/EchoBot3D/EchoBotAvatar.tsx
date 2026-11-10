import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import Orb from '../Orb';
import { OrbState } from '../../types';
import type { EchoBotSceneProps } from './EchoBotScene';
import type { BotMood } from '../../utils/botMood';

interface EchoBotAvatarProps {
    state: OrbState;
    scrollProgress: number;
    audioLevel?: number;
    reaction?: { mood: BotMood; key: string } | null;
}

/** True when the browser can draw WebGL and the visitor hasn't asked for reduced motion. */
export function canUse3D(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
        if (typeof window.WebGLRenderingContext === 'undefined') return false;
        const c = document.createElement('canvas');
        const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
        if (!gl) return false;
        gl.getExtension('WEBGL_lose_context')?.loseContext();   // free the probe context right away
        return true;
    } catch {
        return false;
    }
}

// three.js (~150 KB gzipped) and the model only download when the 3D bot is actually shown.
// If the chunk can't load (offline, flaky network), report it and fall back to the classic orb.
const EchoBotScene = lazy(() =>
    import('./EchoBotScene').catch(() => ({
        default: ({ onError }: EchoBotSceneProps) => {
            useEffect(() => onError(new Error('3D chunk failed to load')), [onError]);
            return null;
        },
    })),
);

/**
 * EchoBot's face on the chat screen: the interactive 3D mascot, with the classic SVG orb
 * shown while it loads and kept as the fallback (no WebGL, reduced motion, load errors).
 * Drop-in replacement for <Orb>: same props, same footprint in the layout.
 */
const EchoBotAvatar: React.FC<EchoBotAvatarProps> = ({ state, scrollProgress, audioLevel = 0, reaction = null }) => {
    const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>(() => (canUse3D() ? 'loading' : 'fallback'));
    const [orbVisible, setOrbVisible] = useState(true);

    const onReady = useCallback(() => setMode((m) => (m === 'fallback' ? m : 'ready')), []);
    const onError = useCallback((e: unknown) => {
        console.warn('EchoBot 3D unavailable, using the classic orb', e);
        setMode('fallback');
        setOrbVisible(true);
    }, []);

    // let the 3D bot fade in over the orb, then stop rendering the orb
    useEffect(() => {
        if (mode !== 'ready') return;
        const t = setTimeout(() => setOrbVisible(false), 600);
        return () => clearTimeout(t);
    }, [mode]);

    // shrink toward the top as the chat scrolls, so it covers less text
    // (it stays below the top bar, which overlaps the top of the chat area)
    const p = Math.min(1, Math.max(0, scrollProgress || 0));
    const shrink = { transform: `scale(${1 - p * 0.45})`, transformOrigin: '50% 0%' };

    return (
        <div
            className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center transition-transform duration-200 ease-out"
            style={shrink}
            data-testid="echobot-avatar"
        >
            {orbVisible && (
                <div
                    className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                    style={{ opacity: mode === 'ready' ? 0 : 1 }}
                >
                    <Orb state={state} scrollProgress={scrollProgress} audioLevel={audioLevel} />
                </div>
            )}
            {mode !== 'fallback' && (
                // a little bigger than the orb's box so the echo rings and hops have room, without moving the layout
                <div className="absolute -inset-8 md:-inset-10">
                    <Suspense fallback={null}>
                        <EchoBotScene state={state} audioLevel={audioLevel} reaction={reaction} onReady={onReady} onError={onError} />
                    </Suspense>
                </div>
            )}
        </div>
    );
};

export default EchoBotAvatar;
