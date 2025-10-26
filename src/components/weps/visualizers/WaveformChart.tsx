import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WaveformChartProps {
  volatility: number;
  color: string;
  className?: string;
}

export const WaveformChart = ({ volatility, color, className = "" }: WaveformChartProps) => {
  const [points, setPoints] = useState<string>("");
  const width = 200;
  const height = 60;
  const samples = 40;

  useEffect(() => {
    const amplitude = (volatility / 100) * (height / 3);
    const frequency = 2 + (volatility / 100) * 2;
    
    let pathPoints = "";
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * width;
      const y = height / 2 + Math.sin((i / samples) * Math.PI * frequency) * amplitude;
      pathPoints += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    }
    
    setPoints(pathPoints);
  }, [volatility]);

  return (
    <div className={`relative ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="waveform-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.2" />
          </linearGradient>
          <filter id="waveform-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="waveform-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Filled area under wave */}
        <motion.path
          d={`${points} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#waveform-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Main waveform */}
        <motion.path
          d={points}
          stroke="url(#waveform-gradient)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          filter="url(#waveform-glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />

        {/* Animated particles along wave */}
        {[0, 0.25, 0.5, 0.75].map((position, i) => {
          const index = Math.floor(position * samples);
          const match = points.match(new RegExp(`(?:M|L)\\s+(\\d+\\.?\\d*)\\s+(\\d+\\.?\\d*)`, 'g'));
          if (!match || !match[index]) return null;
          
          const coords = match[index].match(/(\d+\.?\d*)/g);
          if (!coords || coords.length < 2) return null;
          
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);

          return (
            <motion.circle
              key={`particle-${i}`}
              cx={x}
              cy={y}
              r="2"
              fill={color}
              filter="url(#waveform-glow)"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut"
              }}
            />
          );
        })}

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
          <line
            key={`grid-${i}`}
            x1={pos * width}
            y1="0"
            x2={pos * width}
            y2={height}
            stroke={color}
            strokeWidth="0.5"
            opacity="0.1"
          />
        ))}
      </svg>

      {/* Volatility label */}
      <div className="absolute top-1 right-1 text-[10px] font-mono opacity-60">
        {volatility.toFixed(1)}%
      </div>
    </div>
  );
};
