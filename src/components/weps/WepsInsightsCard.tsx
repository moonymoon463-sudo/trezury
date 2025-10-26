import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NeuralNetworkIcon } from "./icons/NeuralNetworkIcon";
import { CircularProgress } from "./visualizers/CircularProgress";
import { WaveformChart } from "./visualizers/WaveformChart";
import { NeuralBackground } from "./visualizers/NeuralBackground";
import { HolographicGlitch } from "./effects/HolographicGlitch";
import { QuantumParticles } from "./effects/QuantumParticles";
interface WepsInsightsCardProps {
  phase: string;
  bioState: string;
  confidence: number;
  volatility: number;
}

// Phase color configurations
const phaseColors: Record<string, {
  primary: string;
  secondary: string;
  glow: string;
}> = {
  Growth: {
    primary: "#10b981",
    secondary: "#06b6d4",
    glow: "#10b98150"
  },
  Decay: {
    primary: "#ef4444",
    secondary: "#f59e0b",
    glow: "#ef444450"
  },
  Rebirth: {
    primary: "#a855f7",
    secondary: "#ec4899",
    glow: "#a855f750"
  },
  Death: {
    primary: "#ffffff",
    secondary: "#e5e7eb",
    glow: "#ffffff30"
  },
  Neutral: {
    primary: "#e6b951",
    secondary: "#f59e0b",
    glow: "#e6b95150"
  }
};
export const WepsInsightsCard = ({
  phase,
  bioState,
  confidence,
  volatility
}: WepsInsightsCardProps) => {
  const colors = phaseColors[phase] || phaseColors.Neutral;

  // Phase-specific messages
  const phaseMessages: Record<string, string> = {
    Growth: "Ecosystem expansion detected • Accumulation phase active",
    Decay: "Energy dissipation in progress • Caution advised",
    Rebirth: "Metamorphosis initiated • New cycle emerging",
    Death: "Entropy maximized • Awaiting rebirth signal",
    Neutral: "System equilibrium maintained • Monitoring fluctuations"
  };
  return <motion.div initial={{
    opacity: 0,
    y: 20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.5
  }} className="relative">
      <Card className="relative overflow-hidden bg-black/40 border-0">
        {/* Animated gradient border */}
        <motion.div className="absolute inset-0 rounded-lg" style={{
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
        backgroundSize: "200% 200%",
        padding: "2px"
      }} animate={{
        backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"]
      }} transition={{
        duration: 3,
        repeat: Infinity,
        ease: "linear"
      }}>
          <div className="w-full h-full bg-background rounded-lg" />
        </motion.div>

        {/* Neural background */}
        <NeuralBackground color={colors.primary} nodeCount={12} className="opacity-20" />

        {/* Quantum particles */}
        <QuantumParticles color={colors.primary} count={15} className="opacity-30" />

        {/* Content */}
        <div className="relative p-4 space-y-4">
          {/* Header with holographic title */}
          <div className="flex items-start justify-between">
            <HolographicGlitch intensity={0.3}>
              <div className="flex items-center gap-3">
                <motion.div animate={{
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }} transition={{
                rotate: {
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear"
                },
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}>
                  <NeuralNetworkIcon size={32} color={colors.primary} />
                </motion.div>
                <div>
                  <motion.h3 className="text-xl font-bold" style={{
                  background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }} animate={{
                  backgroundPosition: ["0% 0%", "200% 0%", "0% 0%"]
                }} transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}>WEPS Bio-Adaptive Mode</motion.h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Market Intelligence System
                  </p>
                </div>
              </div>
            </HolographicGlitch>

            {/* Pulsing status badge */}
            <motion.div animate={{
            scale: [1, 1.05, 1],
            boxShadow: [`0 0 10px ${colors.glow}`, `0 0 20px ${colors.glow}`, `0 0 10px ${colors.glow}`]
          }} transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}>
              <Badge variant="outline" className="border-2 font-mono" style={{
              borderColor: colors.primary,
              color: colors.primary,
              backgroundColor: `${colors.glow}`
            }}>
                ACTIVE
              </Badge>
            </motion.div>
          </div>

          {/* Metrics grid with circular progress */}
          <div className="grid grid-cols-3 gap-4">
            <motion.div className="flex flex-col items-center" whileHover={{
            scale: 1.05
          }} transition={{
            type: "spring",
            stiffness: 300
          }}>
              <CircularProgress value={confidence * 100} color={colors.primary} label="CONF" size={70} strokeWidth={5} />
            </motion.div>

            <motion.div className="flex flex-col items-center justify-center space-y-1" whileHover={{
            scale: 1.05
          }}>
              <Badge className="px-3 py-1 text-sm font-bold" style={{
              backgroundColor: colors.primary,
              color: "#000"
            }}>
                {phase}
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Phase
              </span>
            </motion.div>

            <motion.div className="flex flex-col items-center justify-center space-y-1" whileHover={{
            scale: 1.05
          }}>
              <motion.div className="text-lg font-bold font-mono" style={{
              color: colors.primary
            }} animate={{
              textShadow: [`0 0 10px ${colors.glow}`, `0 0 20px ${colors.glow}`, `0 0 10px ${colors.glow}`]
            }} transition={{
              duration: 2,
              repeat: Infinity
            }}>
                {bioState}
              </motion.div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Bio State
              </span>
            </motion.div>
          </div>

          {/* Waveform visualization */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                Volatility Analysis
              </span>
              <motion.span className="text-xs font-bold font-mono" style={{
              color: colors.primary
            }} animate={{
              opacity: [0.7, 1, 0.7]
            }} transition={{
              duration: 1.5,
              repeat: Infinity
            }}>
                LIVE
              </motion.span>
            </div>
            <WaveformChart volatility={volatility * 100} color={colors.primary} />
          </div>

          {/* Phase message with terminal styling */}
          <motion.div className="relative p-3 rounded border" style={{
          borderColor: colors.primary,
          backgroundColor: `${colors.glow}`
        }} initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.5
        }}>
            <div className="flex items-start gap-2">
              <motion.div className="w-2 h-2 rounded-full mt-1" style={{
              backgroundColor: colors.primary
            }} animate={{
              opacity: [1, 0.3, 1],
              scale: [1, 0.8, 1]
            }} transition={{
              duration: 2,
              repeat: Infinity
            }} />
              <p className="text-xs font-mono leading-relaxed" style={{
              color: colors.primary
            }}>
                {phaseMessages[phase] || phaseMessages.Neutral}
              </p>
            </div>
            
            {/* Terminal cursor */}
            <motion.div className="absolute bottom-3 right-3 w-1.5 h-3" style={{
            backgroundColor: colors.primary
          }} animate={{
            opacity: [1, 0, 1]
          }} transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }} />
          </motion.div>

          {/* Stats bar */}
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
              <span>MODE: ADAPTIVE</span>
              <span>•</span>
              <span>SYNC: 100%</span>
            </div>
            <motion.div className="flex items-center gap-1" animate={{
            opacity: [0.5, 1, 0.5]
          }} transition={{
            duration: 2,
            repeat: Infinity
          }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{
              backgroundColor: colors.primary
            }} />
              <span className="text-[10px] font-mono" style={{
              color: colors.primary
            }}>
                PROCESSING
              </span>
            </motion.div>
          </div>
        </div>
      </Card>
    </motion.div>;
};