import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface WepsInsightsCardProps {
  phase: string;
  bioState: string;
  confidence: number;
  volatility: number;
}

const phaseColors = {
  Growth: { primary: '#10b981', secondary: '#06b6d4', glow: 'rgba(16, 185, 129, 0.3)' },
  Decay: { primary: '#ef4444', secondary: '#f59e0b', glow: 'rgba(239, 68, 68, 0.3)' },
  Rebirth: { primary: '#a855f7', secondary: '#ec4899', glow: 'rgba(168, 85, 247, 0.3)' },
  Death: { primary: '#9ca3af', secondary: '#ffffff', glow: 'rgba(255, 255, 255, 0.2)' },
  Neutral: { primary: '#e6b951', secondary: '#f59e0b', glow: 'rgba(230, 185, 81, 0.3)' },
};

export const WepsInsightsCard = ({ phase, bioState, confidence, volatility }: WepsInsightsCardProps) => {
  const colors = phaseColors[phase as keyof typeof phaseColors] || phaseColors.Neutral;

  const phaseMessages = {
    Growth: "Market rhythm expanding — bias toward long positions.",
    Decay: "Volatility fading — tighten risk exposure.",
    Rebirth: "Momentum reversal forming — early entry opportunity.",
    Death: "Entropy spike detected — stay defensive.",
    Neutral: "Awaiting phase confirmation.",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-lg border backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, rgba(42, 37, 26, 0.95) 0%, rgba(26, 23, 18, 0.95) 100%)`,
        borderColor: colors.primary,
        boxShadow: `0 0 20px ${colors.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Animated border gradient */}
      <motion.div
        className="absolute inset-0 rounded-lg opacity-50 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Neural network background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <pattern id="hexagons" x="0" y="0" width="50" height="43.4" patternUnits="userSpaceOnUse">
              <path
                d="M25 0 L50 14.43 L50 28.87 L25 43.3 L0 28.87 L0 14.43 Z"
                fill="none"
                stroke={colors.primary}
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexagons)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 space-y-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-white text-lg font-semibold flex items-center gap-2">
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Zap className="h-4 w-4" style={{ color: colors.primary }} />
            </motion.div>
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              }}
            >
              WEPS Mode – Bio-Adaptive Insights
            </span>
          </h3>
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Badge
              className="font-mono"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}33, ${colors.secondary}33)`,
                color: colors.primary,
                borderColor: colors.primary,
                border: '1px solid',
                boxShadow: `0 0 10px ${colors.glow}`,
              }}
            >
              Confidence {(confidence * 100).toFixed(1)}%
            </Badge>
          </motion.div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Phase', value: phase, color: colors.primary },
            { label: 'Bio State', value: bioState, color: colors.secondary },
            { label: 'Volatility', value: `${(volatility * 100).toFixed(1)}%`, color: colors.primary },
            {
              label: 'Mode',
              value: bioState,
              color:
                bioState === 'Aggressive'
                  ? '#10b981'
                  : bioState === 'Defensive'
                  ? '#ef4444'
                  : colors.primary,
            },
          ].map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              className="relative p-3 rounded-lg border backdrop-blur-sm group hover:scale-105 transition-transform"
              style={{
                background: 'rgba(26, 23, 18, 0.8)',
                borderColor: `${metric.color}44`,
              }}
            >
              {/* Glow effect on hover */}
              <div
                className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  boxShadow: `0 0 15px ${metric.color}66`,
                }}
              />
              <p className="text-[#c6b795] mb-1 text-xs font-mono">{metric.label}</p>
              <motion.p
                className="font-bold font-mono"
                style={{ color: metric.color }}
                animate={{
                  textShadow: [
                    `0 0 5px ${metric.color}`,
                    `0 0 10px ${metric.color}`,
                    `0 0 5px ${metric.color}`,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {metric.value}
              </motion.p>
            </motion.div>
          ))}
        </div>

        {/* Phase Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative text-sm leading-relaxed rounded-lg p-3 border backdrop-blur-sm overflow-hidden"
          style={{
            background: 'rgba(26, 23, 18, 0.9)',
            borderColor: `${colors.primary}44`,
          }}
        >
          {/* Scanline effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to bottom, transparent 50%, ${colors.primary}11 50%)`,
              backgroundSize: '100% 4px',
            }}
            animate={{
              y: [0, 8],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          <p className="relative z-10 font-mono" style={{ color: colors.primary }}>
            {phaseMessages[phase as keyof typeof phaseMessages]}
          </p>
        </motion.div>

        {/* Particle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: colors.primary,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>

      {/* Breathing animation */}
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colors.glow} 0%, transparent 70%)`,
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
};
