import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface QuantumParticlesProps {
  color: string;
  count?: number;
  className?: string;
}

export const QuantumParticles = ({ 
  color, 
  count = 20,
  className = "" 
}: QuantumParticlesProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: color,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            boxShadow: `0 0 ${particle.size * 2}px ${color}`
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Quantum uncertainty effect - particles blinking in and out */}
      {particles.slice(0, 10).map((particle) => (
        <motion.div
          key={`uncertainty-${particle.id}`}
          className="absolute rounded-full"
          style={{
            width: particle.size * 1.5,
            height: particle.size * 1.5,
            backgroundColor: color,
            left: `${(particle.x + 10) % 100}%`,
            top: `${(particle.y + 10) % 100}%`,
            filter: `blur(${particle.size}px)`
          }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.5, 1.2, 0.5]
          }}
          transition={{
            duration: particle.duration * 0.5,
            repeat: Infinity,
            delay: particle.delay + 0.5,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Wave-particle duality effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}10 0%, transparent 70%)`
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};
