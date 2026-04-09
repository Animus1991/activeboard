/**
 * CatanHUDFeatures — Extended HUD features ported from ABAS
 *
 * Focused, decomposed components (not a single massive file):
 *  - TutorialOverlay: Step-by-step guided tutorial
 *  - RulesReference: Searchable rules panel
 *  - GameChat: In-game messaging system
 *  - SaveLoadPanel: localStorage game persistence
 *  - ReplayControls: Action log playback
 *  - DiceHistoryChart: Visual dice distribution
 *  - ResourceGainNotification: Floating +resource badges
 *  - ZoomControls: HUD zoom buttons
 *  - KeyboardControls: WASD camera movement hook
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { GameState, ResourceType, GameLogEntry } from './CatanEngine';

// ============================================================================
// 1. TUTORIAL SYSTEM
// ============================================================================

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlight?: string; // CSS selector or element ID to highlight
  action?: string;    // Expected action to advance
}

const CATAN_TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', title: 'Welcome to Catan!', description: 'This tutorial will guide you through the basics of playing Settlers of Catan. Click Next to continue.' },
  { id: 'board', title: 'The Board', description: 'The board is made up of hexagonal tiles, each producing a different resource. The number on each tile shows when it produces resources.' },
  { id: 'setup-settlement', title: 'Place Your First Settlement', description: 'Click on a golden vertex marker to place your first settlement. Settlements earn you resources from adjacent hexes.', action: 'build-settlement' },
  { id: 'setup-road', title: 'Place a Road', description: 'Now place a road extending from your settlement. Roads let you expand to new areas.', action: 'build-road' },
  { id: 'rolling', title: 'Roll the Dice', description: 'Click "Roll Dice" to start your turn. The number rolled determines which hexes produce resources for everyone.' },
  { id: 'resources', title: 'Resources', description: 'You collect resources (Wood, Brick, Sheep, Wheat, Ore) from hexes adjacent to your settlements. Use them to build!' },
  { id: 'building', title: 'Building', description: 'Build settlements (1 VP), upgrade to cities (2 VP), extend roads, and buy development cards.' },
  { id: 'trading', title: 'Trading', description: 'Trade with the bank (4:1), at harbors (2:1 or 3:1), or propose trades to other players.' },
  { id: 'robber', title: 'The Robber', description: 'When a 7 is rolled, the robber activates. Players with 8+ cards must discard half, then you move the robber to block a hex.' },
  { id: 'victory', title: 'Winning', description: 'First to 10 Victory Points wins! Earn points from settlements (1), cities (2), longest road (+2), largest army (+2), and VP cards.' },
  { id: 'done', title: 'Tutorial Complete!', description: 'You\'re ready to play! Good luck and have fun!' },
];

interface TutorialOverlayProps {
  isActive: boolean;
  onClose: () => void;
}

export function TutorialOverlay({ isActive, onClose }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);

  if (!isActive) return null;
  const step = CATAN_TUTORIAL_STEPS[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === CATAN_TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full">
      <div className="bg-gray-900/95 border border-amber-500/40 rounded-xl p-5 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-amber-400 text-xs font-mono">
            Step {stepIndex + 1} / {CATAN_TUTORIAL_STEPS.length}
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <h3 className="text-white font-bold text-lg mb-1">{step.title}</h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">{step.description}</p>
        <div className="flex gap-2 justify-end">
          {stepIndex > 0 && (
            <button
              onClick={() => setStepIndex(i => i - 1)}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600"
            >
              Back
            </button>
          )}
          <button
            onClick={() => isLast ? onClose() : setStepIndex(i => i + 1)}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 font-semibold"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. RULES REFERENCE
// ============================================================================

const CATAN_RULES = [
  { title: 'Setup', content: 'Each player places 2 settlements and 2 roads. First round: place 1 settlement + 1 road clockwise. Second round: reverse order, gain resources from 2nd settlement.' },
  { title: 'Turn Order', content: 'Roll dice → Collect resources → Trade / Build → End turn.' },
  { title: 'Resources', content: 'Wood (Forest), Brick (Hills), Sheep (Pasture), Wheat (Fields), Ore (Mountains). Desert produces nothing.' },
  { title: 'Building Costs', content: 'Road: 1 Wood + 1 Brick. Settlement: 1 Wood + 1 Brick + 1 Sheep + 1 Wheat. City: 2 Wheat + 3 Ore. Dev Card: 1 Sheep + 1 Wheat + 1 Ore.' },
  { title: 'The Robber', content: 'When a 7 is rolled: players with 8+ cards discard half (rounded down). Active player moves robber to any hex (blocks production), then steals 1 random card from adjacent opponent.' },
  { title: 'Development Cards', content: 'Knight: move robber + steal. Victory Point: +1 VP (hidden). Road Building: 2 free roads. Year of Plenty: take 2 resources. Monopoly: take all of 1 resource from everyone.' },
  { title: 'Trading', content: 'Bank trade: 4:1 (any 4 same → 1 any). Harbor 3:1: any 3 same → 1 any. Harbor 2:1: 2 specific → 1 any. Player trade: negotiate any terms.' },
  { title: 'Longest Road', content: '+2 VP to player with longest continuous road of 5+ segments. Recalculated when roads are built.' },
  { title: 'Largest Army', content: '+2 VP to player with most Knights played (minimum 3). Recalculated when Knights are played.' },
  { title: 'Victory', content: 'First player to reach 10 VP on their turn wins. VP = settlements(1) + cities(2) + longest road(2) + largest army(2) + VP cards.' },
];

interface RulesReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesReference({ isOpen, onClose }: RulesReferenceProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = search
    ? CATAN_RULES.filter(r =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.content.toLowerCase().includes(search.toLowerCase()))
    : CATAN_RULES;

  return (
    <div className="fixed right-4 top-20 z-50 w-80 max-h-[70vh] overflow-y-auto">
      <div className="bg-gray-900/95 border border-blue-500/40 rounded-xl shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h3 className="text-blue-400 font-bold text-sm">📖 Rules Reference</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="p-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rules..."
            className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="p-3 pt-0 space-y-3">
          {filtered.map((rule, i) => (
            <div key={i}>
              <h4 className="text-amber-300 font-semibold text-xs mb-0.5">{rule.title}</h4>
              <p className="text-gray-400 text-xs leading-relaxed">{rule.content}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-4">No matching rules found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. GAME CHAT
// ============================================================================

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  text: string;
  timestamp: number;
}

interface GameChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentPlayerId: string;
}

export function GameChat({ isOpen, onClose, messages, onSend, currentPlayerId }: GameChatProps) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <div className="fixed left-4 bottom-20 z-50 w-72">
      <div className="bg-gray-900/95 border border-green-500/40 rounded-xl shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h3 className="text-green-400 font-bold text-sm">💬 Chat</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div ref={scrollRef} className="p-3 max-h-60 overflow-y-auto space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className={`text-xs ${msg.playerId === currentPlayerId ? 'text-right' : ''}`}>
              <span style={{ color: msg.playerColor }} className="font-semibold">
                {msg.playerName}:
              </span>{' '}
              <span className="text-gray-300">{msg.text}</span>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-4">No messages yet.</p>
          )}
        </div>
        <div className="flex gap-2 p-3 border-t border-gray-700">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleSend}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. SAVE / LOAD
// ============================================================================

const SAVE_KEY = 'tableforge-catan-save';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch { return null; }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

interface SaveLoadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onLoad: () => void;
  hasSave: boolean;
}

export function SaveLoadPanel({ isOpen, onClose, onSave, onLoad, hasSave }: SaveLoadPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
      <div className="bg-gray-900/95 border border-purple-500/40 rounded-xl p-6 shadow-2xl backdrop-blur-sm min-w-[280px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-purple-400 font-bold">💾 Save / Load</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => { onSave(); onClose(); }}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-semibold text-sm"
          >
            💾 Save Game
          </button>
          <button
            onClick={() => { onLoad(); onClose(); }}
            disabled={!hasSave}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📂 Load Game
          </button>
          <p className="text-gray-500 text-xs text-center">
            {hasSave ? 'Saved game found in local storage.' : 'No saved game found.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. REPLAY CONTROLS
// ============================================================================

interface ReplayControlsProps {
  isActive: boolean;
  log: GameLogEntry[];
  currentIndex: number;
  onStep: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onClose: () => void;
  isPlaying: boolean;
}

export function ReplayControls({ isActive, log, currentIndex, onStep, onPlay, onPause, onClose, isPlaying }: ReplayControlsProps) {
  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-gray-900/95 border border-cyan-500/40 rounded-xl px-5 py-3 shadow-2xl backdrop-blur-sm flex items-center gap-3">
        <span className="text-cyan-400 text-xs font-mono">Replay</span>
        <button onClick={() => onStep(0)} className="text-white hover:text-cyan-300 text-sm">⏮</button>
        <button onClick={() => onStep(Math.max(0, currentIndex - 1))} className="text-white hover:text-cyan-300 text-sm">⏪</button>
        {isPlaying ? (
          <button onClick={onPause} className="text-white hover:text-cyan-300 text-lg">⏸</button>
        ) : (
          <button onClick={onPlay} className="text-white hover:text-cyan-300 text-lg">▶️</button>
        )}
        <button onClick={() => onStep(Math.min(log.length - 1, currentIndex + 1))} className="text-white hover:text-cyan-300 text-sm">⏩</button>
        <button onClick={() => onStep(log.length - 1)} className="text-white hover:text-cyan-300 text-sm">⏭</button>
        <span className="text-gray-400 text-xs">{currentIndex + 1} / {log.length}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs ml-2">✕</button>
      </div>
    </div>
  );
}

// ============================================================================
// 6. DICE HISTORY CHART
// ============================================================================

interface DiceHistoryChartProps {
  isOpen: boolean;
  onClose: () => void;
  history: number[]; // array of dice totals (2-12)
}

export function DiceHistoryChart({ isOpen, onClose, history }: DiceHistoryChartProps) {
  if (!isOpen) return null;

  const counts = useMemo(() => {
    const c: Record<number, number> = {};
    for (let i = 2; i <= 12; i++) c[i] = 0;
    for (const total of history) c[total] = (c[total] || 0) + 1;
    return c;
  }, [history]);

  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="fixed right-4 bottom-20 z-50 w-72">
      <div className="bg-gray-900/95 border border-orange-500/40 rounded-xl shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h3 className="text-orange-400 font-bold text-sm">🎲 Dice History ({history.length} rolls)</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="p-3 flex items-end gap-1 h-32">
          {Array.from({ length: 11 }, (_, i) => i + 2).map(n => {
            const h = (counts[n] / max) * 100;
            const isHot = n === 6 || n === 8;
            return (
              <div key={n} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">{counts[n]}</span>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${h}%`,
                    minHeight: counts[n] > 0 ? 4 : 0,
                    backgroundColor: isHot ? '#E53E3E' : '#4A9BD9',
                  }}
                />
                <span className={`text-[10px] font-mono ${isHot ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. RESOURCE GAIN NOTIFICATIONS
// ============================================================================

export interface ResourceGain {
  id: string;
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

interface ResourceGainNotificationsProps {
  gains: ResourceGain[];
}

const RESOURCE_EMOJI: Record<ResourceType, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛏️',
};

const RESOURCE_NOTIFICATION_COLORS: Record<ResourceType, string> = {
  wood: 'bg-green-800/80 border-green-500/50',
  brick: 'bg-red-900/80 border-red-500/50',
  sheep: 'bg-lime-800/80 border-lime-500/50',
  wheat: 'bg-yellow-800/80 border-yellow-500/50',
  ore: 'bg-slate-700/80 border-slate-400/50',
};

export function ResourceGainNotifications({ gains }: ResourceGainNotificationsProps) {
  const [visible, setVisible] = useState<ResourceGain[]>([]);

  useEffect(() => {
    if (gains.length === 0) return;
    const latest = gains[gains.length - 1];
    setVisible(prev => [...prev, latest]);

    const timeout = setTimeout(() => {
      setVisible(prev => prev.filter(g => g.id !== latest.id));
    }, 2000);

    return () => clearTimeout(timeout);
  }, [gains.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed top-24 right-4 z-40 flex flex-col gap-1.5 items-end">
      {visible.map((gain, i) => (
        <div
          key={gain.id}
          className={`px-3 py-1.5 rounded-lg border text-sm font-bold text-white animate-bounce ${RESOURCE_NOTIFICATION_COLORS[gain.resource]}`}
          style={{ animationDuration: '0.6s', opacity: 1 - i * 0.15 }}
        >
          +{gain.amount} {RESOURCE_EMOJI[gain.resource]} {gain.resource}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 8. ZOOM CONTROLS
// ============================================================================

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut, onZoomFit }: ZoomControlsProps) {
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5">
      <button
        onClick={onZoomIn}
        className="w-9 h-9 bg-gray-800/90 border border-gray-600 rounded-lg text-white hover:bg-gray-700 flex items-center justify-center text-lg font-bold"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={onZoomFit}
        className="w-9 h-9 bg-gray-800/90 border border-gray-600 rounded-lg text-white hover:bg-gray-700 flex items-center justify-center text-xs font-mono"
        title="Fit to View"
      >
        ⊞
      </button>
      <button
        onClick={onZoomOut}
        className="w-9 h-9 bg-gray-800/90 border border-gray-600 rounded-lg text-white hover:bg-gray-700 flex items-center justify-center text-lg font-bold"
        title="Zoom Out"
      >
        −
      </button>
    </div>
  );
}

// ============================================================================
// 9. KEYBOARD CAMERA CONTROLS HOOK
// ============================================================================

export function useKeyboardControls(orbitRef: React.RefObject<any>) {
  useEffect(() => {
    const keys = new Set<string>();
    const speed = 0.15;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(e.key.toLowerCase())) {
        keys.add(e.key.toLowerCase());
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const ctrl = orbitRef.current;
      if (!ctrl?.target) return;

      if (keys.has('w')) ctrl.target.z -= speed;
      if (keys.has('s')) ctrl.target.z += speed;
      if (keys.has('a')) ctrl.target.x -= speed;
      if (keys.has('d')) ctrl.target.x += speed;
      if (keys.has('q')) ctrl.target.y += speed * 0.5;
      if (keys.has('e')) ctrl.target.y -= speed * 0.5;

      if (keys.size > 0) ctrl.update();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, [orbitRef]);
}
