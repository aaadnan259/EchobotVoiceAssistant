import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

type BotState = 'idle' | 'typing' | 'processing' | 'listening' | 'happy';

interface BotCharacterProps {
  state: BotState;
}

export function BotCharacter({ state }: BotCharacterProps) {
  const [blinkState, setBlinkState] = useState(false);

  // Blinking animation for idle state
  useEffect(() => {
    if (state === 'idle') {
      const blinkInterval = setInterval(() => {
        setBlinkState(true);
        setTimeout(() => setBlinkState(false), 150);
      }, 3000 + Math.random() * 2000);

      return () => clearInterval(blinkInterval);
    }
  }, [state]);

  // Eye configurations for each state
  const getEyeConfig = () => {
    switch (state) {
      case 'typing':
        return { scaleY: 1.15, y: -4, rotation: -5, glow: 'rgba(59, 130, 246, 0.4)' };
      case 'processing':
        return { scaleY: 1, y: 0, rotation: 0, glow: 'rgba(139, 92, 246, 0.4)' };
      case 'listening':
        return { scaleY: 1.1, y: 0, rotation: 0, glow: 'rgba(34, 211, 238, 0.6)' };
      case 'happy':
        return { scaleY: 0.7, y: 2, rotation: 8, glow: 'rgba(251, 191, 36, 0.5)' };
      default: // idle
        return { scaleY: blinkState ? 0.2 : 1, y: 0, rotation: 0, glow: 'rgba(168, 85, 247, 0.3)' };
    }
  };

  const eyeConfig = getEyeConfig();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Floating robot head */}
      <motion.div
        className="relative"
        animate={{
          y: [0, -12, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl"
          animate={{
            scale: state === 'listening' ? [1, 1.3, 1] : [1, 1.15, 1],
            opacity: state === 'listening' ? [0.4, 0.7, 0.4] : [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: '180px',
            height: '180px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: state === 'listening' 
              ? 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)'
              : state === 'happy'
              ? 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
          }}
        />

        {/* Robot head - soft gradient sphere */}
        <motion.div
          className="relative w-[140px] h-[140px] rounded-full shadow-2xl"
          animate={{
            scale: state === 'happy' ? [1, 1.06, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: state === 'happy' ? 1 : 0,
          }}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 50%, #e5e7ff 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), inset 0 -10px 20px rgba(139, 92, 246, 0.1), inset 0 10px 20px rgba(255, 255, 255, 0.8)',
          }}
        >
          {/* Top highlight - soft glossy effect */}
          <div
            className="absolute top-4 left-1/2 w-24 h-24 rounded-full opacity-80"
            style={{
              transform: 'translateX(-50%) translateY(-8px)',
              background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
              filter: 'blur(10px)',
            }}
          />

          {/* Decorative ring accent */}
          <div
            className="absolute top-1/2 left-1/2 w-[150px] h-[150px] rounded-full border-2 border-purple-200/30"
            style={{
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Eyes container */}
          <div className="absolute top-1/2 left-1/2 flex gap-5" style={{ transform: 'translate(-50%, -50%)' }}>
            {/* Left Eye */}
            <motion.div
              className="relative"
              animate={{
                scaleY: eyeConfig.scaleY,
                y: eyeConfig.y,
                rotate: -eyeConfig.rotation,
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              {/* Simple rounded eye shape */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  boxShadow: `0 0 20px ${eyeConfig.glow}, inset 0 2px 4px rgba(255, 255, 255, 0.3)`,
                }}
              >
                {/* Animated pupil */}
                <motion.div
                  className="w-3 h-3 rounded-full bg-white"
                  animate={{
                    x: state === 'processing' ? [-3, 3, -3] : 0,
                    scale: state === 'happy' ? [1, 1.3, 1] : 1,
                  }}
                  transition={{
                    duration: state === 'processing' ? 1.5 : 0.3,
                    repeat: state === 'processing' ? Infinity : state === 'happy' ? 2 : 0,
                    ease: "easeInOut",
                  }}
                />
                
                {/* Soft highlight */}
                <div
                  className="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-white/70 blur-[2px]"
                />
              </div>
            </motion.div>

            {/* Right Eye */}
            <motion.div
              className="relative"
              animate={{
                scaleY: eyeConfig.scaleY,
                y: eyeConfig.y,
                rotate: eyeConfig.rotation,
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              {/* Simple rounded eye shape */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  boxShadow: `0 0 20px ${eyeConfig.glow}, inset 0 2px 4px rgba(255, 255, 255, 0.3)`,
                }}
              >
                {/* Animated pupil */}
                <motion.div
                  className="w-3 h-3 rounded-full bg-white"
                  animate={{
                    x: state === 'processing' ? [-3, 3, -3] : 0,
                    scale: state === 'happy' ? [1, 1.3, 1] : 1,
                  }}
                  transition={{
                    duration: state === 'processing' ? 1.5 : 0.3,
                    repeat: state === 'processing' ? Infinity : state === 'happy' ? 2 : 0,
                    ease: "easeInOut",
                  }}
                />
                
                {/* Soft highlight */}
                <div
                  className="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-white/70 blur-[2px]"
                />
              </div>
            </motion.div>
          </div>

          {/* Happy smile - curved line */}
          {state === 'happy' && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0.5 }}
              animate={{ opacity: 1, scaleX: 1 }}
              className="absolute bottom-10 left-1/2"
              style={{
                transform: 'translateX(-50%)',
              }}
            >
              <svg width="40" height="20" viewBox="0 0 40 20">
                <path
                  d="M 5 5 Q 20 15, 35 5"
                  stroke="url(#smileGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <defs>
                  <linearGradient id="smileGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          )}

          {/* Subtle bottom shadow */}
          <div
            className="absolute bottom-3 left-1/2 w-20 h-6 rounded-full bg-black/10 blur-md"
            style={{
              transform: 'translateX(-50%)',
            }}
          />
        </motion.div>

        {/* Pulsing rings for listening state */}
        {state === 'listening' && (
          <>
            <motion.div
              className="absolute top-1/2 left-1/2 w-[160px] h-[160px] rounded-full border-2 border-cyan-400/40"
              style={{
                transform: 'translate(-50%, -50%)',
              }}
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 w-[180px] h-[180px] rounded-full border-2 border-cyan-400/20"
              style={{
                transform: 'translate(-50%, -50%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
            />
          </>
        )}
      </motion.div>

      {/* Status Text */}
      <motion.p
        className="text-white/80 text-center"
        animate={{
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {state === 'listening' && 'Listening...'}
        {state === 'typing' && 'Thinking...'}
        {state === 'processing' && 'Processing...'}
        {state === 'happy' && 'Got it!'}
        {state === 'idle' && 'How can I assist you?'}
      </motion.p>
    </div>
  );
}