import { motion } from "framer-motion";

interface WaveInterferenceIconProps {
  className?: string;
  color?: string;
  size?: number;
}

export const WaveInterferenceIcon = ({ 
  className = "", 
  color = "currentColor",
  size = 24 
}: WaveInterferenceIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <radialGradient id="wave-gradient">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <filter id="wave-glow">
          <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Expanding ripples */}
      {[0, 0.3, 0.6].map((delay, i) => (
        <motion.circle
          key={`ripple-${i}`}
          cx="12"
          cy="12"
          r="2"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          filter="url(#wave-glow)"
          initial={{ r: 2, opacity: 1 }}
          animate={{ 
            r: [2, 10],
            opacity: [1, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay,
            ease: "easeOut"
          }}
        />
      ))}

      {/* Inner wave paths */}
      <motion.path
        d="M 4 12 Q 7 8 10 12 T 16 12 T 20 12"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
        animate={{
          d: [
            "M 4 12 Q 7 8 10 12 T 16 12 T 20 12",
            "M 4 12 Q 7 16 10 12 T 16 12 T 20 12",
            "M 4 12 Q 7 8 10 12 T 16 12 T 20 12"
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Center pulse */}
      <motion.circle
        cx="12"
        cy="12"
        r="2"
        fill="url(#wave-gradient)"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [1, 0.5, 1]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Particle trails */}
      {[0, 120, 240].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = 12 + Math.cos(rad) * 8;
        const y = 12 + Math.sin(rad) * 8;
        
        return (
          <motion.circle
            key={`particle-${i}`}
            cx="12"
            cy="12"
            r="1"
            fill={color}
            animate={{
              cx: [12, x, 12],
              cy: [12, y, 12],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </svg>
  );
};
