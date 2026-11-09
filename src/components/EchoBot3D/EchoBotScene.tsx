import React, { useEffect, useRef, useState } from 'react';
import { OrbState } from '../../types';
import { EchoBotEngine } from './echobotEngine';
import glbUrl from '../../assets/echobot/echobot.glb?url';

export interface EchoBotSceneProps {
    state: OrbState;
    audioLevel: number;
    onReady: () => void;
    onError: (e: unknown) => void;
}

/**
 * The 3D canvas. Loaded lazily (three.js is only downloaded when this renders).
 * The canvas ignores the mouse except while the pointer is over EchoBot's body,
 * so chat messages scrolling underneath stay clickable.
 */
const EchoBotScene: React.FC<EchoBotSceneProps> = ({ state, audioLevel, onReady, onError }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<EchoBotEngine | null>(null);
    const [ready, setReady] = useState(false);
    const [hover, setHover] = useState(false);
    const cbs = useRef({ onReady, onError });
    cbs.current = { onReady, onError };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let engine: EchoBotEngine;
        try {
            engine = new EchoBotEngine(canvas, glbUrl, {
                onReady: () => { setReady(true); cbs.current.onReady(); },
                onError: (e) => cbs.current.onError(e),
            });
        } catch (e) {
            cbs.current.onError(e);
            return;
        }
        engineRef.current = engine;

        const ro = new ResizeObserver(() => engine.resize(canvas.clientWidth, canvas.clientHeight));
        ro.observe(canvas);
        engine.resize(canvas.clientWidth, canvas.clientHeight);

        const onMove = (e: PointerEvent) => {
            engine.pointerMove(e.clientX, e.clientY);
            if (e.pointerType === 'mouse') setHover(engine.isHovered);
        };
        // taps on touch screens never hover, so hit-test on the way down
        const onDown = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse' && engine.hitTest(e.clientX, e.clientY)) engine.poke();
        };
        const onKey = () => engine.activity('key');
        const onOther = () => engine.activity();
        const onLost = (e: Event) => { e.preventDefault(); cbs.current.onError(new Error('WebGL context lost')); };

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onDown, { passive: true });
        window.addEventListener('keydown', onKey);
        window.addEventListener('wheel', onOther, { passive: true });
        canvas.addEventListener('webglcontextlost', onLost);

        return () => {
            ro.disconnect();
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('wheel', onOther);
            canvas.removeEventListener('webglcontextlost', onLost);
            engine.dispose();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => { engineRef.current?.setState(state); }, [state]);
    useEffect(() => { engineRef.current?.setAudioLevel(audioLevel); }, [audioLevel]);

    const color = GLOW_CSS[state] ?? GLOW_CSS[OrbState.IDLE];
    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            data-testid="echobot-3d"
            onClick={(e) => { if (engineRef.current?.hitTest(e.clientX, e.clientY)) engineRef.current.poke(); }}
            className="absolute w-full h-full transition-opacity duration-500"
            style={{
                opacity: ready ? 1 : 0,
                pointerEvents: hover ? 'auto' : 'none',
                cursor: hover ? 'pointer' : 'default',
                filter: `drop-shadow(0 0 ${18 + audioLevel * 22}px ${color})`,
                touchAction: 'manipulation',
            }}
        />
    );
};

const GLOW_CSS: Record<OrbState, string> = {
    [OrbState.IDLE]: 'rgba(124, 58, 237, 0.55)',
    [OrbState.TRACKING]: 'rgba(124, 58, 237, 0.55)',
    [OrbState.LISTENING]: 'rgba(192, 132, 252, 0.7)',
    [OrbState.THINKING]: 'rgba(96, 165, 250, 0.6)',
    [OrbState.RESPONDING]: 'rgba(168, 85, 247, 0.65)',
    [OrbState.ERROR]: 'rgba(239, 68, 68, 0.6)',
};

export default EchoBotScene;
