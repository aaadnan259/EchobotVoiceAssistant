import React, { useEffect, useState, useRef } from 'react';
import { motion, Variants, useSpring, useMotionValue } from 'framer-motion';

interface BotCharacterProps {
  state: 'idle' | 'typing' | 'processing' | 'listening' | 'happy';
  audioLevel?: number;
}

export const BotCharacter: React.FC<BotCharacterProps> = ({ state, audioLevel = 0 }) => {
  const [isShaking, setIsShaking] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const shakeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Global Mouse Listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only track in idle or listening states
      if (state !== 'idle' && state !== 'listening') {
        mouseX.set(0);
        mouseY.set(0);
        return;
      }

      if (!containerRef.current) return;

      // Velocity Detection
      const now = Date.now();
      const dt = now - lastMousePos.current.time;

      if (dt > 0) {
        const dx_vel = e.clientX - lastMousePos.current.x;
        const dy_vel = e.clientY - lastMousePos.current.y;
        const distance_vel = Math.sqrt(dx_vel * dx_vel + dy_vel * dy_vel);
        const velocity = distance_vel / dt; // pixels per ms

        // Threshold for "scrubbing" (2.5 px/ms is fast)
        if (velocity > 2.5 && !isShaking) {
          setIsShaking(true);

          // Reset shake after 500ms
          if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
          shakeTimeout.current = setTimeout(() => {
            setIsShaking(false);
          }, 500);
        }
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate distance and angle
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 150); // Clamp distance

      // Map to eye offset (max 12px)
      const offset = (distance / 150) * 12;

      mouseX.set(Math.cos(angle) * offset);
      mouseY.set(Math.sin(angle) * offset);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state, mouseX, mouseY, isShaking]);

  // Reset eyes when state changes to non-tracking
  useEffect(() => {
    if (state !== 'idle' && state !== 'listening') {
      mouseX.set(0);
      mouseY.set(0);
    }
  }, [state, mouseX, mouseY]);

  // Random Idle Animations (Blink, Wink)
  useEffect(() => {
    const triggerIdleAction = () => {
      if (state !== 'idle' || isShaking) return; // Don't blink while shaking

      const rand = Math.random();
      if (rand < 0.1) {
        // Wink
        setWink(true);
        setTimeout(() => setWink(false), 200);
      } else {
        // Blink
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      }

      const nextAction = Math.random() * 3000 + 2000;
      setTimeout(triggerIdleAction, nextAction);
    };

    const timeoutId = setTimeout(triggerIdleAction, 2000);
    return () => clearTimeout(timeoutId);
  }, [state, isShaking]);

  // Sphere Variants
  const sphereVariants: Variants = {
    idle: {
      y: [-8, 8],
      scale: 1,
      transition: {
        y: {
          duration: 3,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut"
        }
      }
    },
    listening: {
      scale: 1 + (audioLevel * 0.5), // Pulse with audio
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 20 }
    },
    processing: {
      y: [0, -5, 0],
      rotate: [0, 2, -2, 0],
      transition: {
        y: { duration: 1, repeat: Infinity },
        rotate: { duration: 0.5, repeat: Infinity }
      }
    },
    typing: {
      scale: 1.02,
      y: -5,
      transition: { duration: 0.3 }
    },
    happy: {
      y: [0, -15, 0],
      scale: [1, 1.1, 1],
      transition: {
        duration: 0.4,
        repeat: 3, // Bounce 3 times
        ease: "easeOut"
      }
    }
  };

  // Eye Container Variants (for state-based overrides)
  const eyesContainerVariants: Variants = {
    idle: { x: 0, y: 0 }, // Handled by spring
    listening: { scale: 1.1 },
    processing: { y: -8 }, // Look up
    typing: { y: 4 }, // Look down
    happy: { scale: 1.1 }
  };

  // Individual Eye Variants
  const leftEyeVariants: Variants = {
    idle: {
      height: isShaking ? 4 : (blink || wink ? 2 : 24), // Squint when shaking
      width: isShaking ? 22 : 16,
      rotate: isShaking ? -15 : 0,
      opacity: blink || wink ? 0.5 : 1
    },
    listening: { height: 28, width: 20 },
    processing: { height: 12 },
    typing: { height: 24 },
    happy: { height: 4, width: 24, borderRadius: 2 }
  };

  const rightEyeVariants: Variants = {
    idle: {
      height: isShaking ? 4 : (blink ? 2 : 24), // Squint when shaking
      width: isShaking ? 22 : 16,
      rotate: isShaking ? 15 : 0,
      opacity: blink ? 0.5 : 1
    },
    listening: { height: 28, width: 20 },
    processing: { height: 12 },
    typing: { height: 24 },
    happy: { height: 4, width: 24, borderRadius: 2 }
  };

  return (
    <div ref={containerRef} className="relative w-64 h-64 flex items-center justify-center">
      {/* Wrapper for Shake Animation to avoid conflict with floating motion */}
      <div className={isShaking ? "is-shaking" : ""}>
        {/* The Sphere */}
        <motion.div
          variants={sphereVariants}
          animate={state}
          className="relative w-40 h-40 rounded-full z-10"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #e5e7eb 40%, #9ca3af 100%)',
            boxShadow: `
              inset -10px -10px 20px rgba(0, 0, 0, 0.2),
              inset 10px 10px 20px rgba(255, 255, 255, 0.8),
              0px 20px 40px rgba(0, 0, 0, 0.3),
              0px 0px 60px rgba(255, 255, 255, 0.1)
            `
          }}
        >
          {/* Face Container */}
          <motion.div
            variants={eyesContainerVariants}
            animate={state}
            style={{ x: eyeX, y: eyeY }} // Apply mouse tracking here
            className="absolute inset-0 flex items-center justify-center gap-6"
          >
            {/* Left Eye */}
            <motion.div
              variants={leftEyeVariants}
              animate={state}
              className="bg-gray-900 rounded-full relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ width: 16, height: 24 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {/* Reflection Dot */}
              <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full opacity-90" />
            </motion.div>

            {/* Right Eye */}
            <motion.div
              variants={rightEyeVariants}
              animate={state}
              className="bg-gray-900 rounded-full relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ width: 16, height: 24 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {/* Reflection Dot */}
              <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full opacity-90" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Ground Shadow */}
      <motion.div
        animate={{
          scale: state === 'idle' ? [1, 0.8, 1] : 1,
          opacity: state === 'idle' ? [0.2, 0.1, 0.2] : 0.2
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut"
        }}
        className="absolute bottom-8 w-24 h-4 bg-black/40 blur-xl rounded-[100%]"
      />
    </div>
  );
};