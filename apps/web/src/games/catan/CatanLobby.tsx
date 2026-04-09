/**
 * CatanLobby — Pre-game setup screen
 * Difficulty selection, player names, AI players, board size.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Bot, Shuffle, Play, Map, Layers } from 'lucide-react';
import type { AIDifficulty } from './useCatanAI';

export type BoardSize = 'small' | 'standard' | 'large';

export interface LobbyConfig {
  players: Array<{ name: string; color: string; isAI: boolean }>;
  difficulty: AIDifficulty;
  boardSize: BoardSize;
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];
const DEFAULT_NAMES = ['Red', 'Blue', 'Orange', 'Green'];

interface CatanLobbyProps {
  onStart: (config: LobbyConfig) => void;
}

export default function CatanLobby({ onStart }: CatanLobbyProps) {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('standard');
  const [boardSize, setBoardSize] = useState<BoardSize>('standard');
  const [players, setPlayers] = useState<LobbyConfig['players']>([
    { name: 'Red',    color: PLAYER_COLORS[0], isAI: false },
    { name: 'Blue',   color: PLAYER_COLORS[1], isAI: true  },
    { name: 'Orange', color: PLAYER_COLORS[2], isAI: true  },
    { name: 'Green',  color: PLAYER_COLORS[3], isAI: true  },
  ]);

  const toggleAI = (i: number) =>
    setPlayers(p => p.map((pl, j) => j === i ? { ...pl, isAI: !pl.isAI } : pl));

  const rename = (i: number, name: string) =>
    setPlayers(p => p.map((pl, j) => j === i ? { ...pl, name: name.trim() || DEFAULT_NAMES[i] } : pl));

  const randomize = () =>
    setPlayers(p => [...p].sort(() => Math.random() - 0.5));

  const canStart = players.some(p => !p.isAI);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-cyan-950 to-emerald-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Map className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settlers of Catan</h1>
            <p className="text-slate-400 text-sm">Configure your game</p>
          </div>
        </div>

        {/* Players */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> Players
            </h2>
            <button
              onClick={randomize}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" /> Randomize
            </button>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <motion.div
                key={i}
                layout
                className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-white/5"
              >
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <input
                  value={p.name}
                  onChange={e => rename(i, e.target.value)}
                  disabled={p.isAI}
                  className="flex-1 bg-transparent text-white text-sm font-medium outline-none min-w-0
                    placeholder:text-slate-500 disabled:opacity-60"
                  maxLength={20}
                />
                <button
                  onClick={() => toggleAI(i)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors flex-shrink-0
                    ${p.isAI
                      ? 'bg-violet-600/70 text-violet-200 hover:bg-violet-500/80'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {p.isAI ? <><Bot className="w-3 h-3" />AI</> : <><Users className="w-3 h-3" />You</>}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Difficulty */}
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-violet-400" /> AI Difficulty
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(['beginner', 'standard', 'expert'] as AIDifficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`py-2 rounded-xl text-sm font-semibold capitalize transition-all border
                  ${difficulty === d
                    ? 'bg-violet-600 border-violet-400 text-white shadow-md shadow-violet-900/50'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* Board Size */}
        <section className="mb-7">
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" /> Board Size
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(['small', 'standard', 'large'] as BoardSize[]).map(s => (
              <button
                key={s}
                onClick={() => setBoardSize(s)}
                className={`py-2 rounded-xl text-sm font-semibold capitalize transition-all border
                  ${boardSize === s
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-900/50'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>
          {boardSize !== 'standard' && (
            <p className="text-xs text-amber-400 mt-2 text-center">
              Non-standard board uses the standard 19-tile layout (large variants coming soon)
            </p>
          )}
        </section>

        {/* Start */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={!canStart}
          onClick={() => onStart({ players, difficulty, boardSize })}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-600
            hover:from-orange-400 hover:to-red-500 disabled:opacity-40
            text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2
            shadow-xl shadow-orange-900/40 transition-all"
        >
          <Play className="w-5 h-5" />
          Start Game
        </motion.button>
      </motion.div>
    </div>
  );
}
