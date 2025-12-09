import React, { useEffect, useRef, useState } from 'react';
import { OrbState } from '../types';

interface OrbProps {
  state: OrbState;
  scrollProgress: number; // 0 to 1, used to shrink the orb
  audioLevel?: number; // 0 to 1, volume level
}

const Orb: React.FC<OrbProps> = ({ state, scrollProgress, audioLevel = 0 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Physics-based eye tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Eye movement loop
  useEffect(() => {
    let animationFrameId: number;

    const updateEyes = () => {
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate vector to mouse
      const dx = mousePos.x - centerX;
      const dy = mousePos.y - centerY;
      
      // Limit movement radius (keep pupils inside orb)
      const maxDist = 15; // Max pixels pupils can move
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(maxDist, Math.hypot(dx, dy));

      // Target position
      const targetX = Math.cos(angle) * dist;
      const targetY = Math.sin(angle) * dist;

      // Smooth interpolation (lerp)
      setEyePos(prev => ({
        x: prev.x + (targetX - prev.x) * 0.1,
        y: prev.y + (targetY - prev.y) * 0.1
      }));

      animationFrameId = requestAnimationFrame(updateEyes);
    };

    if (state !== OrbState.ERROR && state !== OrbState.THINKING) {
      updateEyes();
    } else {
        // Reset eyes for error/thinking
        setEyePos({x: 0, y: 0});
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos, state]);

  // Determine styles based on state
  const getGlowColor = () => {
    switch (state) {
      case OrbState.LISTENING: return '#c084fc'; // Bright purple
      case OrbState.THINKING: return '#60a5fa'; // Blue
      case OrbState.RESPONDING: return '#a855f7'; // Standard Purple
      case OrbState.ERROR: return '#ef4444'; // Red
      default: return '#7c3aed'; // Deep purple
    }
  };

  const getEyeShape = () => {
    if (state === OrbState.ERROR) {
      return (
        <g transform="translate(0, 0)">
          {/* Flat eyes */}
          <rect x="-25" y="-4" width="20" height="8" rx="2" fill="white" />
          <rect x="5" y="-4" width="20" height="8" rx="2" fill="white" />
        </g>
      );
    }
    if (state === OrbState.THINKING) {
       return (
        <g className="animate-pulse">
           <circle cx="-15" cy="0" r="4" fill="white" />
           <circle cx="0" cy="0" r="4" fill="white" />
           <circle cx="15" cy="0" r="4" fill="white" />
        </g>
       );
    }
    
    // Normal Eyes
    const blinkClass = state === OrbState.IDLE ? 'animate-[blink_4s_infinite]' : '';
    const widenClass = state === OrbState.LISTENING ? 'scale-y-125' : '';
    
    return (
      <g transform={`translate(${eyePos.x}, ${eyePos.y})`}>
        <g className={`${blinkClass} ${widenClass} transition-transform duration-200`}>
          {/* Left Eye */}
          <ellipse cx="-15" cy="0" rx="8" ry="12" fill="white" />
          {/* Right Eye */}
          <ellipse cx="15" cy="0" rx="8" ry="12" fill="white" />
        </g>
      </g>
    );
  };

  // Dynamic Scale based on scroll and audio
  const scrollScale = Math.max(0.5, 1 - scrollProgress * 1.5);
  // Audio reactivity: Base 1, add volume. 
  // If not talking, audioLevel is 0. If talking, pulses up to ~1.3x
  const reactivity = 1 + (audioLevel * 0.3); 
  const totalScale = scrollScale * reactivity;
  
  const translateY = scrollProgress * 20; // Move up slightly as it shrinks

  return (
    <div 
      className={`relative flex justify-center items-center transition-transform duration-75 ease-out z-10 pointer-events-none
        ${state === OrbState.IDLE ? 'orb-float' : ''}
        ${state === OrbState.ERROR ? 'orb-shake' : ''}
        ${state === OrbState.THINKING ? 'orb-pulse' : ''}
      `}
      style={{
        transform: `scale(${totalScale}) translateY(${translateY}px)`,
        opacity: Math.max(0.2, 1 - scrollProgress * 0.5) // Fade slightly but never disappear
      }}
    >
      <svg 
        ref={svgRef}
        viewBox="-80 -80 160 160"
        className="drop-shadow-2xl transition-all duration-300 w-32 h-32 md:w-40 md:h-40" 
        style={{
          filter: `drop-shadow(0 0 ${30 + (audioLevel * 20)}px ${getGlowColor()})`
        }}
      >
        <defs>
          <radialGradient id="orbGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d8b4fe" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </radialGradient>
        </defs>

        {/* Outer Halo for Listening */}
        {state === OrbState.LISTENING && (
           <circle cx="0" cy="0" r="75" fill="none" stroke="white" strokeWidth="1" opacity="0.5">
             <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="indefinite" />
             <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
           </circle>
        )}

        {/* Main Body */}
        <circle cx="0" cy="0" r="60" fill="url(#orbGradient)" />
        
        {/* Specular Highlight */}
        <ellipse cx="-25" cy="-25" rx="15" ry="10" fill="white" opacity="0.3" transform="rotate(-45)" />

        {/* Eyes Layer */}
        {getEyeShape()}
      </svg>
      
      {/* CSS Keyframes injected here for unique eye animations */}
      <style>{`
        @keyframes blink {
          0%, 96%, 100% { transform: scaleY(1); }
          98% { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
};

export default Orb;