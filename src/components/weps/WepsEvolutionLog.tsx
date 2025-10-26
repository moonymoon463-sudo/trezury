import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DNAHelixIcon } from "./icons/DNAHelixIcon";
import { WaveInterferenceIcon } from "./icons/WaveInterferenceIcon";
import { QuantumFieldIcon } from "./icons/QuantumFieldIcon";
import { useEffect, useState } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  icon: "dna" | "wave" | "quantum";
  message: string;
  type: "mutation" | "phase" | "calibration";
}

const eventColors = {
  mutation: "#a855f7",
  phase: "#06b6d4",
  calibration: "#10b981"
};

const generateMockLogs = (): LogEntry[] => [
  { id: 1, timestamp: "09:23:14.421", icon: "dna", message: "Bio-state mutation detected: Growth → Expansion vector initiated", type: "mutation" },
  { id: 2, timestamp: "09:23:18.102", icon: "wave", message: "Phase transition complete: Calibrating neural pathways", type: "phase" },
  { id: 3, timestamp: "09:23:22.853", icon: "quantum", message: "System calibration: Quantum field synchronization at 98.7%", type: "calibration" },
  { id: 4, timestamp: "09:23:27.234", icon: "dna", message: "Mutation protocol active: Adapting to market volatility spike", type: "mutation" },
  { id: 5, timestamp: "09:23:31.567", icon: "wave", message: "Phase shift analysis: Rebirth signals emerging from decay pattern", type: "phase" },
  { id: 6, timestamp: "09:23:35.890", icon: "quantum", message: "Calibration sequence: Fine-tuning confidence algorithms", type: "calibration" },
];

export const WepsEvolutionLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>(generateMockLogs());
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    // Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    // Add new logs periodically
    const logInterval = setInterval(() => {
      const types: Array<"mutation" | "phase" | "calibration"> = ["mutation", "phase", "calibration"];
      const icons: Array<"dna" | "wave" | "quantum"> = ["dna", "wave", "quantum"];
      const messages = [
        "Neural network optimization: Synaptic weights adjusted for market prediction",
        "Quantum entanglement established: Cross-chain data correlation active",
        "Bio-adaptive response: Evolving strategy based on real-time sentiment",
        "Phase transition detected: Market entering new volatility regime",
        "Mutation cascade initiated: Multi-dimensional analysis in progress",
        "Calibration checkpoint: System accuracy verified at 99.3%",
        "Evolutionary algorithm converged: Optimal trading parameters identified",
        "Consciousness expansion: New pattern recognition capabilities unlocked"
      ];

      const newLog: LogEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        icon: icons[Math.floor(Math.random() * icons.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        type: types[Math.floor(Math.random() * types.length)]
      };

      setLogs(prev => [newLog, ...prev].slice(0, 20));
    }, 5000);

    return () => {
      clearInterval(cursorInterval);
      clearInterval(logInterval);
    };
  }, []);

  const getIconComponent = (icon: string, color: string) => {
    switch (icon) {
      case "dna":
        return <DNAHelixIcon size={16} color={color} />;
      case "wave":
        return <WaveInterferenceIcon size={16} color={color} />;
      case "quantum":
        return <QuantumFieldIcon size={16} color={color} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="relative overflow-hidden bg-black/60 border border-cyan-500/30">
        {/* CRT screen effect overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Scanlines */}
          <motion.div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.3) 2px, rgba(6, 182, 212, 0.3) 4px)"
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
          
          {/* Vignette */}
          <div 
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle, transparent 50%, rgba(0,0,0,0.5) 100%)"
            }}
          />

          {/* RGB phosphor glow */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              background: "repeating-linear-gradient(90deg, #ff0000 0px, #00ff00 1px, #0000ff 2px, transparent 3px, transparent 4px)",
              mixBlendMode: "screen"
            }}
          />
        </div>

        {/* Matrix background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-cyan-500 font-mono text-xs"
              style={{
                left: `${(i * 7) % 100}%`,
                top: 0
              }}
              animate={{
                y: ["0%", "100%"]
              }}
              transition={{
                duration: Math.random() * 5 + 5,
                repeat: Infinity,
                ease: "linear",
                delay: Math.random() * 5
              }}
            >
              {Array.from({ length: 20 }, () => 
                Math.random() > 0.5 ? Math.floor(Math.random() * 2) : String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
              ).join('\n')}
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <div className="relative">
          {/* Terminal header */}
          <div className="border-b border-cyan-500/30 p-3 bg-black/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  className="flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </motion.div>
                <span className="text-xs font-mono text-cyan-400">
                  WEPS Evolution Log
                  {showCursor && <span className="text-cyan-400 ml-1">▊</span>}
                </span>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span>UPTIME: 99.9%</span>
                </div>
                <span>•</span>
                <span>LOGS: {logs.length}</span>
              </div>
            </div>
          </div>

          {/* Log entries */}
          <ScrollArea className="h-[300px]">
            <div className="p-3 space-y-1">
              <AnimatePresence initial={false}>
                {logs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0, 
                      height: "auto"
                    }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ 
                      duration: 0.3,
                      delay: index === 0 ? 0.1 : 0
                    }}
                    className="flex items-start gap-2 py-1.5 hover:bg-cyan-500/5 rounded px-2 transition-colors group"
                  >
                    {/* Severity indicator */}
                    <motion.div
                      className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: eventColors[log.type] }}
                      animate={{
                        scale: index === 0 ? [1, 1.5, 1] : 1,
                        opacity: index === 0 ? [0.5, 1, 0.5] : 0.7
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: index === 0 ? Infinity : 0
                      }}
                    />

                    {/* Timestamp */}
                    <span 
                      className="text-[10px] font-mono flex-shrink-0 opacity-50 group-hover:opacity-70 transition-opacity"
                      style={{ color: eventColors[log.type] }}
                    >
                      [{log.timestamp}]
                    </span>

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getIconComponent(log.icon, eventColors[log.type])}
                    </div>

                    {/* Message */}
                    <motion.span 
                      className="text-xs font-mono leading-relaxed"
                      style={{ color: eventColors[log.type] }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: index === 0 ? [0, 0.7, 1] : 0.8 }}
                      transition={{ duration: 0.5 }}
                    >
                      {log.message}
                    </motion.span>

                    {/* Hex code indicator */}
                    <span className="text-[9px] font-mono opacity-30 flex-shrink-0 ml-auto">
                      0x{Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase()}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* System status bar */}
          <div className="border-t border-cyan-500/30 p-2 bg-black/40">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2 text-green-500">
                <motion.div
                  animate={{
                    opacity: [1, 0.3, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity
                  }}
                >
                  ▶
                </motion.div>
                <span>SYSTEM ACTIVE</span>
              </div>
              <div className="text-cyan-400 opacity-60">
                NEURAL_ACTIVITY: HIGH | ENTROPY: LOW
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
