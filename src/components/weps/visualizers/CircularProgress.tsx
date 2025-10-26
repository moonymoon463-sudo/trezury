import { motion } from "framer-motion";

interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  className?: string;
}

export const CircularProgress = ({
  value,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  className = ""
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity="0.1"
        />
        
        {/* Animated progress circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#gradient-${label})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeInOut" }}
          filter={`url(#glow-${label})`}
        />
        
        {/* Inner glow effect */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius - strokeWidth}
          fill={color}
          opacity="0"
          animate={{
            opacity: [0, 0.1, 0],
            scale: [0.9, 1, 0.9]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ transformOrigin: "center" }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-xl font-bold"
          style={{ color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          {Math.round(value)}
        </motion.span>
        <span className="text-[10px] opacity-60 uppercase tracking-wider mt-0.5">
          {label}
        </span>
      </div>
    </div>
  );
};
