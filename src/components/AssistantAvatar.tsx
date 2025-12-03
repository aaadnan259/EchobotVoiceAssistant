import { motion } from 'motion/react';

interface AssistantAvatarProps {
  isActive: boolean;
}

export function AssistantAvatar({ isActive }: AssistantAvatarProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Glowing Orb */}
      <motion.div 
        className="relative"
        animate={{
          y: [0, -15, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Outer glow rings */}
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-500/40 blur-3xl"
          animate={{
            scale: isActive ? [1, 1.4, 1] : [1, 1.2, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: '140px',
            height: '140px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Main orb sphere */}
        <motion.div
          className="relative w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#8b9eff] via-[#6b7fff] to-[#4b5fff] shadow-2xl"
          animate={{
            scale: isActive ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: '0 0 60px rgba(107, 127, 255, 0.6), inset 0 -20px 40px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Top highlight - creates 3D sphere effect */}
          <div 
            className="absolute top-4 left-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-white/40 to-transparent blur-xl"
            style={{
              transform: 'translateX(-50%)',
            }}
          />
          
          {/* Eyes container */}
          <div className="absolute top-1/2 left-1/2 flex gap-4" style={{ transform: 'translate(-50%, -50%)' }}>
            {/* Left eye */}
            <motion.div
              className="w-8 h-3 rounded-full bg-white shadow-lg"
              animate={{
                opacity: isActive ? [1, 0.8, 1] : 1,
                scaleY: isActive ? [1, 0.3, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
              }}
            />
            
            {/* Right eye */}
            <motion.div
              className="w-8 h-3 rounded-full bg-white shadow-lg"
              animate={{
                opacity: isActive ? [1, 0.8, 1] : 1,
                scaleY: isActive ? [1, 0.3, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
              }}
            />
          </div>

          {/* Bottom shadow for depth */}
          <div 
            className="absolute bottom-0 left-1/2 w-20 h-10 rounded-full bg-black/30 blur-lg"
            style={{
              transform: 'translateX(-50%)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Status Text */}
      <motion.p
        className="text-white text-center"
        animate={{
          opacity: isActive ? [0.9, 1, 0.9] : 0.9,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {isActive ? 'Listening...' : 'How can I assist you?'}
      </motion.p>
    </div>
  );
}