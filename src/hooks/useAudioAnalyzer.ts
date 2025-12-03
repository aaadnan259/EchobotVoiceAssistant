import { useState, useEffect, useRef } from 'react';

export const useAudioAnalyzer = (isActive: boolean) => {
    const [audioLevel, setAudioLevel] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isActive) {
            // Cleanup
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
            if (audioContextRef.current) audioContextRef.current.close();

            audioContextRef.current = null;
            analyserRef.current = null;
            sourceRef.current = null;
            setAudioLevel(0);
            return;
        }

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;

                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                audioContextRef.current = audioContext;
                analyserRef.current = analyser;
                sourceRef.current = source;

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const updateLevel = () => {
                    analyser.getByteFrequencyData(dataArray);

                    // Calculate average volume
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;

                    // Normalize to 0-1 range (approximate)
                    // Typical speech might be around 30-100, so we divide by ~128 but clamp
                    const normalized = Math.min(average / 100, 1);

                    setAudioLevel(normalized);
                    rafRef.current = requestAnimationFrame(updateLevel);
                };

                updateLevel();

            } catch (error) {
                console.error("Error initializing audio analyzer:", error);
            }
        };

        initAudio();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [isActive]);

    return audioLevel;
};
