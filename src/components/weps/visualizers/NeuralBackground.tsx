import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Node {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface NeuralBackgroundProps {
  color: string;
  nodeCount?: number;
  className?: string;
}

export const NeuralBackground = ({ 
  color, 
  nodeCount = 15,
  className = ""
}: NeuralBackgroundProps) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const width = 400;
  const height = 300;
  const connectionDistance = 100;

  useEffect(() => {
    // Initialize nodes with random positions and velocities
    const initialNodes: Node[] = Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5
    }));
    setNodes(initialNodes);

    // Animate nodes
    const interval = setInterval(() => {
      setNodes(prevNodes =>
        prevNodes.map(node => {
          let { x, y, vx, vy } = node;
          
          x += vx;
          y += vy;

          // Bounce off edges
          if (x <= 0 || x >= width) vx *= -1;
          if (y <= 0 || y >= height) vy *= -1;

          // Keep within bounds
          x = Math.max(0, Math.min(width, x));
          y = Math.max(0, Math.min(height, y));

          return { ...node, x, y, vx, vy };
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [nodeCount]);

  // Calculate connections
  const connections = nodes.flatMap((node, i) =>
    nodes.slice(i + 1).map((otherNode) => {
      const dx = node.x - otherNode.x;
      const dy = node.y - otherNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < connectionDistance) {
        const opacity = 1 - distance / connectionDistance;
        return {
          x1: node.x,
          y1: node.y,
          x2: otherNode.x,
          y2: otherNode.y,
          opacity: opacity * 0.3
        };
      }
      return null;
    }).filter(Boolean)
  );

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="neural-bg-glow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Draw connections */}
        {connections.map((conn, i) => conn && (
          <motion.line
            key={`connection-${i}`}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke={color}
            strokeWidth="1"
            opacity={conn.opacity}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }}
          />
        ))}

        {/* Draw nodes */}
        {nodes.map((node) => (
          <motion.g key={node.id}>
            {/* Outer glow */}
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="4"
              fill={color}
              opacity="0.2"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: node.id * 0.1
              }}
            />
            {/* Inner node */}
            <circle
              cx={node.x}
              cy={node.y}
              r="2"
              fill={color}
              filter="url(#neural-bg-glow)"
              opacity="0.8"
            />
          </motion.g>
        ))}
      </svg>
    </div>
  );
};
