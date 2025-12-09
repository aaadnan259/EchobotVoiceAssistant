import { useState, useEffect, useRef } from 'react';

export const useAudioAnalyzer = (isListening: boolean, isSpeaking: boolean) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // cleanup function
  const cleanupAudio = () => {
    if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
  };

  useEffect(() => {
    // Handle Microphone Analysis (Real)
    if (isListening) {
      const startMic = async () => {
        try {
          cleanupAudio(); // Ensure clean start

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          
          const ctx = audioContextRef.current;
          
          // Initialize analyser
          if (!analyserRef.current) {
            analyserRef.current = ctx.createAnalyser();
            analyserRef.current.fftSize = 64; 
            analyserRef.current.smoothingTimeConstant = 0.8;
          }
          
          sourceRef.current = ctx.createMediaStreamSource(stream);
          sourceRef.current.connect(analyserRef.current);
          
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          const update = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Calculate volume
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            
            // Normalize typical speech volume (0-255 -> 0-1)
            // Boosting the signal slightly for better visual effect
            const normalized = Math.min(1, (avg / 60)); 
            setAudioLevel(normalized);
            
            rafRef.current = requestAnimationFrame(update);
          };
          update();
        } catch (e) {
          console.error("Mic access failed for visualizer", e);
        }
      };
      startMic();
    } else {
      cleanupAudio();
      if (!isSpeaking) setAudioLevel(0);
    }

    return cleanupAudio;
  }, [isListening]);

  // Handle TTS Emulation (Simulated)
  useEffect(() => {
    if (isSpeaking && !isListening) {
        const updateEmulation = () => {
            const time = Date.now() / 150;
            // More organic pulse calculation using multiple sine waves
            const val = (Math.sin(time) * 0.5 + Math.cos(time * 2.3) * 0.3 + Math.sin(time * 0.5) * 0.2);
            // Base level + random fluctuation
            setAudioLevel(0.2 + Math.abs(val) * 0.5);
            rafRef.current = requestAnimationFrame(updateEmulation);
        };
        updateEmulation();
    } else if (!isSpeaking && !isListening) {
         setAudioLevel(0);
         if (rafRef.current && !isListening) cancelAnimationFrame(rafRef.current);
    }
  }, [isSpeaking, isListening]);

  return audioLevel;
};