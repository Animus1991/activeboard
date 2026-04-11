/**
 * CatanResourceFeedback — Floating "+1 wood" / "+2 ore" toasts
 * Triggered after dice roll production or setup-phase initial resource gain.
 * Auto-dismisses after 3s. Stacks vertically.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ResourceType } from './CatanEngine';

const RES_EMOJI: Record<ResourceType, string> = {
  wood: '🪵', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '⛏️',
};

const RES_BG: Record<ResourceType, string> = {
  wood: 'bg-green-600/90', brick: 'bg-red-600/90', sheep: 'bg-lime-500/90',
  wheat: 'bg-yellow-500/90', ore: 'bg-slate-500/90',
};

export interface ResourceFeedbackEntry {
  id: string;
  playerName: string;
  playerColor: string;
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

interface Props {
  entries: ResourceFeedbackEntry[];
  onDismiss: (id: string) => void;
}

export default function CatanResourceFeedback({ entries, onDismiss }: Props) {
  // Auto-dismiss after 3.5s
  useEffect(() => {
    const timers = entries.map(e =>
      setTimeout(() => onDismiss(e.id), 3500)
    );
    return () => timers.forEach(clearTimeout);
  }, [entries, onDismiss]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-28 z-50 pointer-events-none flex flex-col items-center gap-1.5 w-full max-w-xs">
      <AnimatePresence>
        {entries.slice(-6).map(entry => (
          <motion.div
            key={entry.id}
            initial={{ y: -20, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`${RES_BG[entry.resource]} rounded-xl px-4 py-2 shadow-xl flex items-center gap-2.5 min-w-[160px] backdrop-blur-sm border border-white/15`}
          >
            <span className="text-xl">{RES_EMOJI[entry.resource]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-extrabold">
                +{entry.amount} {entry.resource}
              </div>
              <div className="text-white/60 text-[10px] truncate">{entry.playerName}</div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.playerColor }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
