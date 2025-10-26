import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface HolographicGlitchProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number; // 0-1
}

export const HolographicGlitch = ({ 
  children, 
  className = "",
  intensity = 0.5 
}: HolographicGlitchProps) => {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() < intensity) {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 200);
      }
    }, 3000);

    return () => clearInterval(glitchInterval);
  }, [intensity]);

  return (
    <div className={`relative ${className}`}>
      {/* Main content */}
      <motion.div
        animate={isGlitching ? {
          x: [0, -2, 2, -1, 1, 0],
          y: [0, 1, -1, 1, -1, 0],
        } : {}}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>

      {/* RGB split effect */}
      {isGlitching && (
        <>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              mixBlendMode: "screen",
              color: "rgba(255, 0, 0, 0.8)"
            }}
            initial={{ x: 0 }}
            animate={{ x: -3 }}
          >
            {children}
          </motion.div>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              mixBlendMode: "screen",
              color: "rgba(0, 255, 255, 0.8)"
            }}
            initial={{ x: 0 }}
            animate={{ x: 3 }}
          >
            {children}
          </motion.div>
        </>
      )}

      {/* Scanline overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)"
        }}
        animate={{
          y: [0, -4, 0]
        }}
        transition={{
          duration: 0.1,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Holographic shimmer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
          backgroundSize: "200% 100%"
        }}
        animate={{
          backgroundPosition: ["0% 0%", "200% 0%"]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
};
