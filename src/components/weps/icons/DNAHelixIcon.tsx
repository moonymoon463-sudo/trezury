import { motion } from "framer-motion";

interface DNAHelixIconProps {
  className?: string;
  color?: string;
  size?: number;
}

export const DNAHelixIcon = ({ 
  className = "", 
  color = "currentColor",
  size = 24 
}: DNAHelixIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="dna-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
        <filter id="dna-glow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Left helix strand */}
      <motion.path
        d="M8 2 Q 6 8 8 12 Q 10 16 8 22"
        stroke="url(#dna-gradient)"
        strokeWidth="2"
        fill="none"
        filter="url(#dna-glow)"
        initial={{ pathLength: 0 }}
        animate={{ 
          pathLength: 1,
          strokeDashoffset: [0, 48]
        }}
        transition={{
          pathLength: { duration: 1 },
          strokeDashoffset: { duration: 3, repeat: Infinity, ease: "linear" }
        }}
        strokeDasharray="4 4"
      />

      {/* Right helix strand */}
      <motion.path
        d="M16 2 Q 18 8 16 12 Q 14 16 16 22"
        stroke="url(#dna-gradient)"
        strokeWidth="2"
        fill="none"
        filter="url(#dna-glow)"
        initial={{ pathLength: 0 }}
        animate={{ 
          pathLength: 1,
          strokeDashoffset: [0, 48]
        }}
        transition={{
          pathLength: { duration: 1 },
          strokeDashoffset: { duration: 3, repeat: Infinity, ease: "linear" }
        }}
        strokeDasharray="4 4"
      />

      {/* Connecting base pairs */}
      {[4, 8, 12, 16, 20].map((y, i) => (
        <motion.line
          key={`base-${i}`}
          x1="8"
          y1={y}
          x2="16"
          y2={y}
          stroke={color}
          strokeWidth="1.5"
          opacity="0.6"
          initial={{ scaleX: 0 }}
          animate={{ 
            scaleX: [0, 1, 0],
            opacity: [0, 0.8, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
          style={{ transformOrigin: "center" }}
        />
      ))}

      {/* Glowing nodes at connection points */}
      {[4, 8, 12, 16, 20].map((y, i) => (
        <motion.g key={`nodes-${i}`}>
          <motion.circle
            cx="8"
            cy={y}
            r="1.5"
            fill={color}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
          <motion.circle
            cx="16"
            cy={y}
            r="1.5"
            fill={color}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        </motion.g>
      ))}
    </svg>
  );
};
