import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  icon: string;
  message: string;
  type: 'mutation' | 'phase' | 'calibration';
}

const eventColors = {
  mutation: '#a855f7',
  phase: '#06b6d4',
  calibration: '#f59e0b',
};

const generateMockLogs = (): LogEntry[] => {
  const events = [
    { icon: '🧬', message: 'Mutation event: volatility sensitivity +5%', type: 'mutation' as const },
    { icon: '🌊', message: 'Phase bias shifted: Growth → Rebirth', type: 'phase' as const },
    { icon: '⚡', message: 'Confidence threshold recalibrated', type: 'calibration' as const },
    { icon: '🔬', message: 'Neural pattern adaptation detected', type: 'mutation' as const },
    { icon: '📊', message: 'Market entropy recalculated', type: 'phase' as const },
    { icon: '⚙️', message: 'Bio-state parameters optimized', type: 'calibration' as const },
  ];

  return events.map((event, i) => ({
    id: Date.now() + i,
    timestamp: new Date(Date.now() - i * 93000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    ...event,
  }));
};

export const WepsEvolutionLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>(generateMockLogs());
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursor((prev) => !prev);
    }, 530);

    const logInterval = setInterval(() => {
      const newLog: LogEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        icon: ['🧬', '🌊', '⚡', '🔬', '📊', '⚙️'][Math.floor(Math.random() * 6)],
        message: [
          'Neural adaptation cycle completed',
          'Volatility signature updated',
          'Phase resonance detected',
          'Bio-state evolution logged',
          'Pattern recognition optimized',
          'Entropy threshold adjusted',
        ][Math.floor(Math.random() * 6)],
        type: ['mutation', 'phase', 'calibration'][Math.floor(Math.random() * 3)] as any,
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 9)]);
    }, 8000);

    return () => {
      clearInterval(cursorInterval);
      clearInterval(logInterval);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-lg border backdrop-blur-sm"
      style={{
        background: 'rgba(15, 15, 15, 0.95)',
        borderColor: '#10b981',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Scanline effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'linear-gradient(to bottom, transparent 50%, rgba(16, 185, 129, 0.05) 50%)',
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

      {/* Matrix background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute font-mono text-xs text-[#10b981]"
            style={{
              left: `${(i * 5) % 100}%`,
            }}
            initial={{ y: -20 }}
            animate={{
              y: '100vh',
            }}
            transition={{
              duration: 10 + Math.random() * 5,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 5,
            }}
          >
            {Math.random().toString(2).substring(2, 8)}
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#10b981] text-lg font-bold font-mono flex items-center gap-2">
            <motion.span
              animate={{
                textShadow: ['0 0 5px #10b981', '0 0 15px #10b981', '0 0 5px #10b981'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              &gt;_
            </motion.span>
            WEPS Evolution Log
          </h3>
          <motion.span
            className="text-[#10b981] font-mono text-sm"
            animate={{ opacity: cursor ? 1 : 0 }}
          >
            ▊
          </motion.span>
        </div>

        {/* Log entries */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#10b981] scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{
                  opacity: 1 - index * 0.08,
                  x: 0,
                  height: 'auto',
                }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
                className="flex items-start gap-2 font-mono text-sm p-2 rounded border border-transparent hover:border-[#10b981]/30 hover:bg-[#10b981]/5 transition-all group"
              >
                {/* Icon */}
                <motion.span
                  className="flex-shrink-0"
                  animate={{
                    rotate: index === 0 ? [0, 360] : 0,
                  }}
                  transition={{
                    duration: 2,
                    ease: 'linear',
                  }}
                >
                  {log.icon}
                </motion.span>

                {/* Timestamp */}
                <span
                  className="flex-shrink-0 font-bold"
                  style={{ color: eventColors[log.type] }}
                >
                  {log.timestamp}
                </span>

                {/* Message */}
                <span className="text-[#10b981]/80 group-hover:text-[#10b981] transition-colors flex-1">
                  {index === 0 ? (
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: 'auto' }}
                      transition={{ duration: 0.5 }}
                      className="inline-block overflow-hidden whitespace-nowrap"
                    >
                      {log.message}
                    </motion.span>
                  ) : (
                    log.message
                  )}
                </span>

                {/* Glitch effect for new entries */}
                {index === 0 && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      background: `linear-gradient(90deg, transparent, ${eventColors[log.type]}44, transparent)`,
                    }}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* System status bar */}
        <div className="mt-3 pt-3 border-t border-[#10b981]/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-[#10b981]"
              animate={{
                boxShadow: [
                  '0 0 5px #10b981',
                  '0 0 10px #10b981',
                  '0 0 5px #10b981',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <span className="text-[#10b981]">SYSTEM ACTIVE</span>
          </div>
          <span className="text-[#10b981]/60">LOG: {logs.length}/10</span>
        </div>
      </div>

      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 20px rgba(16, 185, 129, 0.1)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
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
