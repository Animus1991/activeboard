/**
 * CatanLobby — Pre-game setup screen
 * Difficulty selection, player names, AI players, board size,
 * game mode, rules preview, and saved-game resume.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Bot, Shuffle, Play, Map, Layers,
  Wifi, WifiOff, Trophy, Clock, Save, Trash2,
  ChevronDown, ChevronUp, Shield, Swords,
} from 'lucide-react';
import type { AIDifficulty } from './useCatanAI';
import type { BoardSize } from './CatanEngine';

export interface LobbyConfig {
  players: Array<{ name: string; color: string; isAI: boolean }>;
  difficulty: AIDifficulty;
  boardSize: BoardSize;
  vpToWin: number;
  gameMode: 'solo' | 'online';
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];
const COLOR_NAMES = ['Red', 'Blue', 'Orange', 'Green'];
const DEFAULT_NAMES = ['You', 'Bot Alpha', 'Bot Beta', 'Bot Gamma'];

const BOARD_CONFIGS: Array<{ key: BoardSize; label: string; hexes: number; players: string; icon: string }> = [
  { key: 'standard', label: 'Classic',  hexes: 19, players: '3-4', icon: '⬡' },
  { key: 'large',    label: 'Large',    hexes: 37, players: '5-6', icon: '⬢' },
  { key: 'xlarge',   label: 'Epic',     hexes: 61, players: '3-8', icon: '🌍' },
];

const DIFFICULTY_META: Record<AIDifficulty, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  beginner:  { label: 'Beginner',  desc: 'Relaxed AI, random plays',      icon: <Shield className="w-4 h-4" />,  color: 'emerald' },
  standard:  { label: 'Standard',  desc: 'Balanced strategy',             icon: <Swords className="w-4 h-4" />,  color: 'violet' },
  expert:    { label: 'Expert',    desc: 'Ruthless optimization, harbour trades', icon: <Trophy className="w-4 h-4" />, color: 'red' },
};

interface CatanLobbyProps {
  onStart: (config: LobbyConfig) => void;
  hasSavedGame?: boolean;
  onLoadGame?: () => void;
  onDeleteSave?: () => void;
}

export default function CatanLobby({ onStart, hasSavedGame = false, onLoadGame, onDeleteSave }: CatanLobbyProps) {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('standard');
  const [boardSize, setBoardSize] = useState<BoardSize>('standard');
  const [vpToWin, setVpToWin] = useState(10);
  const [gameMode, setGameMode] = useState<'solo' | 'online'>('solo');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [players, setPlayers] = useState<LobbyConfig['players']>([
    { name: DEFAULT_NAMES[0], color: PLAYER_COLORS[0], isAI: false },
    { name: DEFAULT_NAMES[1], color: PLAYER_COLORS[1], isAI: true  },
    { name: DEFAULT_NAMES[2], color: PLAYER_COLORS[2], isAI: true  },
    { name: DEFAULT_NAMES[3], color: PLAYER_COLORS[3], isAI: true  },
  ]);

  const toggleAI = (i: number) =>
    setPlayers(p => p.map((pl, j) => j === i ? { ...pl, isAI: !pl.isAI, name: !pl.isAI ? DEFAULT_NAMES[j] : COLOR_NAMES[j] } : pl));

  const rename = (i: number, name: string) =>
    setPlayers(p => p.map((pl, j) => j === i ? { ...pl, name: name.trim() || COLOR_NAMES[i] } : pl));

  const randomize = () =>
    setPlayers(p => {
      const shuffled = [...p].sort(() => Math.random() - 0.5);
      return shuffled.map((pl, i) => ({ ...pl, color: PLAYER_COLORS[i] }));
    });

  const canStart = players.some(p => !p.isAI);
  const humanCount = players.filter(p => !p.isAI).length;
  const aiCount = players.filter(p => p.isAI).length;

  const boardConfig = useMemo(() => BOARD_CONFIGS.find(b => b.key === boardSize)!, [boardSize]);
  const diffMeta = DIFFICULTY_META[difficulty];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-cyan-950 to-emerald-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl max-h-[95vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/40">
            <Map className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settlers of Catan</h1>
            <p className="text-slate-400 text-sm">Configure your game</p>
          </div>
        </div>

        {/* Saved game resume */}
        {hasSavedGame && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 bg-amber-900/20 border border-amber-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Save className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">Saved game found</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onLoadGame}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors min-h-[44px]"
              >
                <Clock className="w-4 h-4" /> Resume
              </button>
              <button
                onClick={onDeleteSave}
                className="px-4 py-2.5 bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-white/5 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </motion.div>
        )}

        {/* Game Mode */}
        <section className="mb-5">
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'solo' as const,   icon: <WifiOff className="w-4 h-4" />, label: 'Solo vs AI',   desc: 'Play offline' },
              { key: 'online' as const, icon: <Wifi className="w-4 h-4" />,    label: 'Multiplayer',   desc: 'Play online' },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => setGameMode(m.key)}
                className={`py-3 px-3 rounded-xl text-left transition-all border min-h-[48px]
                  ${gameMode === m.key
                    ? 'bg-blue-600/30 border-blue-400/60 ring-1 ring-blue-400/30'
                    : 'bg-slate-800/60 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={gameMode === m.key ? 'text-blue-300' : 'text-slate-500'}>{m.icon}</span>
                  <span className={`text-sm font-bold ${gameMode === m.key ? 'text-white' : 'text-slate-400'}`}>{m.label}</span>
                </div>
                <p className={`text-xs ${gameMode === m.key ? 'text-blue-300/70' : 'text-slate-600'}`}>{m.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Players */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> Players
              <span className="text-xs text-slate-500 font-normal ml-1">({humanCount} human, {aiCount} AI)</span>
            </h2>
            <button
              onClick={randomize}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 min-h-[32px]"
            >
              <Shuffle className="w-3.5 h-3.5" /> Randomize
            </button>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <motion.div
                key={i}
                layout
                className="flex items-center gap-2.5 bg-slate-800/60 rounded-xl px-3 py-3 border border-white/5"
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white/10"
                  style={{ background: p.color }}
                />
                <input
                  value={p.name}
                  onChange={e => rename(i, e.target.value)}
                  disabled={p.isAI}
                  placeholder={COLOR_NAMES[i]}
                  className="flex-1 bg-transparent text-white text-sm font-medium outline-none min-w-0
                    placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-default"
                  maxLength={20}
                />
                <button
                  onClick={() => toggleAI(i)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 min-h-[36px] font-semibold
                    ${p.isAI
                      ? 'bg-violet-600/70 text-violet-200 hover:bg-violet-500/80'
                      : 'bg-emerald-700/60 text-emerald-200 hover:bg-emerald-600/70'}`}
                >
                  {p.isAI ? <><Bot className="w-3.5 h-3.5" /> AI</> : <><Users className="w-3.5 h-3.5" /> You</>}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* AI Difficulty */}
        {aiCount > 0 && (
          <section className="mb-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-violet-400" /> AI Difficulty
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'standard', 'expert'] as AIDifficulty[]).map(d => {
                const meta = DIFFICULTY_META[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2.5 px-2 rounded-xl text-center transition-all border min-h-[48px] flex flex-col items-center gap-1
                      ${active
                        ? `bg-${meta.color}-600 border-${meta.color}-400 text-white shadow-md`
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                    style={active ? {
                      background: d === 'beginner' ? '#059669' : d === 'standard' ? '#7c3aed' : '#dc2626',
                      borderColor: d === 'beginner' ? '#34d399' : d === 'standard' ? '#a78bfa' : '#f87171',
                    } : undefined}
                  >
                    <span className={active ? 'text-white' : 'text-slate-500'}>{meta.icon}</span>
                    <span className="text-sm font-bold">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">{diffMeta.desc}</p>
          </section>
        )}

        {/* Board Size */}
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" /> Board Size
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {BOARD_CONFIGS.map(s => (
              <button
                key={s.key}
                onClick={() => setBoardSize(s.key)}
                className={`py-2.5 rounded-xl transition-all border flex flex-col items-center min-h-[56px]
                  ${boardSize === s.key
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-900/50'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
              >
                <span className="text-lg leading-none mb-0.5">{s.icon}</span>
                <span className="text-sm font-bold">{s.label}</span>
                <span className="text-[10px] opacity-60 font-normal">{s.hexes} hexes</span>
              </button>
            ))}
          </div>
        </section>

        {/* Advanced Rules */}
        <section className="mb-6">
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-slate-400 hover:text-white transition-colors py-2"
          >
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" /> Game Rules
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-800/40 rounded-xl p-4 space-y-3 mt-1 border border-white/5">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide block mb-1.5">
                      Victory Points to Win
                    </label>
                    <div className="flex items-center gap-2">
                      {[8, 10, 12, 15].map(vp => (
                        <button
                          key={vp}
                          onClick={() => setVpToWin(vp)}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all min-h-[40px]
                            ${vpToWin === vp
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}
                        >
                          {vp} VP
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>• Board: <span className="text-slate-300 font-medium">{boardConfig.label}</span> — {boardConfig.hexes} hexes, {boardConfig.players} players</p>
                    <p>• First to {vpToWin} VP wins</p>
                    <p>• Robber activates on 7, discard on 8+ cards</p>
                    <p>• Longest Road (5+) and Largest Army (3+) worth 2 VP each</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Start */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={!canStart}
          onClick={() => onStart({ players, difficulty, boardSize, vpToWin, gameMode })}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600
            hover:from-orange-400 hover:to-red-500 disabled:opacity-40
            text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2
            shadow-xl shadow-orange-900/40 transition-all min-h-[52px]"
        >
          <Play className="w-5 h-5" />
          {gameMode === 'online' ? 'Create Room' : 'Start Game'}
        </motion.button>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-600 mt-3">
          {gameMode === 'online' ? 'A room code will be generated to share with friends' : `${humanCount} human vs ${aiCount} AI — ${diffMeta.label} difficulty`}
        </p>
      </motion.div>
    </div>
  );
}
