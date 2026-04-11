/**
 * CatanDice — Animated Framer Motion dice pair
 * Enhanced with hyper-realistic subtle scuffs, worn edges, and emissive glow.
 */

import { motion } from 'framer-motion';

// Dot grid: 9 cells (3x3). Active cell indices for each value 1-6.
const DOT_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ value, isHighRoll }: { value: number; isHighRoll: boolean }) {
  const active = DOT_POSITIONS[value] ?? [];
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-[3px] w-full h-full p-2.5 relative z-10">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex items-center justify-center">
          {active.includes(i) && (
            <motion.div
              initial={{ boxShadow: '0px 0px 0px rgba(0,0,0,0)' }}
              animate={{ 
                boxShadow: isHighRoll 
                  ? '0px 0px 8px 1px rgba(239, 68, 68, 0.7)' 
                  : '0px 0px 6px 1px rgba(255, 255, 255, 0.4)'
              }}
              transition={{ delay: 0.8, duration: 1.5 }}
              className={`w-[9px] h-[9px] rounded-full shadow-inner ${isHighRoll ? 'bg-red-600' : 'bg-slate-800'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface CatanDiceProps {
  values: [number, number];
  /** Pass a roll-count integer; increment it to retrigger the animation */
  rollKey?: number;
  /** Show numeric total badge next to dice (default: false — pips only) */
  showTotal?: boolean;
}

export default function CatanDice({ values, rollKey = 0, showTotal = false }: CatanDiceProps) {
  const isHighRoll = values[0] + values[1] === 7;

  return (
    <div className="flex gap-3 items-center">
      {values.map((v, i) => (
        <motion.div
          key={`${rollKey}-${i}`}
          initial={{ rotate: 0, scale: 0.4, opacity: 0, y: -16 }}
          animate={{
            rotate: [0, -12, 16, -8, 0],
            scale: [0.4, 1.25, 0.9, 1.05, 1],
            opacity: 1,
            y: [-16, -22, 0],
          }}
          transition={{
            duration: 0.55,
            delay: i * 0.08,
            ease: 'easeOut',
          }}
          className={`relative w-14 h-14 rounded-2xl flex items-center justify-center
            border-b-4 overflow-hidden cursor-default select-none
            ${isHighRoll
              ? 'bg-[#ffe4cc] border-[#e6a87c] shadow-[0_4px_12px_rgba(251,146,60,0.4),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-2px_6px_rgba(0,0,0,0.15)]'
              : 'bg-[#f4f4f6] border-[#cbd5e1] shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_6px_rgba(0,0,0,0.1)]'
            }`}
        >
          {/* Subtle noise/scuff texture for worn appearance */}
          <div className="absolute inset-0 opacity-[0.25] mix-blend-multiply pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
          <DieFace value={v} isHighRoll={isHighRoll} />
        </motion.div>
      ))}

      {/* Total badge — only shown when showTotal is true (stats panel) */}
      {showTotal && (
        <motion.div
          key={`total-${rollKey}`}
          initial={{ scale: 0, opacity: 0, textShadow: '0px 0px 0px rgba(0,0,0,0)' }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            textShadow: isHighRoll ? '0px 0px 10px rgba(251,146,60,0.8)' : '0px 0px 8px rgba(255,255,255,0.3)'
          }}
          transition={{ delay: 0.3, duration: 0.8, type: 'spring', stiffness: 300 }}
          className={`text-3xl font-black tabular-nums min-w-[2rem] text-center
            ${isHighRoll ? 'text-orange-500' : 'text-slate-100'}`}
        >
          {values[0] + values[1]}
        </motion.div>
      )}
    </div>
  );
}
