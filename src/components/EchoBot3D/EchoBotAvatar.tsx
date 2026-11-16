import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BotFace, type BotMood as FaceMood } from './BotFace';
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
// If the chunk can't load (offline, flaky network), report it and fall back to the still image.
const EchoBotScene = lazy(() =>
    import('./EchoBotScene').catch(() => ({
        default: ({ onError }: EchoBotSceneProps) => {
            useEffect(() => onError(new Error('3D chunk failed to load')), [onError]);
            return null;
        },
    })),
);

/** Which still of the 3D bot to show for the chat state when the 3D scene isn't running. */
function stillMood(state: OrbState): FaceMood {
    if (state === OrbState.ERROR) return 'sad';
    if (state === OrbState.RESPONDING) return 'talking';
    return 'neutral';
}

/**
 * EchoBot's face on the chat screen: the interactive 3D mascot, with a still image of the
 * same bot shown while it loads and kept as the fallback (no WebGL, reduced motion, load
 * errors). The still is rendered from the same model, so a hard refresh never shows the
 * old orb before the 3D bot fades in.
 */
const EchoBotAvatar: React.FC<EchoBotAvatarProps> = ({ state, scrollProgress, audioLevel = 0, reaction = null }) => {
    const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>(() => (canUse3D() ? 'loading' : 'fallback'));
    const [stillVisible, setStillVisible] = useState(true);

    const onReady = useCallback(() => setMode((m) => (m === 'fallback' ? m : 'ready')), []);
    const onError = useCallback((e: unknown) => {
        console.warn('EchoBot 3D unavailable, using the still image', e);
        setMode('fallback');
        setStillVisible(true);
    }, []);

    // let the 3D bot fade in over the still, then stop rendering the still
    useEffect(() => {
        if (mode !== 'ready') return;
        const t = setTimeout(() => setStillVisible(false), 600);
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
            {stillVisible && (
                <div
                    className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                    style={{ opacity: mode === 'ready' ? 0 : 1 }}
                    data-testid="echobot-still"
                >
                    <BotFace mood={mode === 'fallback' ? stillMood(state) : 'neutral'} className={STILL_SIZE} />
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

// sized to match how big the bot sits in the 3D canvas, so the crossfade doesn't jump
const STILL_SIZE = 'w-28 h-28 md:w-36 md:h-36';

export default EchoBotAvatar;
