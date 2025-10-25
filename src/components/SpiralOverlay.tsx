import React from "react";

export const SpiralOverlay = ({ phase }: { phase: string }) => {
  const colorMap: Record<string, string> = {
    Growth: "rgba(16,185,129,0.2)",
    Decay: "rgba(239,68,68,0.2)",
    Rebirth: "rgba(168,85,247,0.25)",
    Death: "rgba(255,255,255,0.05)",
    Neutral: "rgba(230,185,81,0.1)",
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 50%, ${colorMap[phase]} 0%, transparent 70%)`,
        transition: "background 1s ease-in-out",
        animation: "pulse 4s infinite",
      }}
    >
      <style>{`
        @keyframes pulse {
          0% {opacity: 0.4;}
          50% {opacity: 0.8;}
          100% {opacity: 0.4;}
        }
      `}</style>
    </div>
  );
};
