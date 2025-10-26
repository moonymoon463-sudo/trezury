import { motion } from "framer-motion";

interface QuantumFieldIconProps {
  className?: string;
  color?: string;
  size?: number;
}

export const QuantumFieldIcon = ({ 
  className = "", 
  color = "currentColor",
  size = 24 
}: QuantumFieldIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="quantum-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
        <filter id="quantum-glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Orbital paths */}
      {[0, 60, 120].map((rotation, i) => (
        <motion.ellipse
          key={`orbit-${i}`}
          cx="12"
          cy="12"
          rx="8"
          ry="4"
          stroke="url(#quantum-gradient)"
          strokeWidth="1"
          fill="none"
          filter="url(#quantum-glow)"
          style={{
            transformOrigin: "center",
            transform: `rotate(${rotation}deg)`
          }}
          animate={{
            strokeDashoffset: [0, 100]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: i * 0.3
          }}
          strokeDasharray="4 4"
        />
      ))}

      {/* Central nucleus */}
      <motion.circle
        cx="12"
        cy="12"
        r="2"
        fill={color}
        filter="url(#quantum-glow)"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Orbiting particles */}
      {[0, 120, 240].map((startAngle, i) => {
        const orbitRadius = 8;
        
        return (
          <motion.circle
            key={`particle-${i}`}
            cx="12"
            cy="12"
            r="1.5"
            fill={color}
            filter="url(#quantum-glow)"
            animate={{
              cx: [
                12 + orbitRadius * Math.cos((startAngle * Math.PI) / 180),
                12 + orbitRadius * Math.cos(((startAngle + 180) * Math.PI) / 180),
                12 + orbitRadius * Math.cos((startAngle * Math.PI) / 180)
              ],
              cy: [
                12 + orbitRadius * Math.sin((startAngle * Math.PI) / 180),
                12 + orbitRadius * Math.sin(((startAngle + 180) * Math.PI) / 180),
                12 + orbitRadius * Math.sin((startAngle * Math.PI) / 180)
              ],
              scale: [1, 1.3, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.4
            }}
          />
        );
      })}

      {/* Energy field lines */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 12 + Math.cos(rad) * 3;
        const y1 = 12 + Math.sin(rad) * 3;
        const x2 = 12 + Math.cos(rad) * 10;
        const y2 = 12 + Math.sin(rad) * 10;
        
        return (
          <motion.line
            key={`field-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="0.5"
            opacity="0.3"
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: [0, 1, 0],
              opacity: [0, 0.5, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </svg>
  );
};
