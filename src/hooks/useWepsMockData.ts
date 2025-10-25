import { useEffect, useState } from "react";

const PHASES = ["Growth", "Decay", "Rebirth", "Death", "Neutral"];
const BIO_STATES = ["Aggressive", "Defensive", "Stable", "Volatile"];

export function useWepsMockData(symbol: string) {
  const [phase, setPhase] = useState("Neutral");
  const [bioState, setBioState] = useState("Stable");
  const [confidence, setConfidence] = useState(0.5);
  const [volatility, setVolatility] = useState(0.3);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomPhase = PHASES[Math.floor(Math.random() * PHASES.length)];
      const randomBio = BIO_STATES[Math.floor(Math.random() * BIO_STATES.length)];
      const randomConfidence = Math.random();
      const randomVol = Math.random();

      setPhase(randomPhase);
      setBioState(randomBio);
      setConfidence(randomConfidence);
      setVolatility(randomVol);
    }, 5000); // update every 5s

    return () => clearInterval(interval);
  }, [symbol]);

  return { phase, bioState, confidence, volatility };
}
