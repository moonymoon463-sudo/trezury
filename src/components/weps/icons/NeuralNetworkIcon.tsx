import { motion } from "framer-motion";

interface NeuralNetworkIconProps {
  className?: string;
  color?: string;
  size?: number;
}

export const NeuralNetworkIcon = ({ 
  className = "", 
  color = "currentColor",
  size = 24 
}: NeuralNetworkIconProps) => {
  const nodes = [
    { x: 12, y: 4, delay: 0 },
    { x: 4, y: 12, delay: 0.2 },
    { x: 20, y: 12, delay: 0.4 },
    { x: 8, y: 20, delay: 0.6 },
    { x: 16, y: 20, delay: 0.8 },
  ];

  const connections = [
    { x1: 12, y1: 4, x2: 4, y2: 12 },
    { x1: 12, y1: 4, x2: 20, y2: 12 },
    { x1: 4, y1: 12, x2: 8, y2: 20 },
    { x1: 20, y1: 12, x2: 16, y2: 20 },
    { x1: 8, y1: 20, x2: 16, y2: 20 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <filter id="neural-glow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Animated connections */}
      {connections.map((conn, i) => (
        <motion.line
          key={`conn-${i}`}
          x1={conn.x1}
          y1={conn.y1}
          x2={conn.x2}
          y2={conn.y2}
          stroke="url(#neural-gradient)"
          strokeWidth="1"
          filter="url(#neural-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1, 0],
            opacity: [0, 0.8, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Pulsing nodes */}
      {nodes.map((node, i) => (
        <motion.g key={`node-${i}`}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="3"
            fill={color}
            opacity="0.3"
            animate={{
              r: [3, 5, 3],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: node.delay,
              ease: "easeInOut"
            }}
          />
          <circle
            cx={node.x}
            cy={node.y}
            r="1.5"
            fill={color}
            filter="url(#neural-glow)"
          />
        </motion.g>
      ))}
    </svg>
  );
};
