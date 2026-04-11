/**
 * CatanCarouselHUD — Swipeable horizontal card carousel
 * 
 * Cards:
 * 1. Resources — current hand + maritime rates
 * 2. Assets — settlements, cities, roads built/remaining
 * 3. Build Costs — what each item costs + whether affordable
 * 4. Bank Trade — quick 4:1/3:1/2:1 trade interface
 * 5. Player Trade — propose/view trade offers
 * 6. Dev Cards — hand + special cards info
 * 7. (Swipe past last → board view, no card)
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Package, Building2, Route, Coins, Handshake, ScrollText,
  ChevronLeft, ChevronRight, Sword, ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import {
  type GameState,
  type Player,
  type ResourceType,
  BUILDING_COSTS,
  getPlayerTradeRatio,
  hasResources,
} from './CatanEngine';

// ── Resource metadata ─────────────────────────────────────────────────────────

const RES_ORDER: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

const RES_META: Record<ResourceType, { label: string; color: string; bgClass: string; emoji: string }> = {
  wood:  { label: 'Wood',  color: '#22c55e', bgClass: 'bg-green-600',  emoji: '🪵' },
  brick: { label: 'Brick', color: '#ef4444', bgClass: 'bg-red-600',    emoji: '🧱' },
  sheep: { label: 'Sheep', color: '#84cc16', bgClass: 'bg-lime-500',   emoji: '🐑' },
  wheat: { label: 'Wheat', color: '#eab308', bgClass: 'bg-yellow-500', emoji: '🌾' },
  ore:   { label: 'Ore',   color: '#64748b', bgClass: 'bg-slate-500',  emoji: '⛏️' },
};

const BUILD_ITEMS = [
  { key: 'road',       label: 'Road',       icon: '🛤️', cost: BUILDING_COSTS.road },
  { key: 'settlement', label: 'Settlement', icon: '🏠', cost: BUILDING_COSTS.settlement },
  { key: 'city',       label: 'City',       icon: '🏙️', cost: BUILDING_COSTS.city },
  { key: 'devCard',    label: 'Dev Card',   icon: '📜', cost: { sheep: 1, wheat: 1, ore: 1 } },
] as const;

// ── Card definitions ──────────────────────────────────────────────────────────

interface CardDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const CARD_DEFS: CardDef[] = [
  { id: 'resources', title: 'Resources',    icon: <Package className="w-4 h-4" />,    color: 'text-green-400' },
  { id: 'assets',    title: 'Assets',       icon: <Building2 className="w-4 h-4" />,  color: 'text-blue-400' },
  { id: 'costs',     title: 'Build Costs',  icon: <Coins className="w-4 h-4" />,      color: 'text-amber-400' },
  { id: 'bank',      title: 'Bank Trade',   icon: <ShieldCheck className="w-4 h-4" />,color: 'text-teal-400' },
  { id: 'trade',     title: 'Player Trade', icon: <Handshake className="w-4 h-4" />,  color: 'text-purple-400' },
  { id: 'devcards',  title: 'Dev Cards',    icon: <ScrollText className="w-4 h-4" />, color: 'text-orange-400' },
];

// ── Main export ───────────────────────────────────────────────────────────────

interface CarouselHUDProps {
  gameState: GameState;
  playerId: string;
  onBankTrade: (give: ResourceType, receive: ResourceType) => void;
  onOpenFullTrade: () => void;
  onBuild: (type: 'road' | 'settlement' | 'city') => void;
  onBuyDevCard: () => void;
}

export default function CatanCarouselHUD({
  gameState, playerId, onBankTrade, onOpenFullTrade, onBuild, onBuyDevCard,
}: CarouselHUDProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const player = gameState.players.find(p => p.id === playerId)!;
  const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0);

  // Swipe navigation
  const goTo = useCallback((idx: number, dir: number) => {
    // Allow going 1 past last → hides the panel (board view)
    const clamped = Math.max(-1, Math.min(CARD_DEFS.length - 1, idx));
    setDirection(dir);
    setActiveIndex(clamped);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      goTo(activeIndex + 1, 1);
    } else if (info.offset.x > threshold) {
      goTo(activeIndex - 1, -1);
    }
  }, [activeIndex, goTo]);

  // If index is -1, show nothing (board view)
  const isHidden = activeIndex < 0;

  // Bank trade state
  const [bankGive, setBankGive] = useState<ResourceType>('wood');
  const [bankReceive, setBankReceive] = useState<ResourceType>('wheat');

  const activeCard = CARD_DEFS[activeIndex];

  return (
    <div className="w-full">
      {/* Dot indicators + card title */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <button
          onClick={() => goTo(activeIndex - 1, -1)}
          className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          disabled={activeIndex <= -1}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {CARD_DEFS.map((card, i) => (
          <button
            key={card.id}
            onClick={() => goTo(i, i > activeIndex ? 1 : -1)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === activeIndex
                ? 'bg-white scale-125'
                : 'bg-white/25 hover:bg-white/40'
            }`}
            title={card.title}
          />
        ))}

        <button
          onClick={() => goTo(activeIndex + 1, 1)}
          className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          disabled={activeIndex >= CARD_DEFS.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Card header */}
      {!isHidden && activeCard && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className={activeCard.color}>{activeCard.icon}</span>
          <span className="text-sm font-bold text-white">{activeCard.title}</span>
          <span className="text-[10px] text-white/30 ml-auto">{activeIndex + 1}/{CARD_DEFS.length}</span>
        </div>
      )}

      {/* Swipeable card container */}
      <div ref={constraintsRef} className="overflow-hidden relative min-h-[180px]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {!isHidden && (
            <motion.div
              key={activeCard?.id}
              custom={direction}
              initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              className="w-full touch-pan-y"
            >
              {activeCard?.id === 'resources' && (
                <ResourcesCard player={player} gameState={gameState} totalCards={totalCards} />
              )}
              {activeCard?.id === 'assets' && (
                <AssetsCard player={player} />
              )}
              {activeCard?.id === 'costs' && (
                <BuildCostsCard player={player} onBuild={onBuild} onBuyDevCard={onBuyDevCard} />
              )}
              {activeCard?.id === 'bank' && (
                <BankTradeCard
                  player={player}
                  gameState={gameState}
                  bankGive={bankGive}
                  bankReceive={bankReceive}
                  onGiveChange={setBankGive}
                  onReceiveChange={setBankReceive}
                  onTrade={onBankTrade}
                />
              )}
              {activeCard?.id === 'trade' && (
                <PlayerTradeCard
                  gameState={gameState}
                  playerId={playerId}
                  onOpenFull={onOpenFullTrade}
                />
              )}
              {activeCard?.id === 'devcards' && (
                <DevCardsCard player={player} gameState={gameState} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isHidden && (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            <button
              onClick={() => goTo(0, 1)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              Show HUD Cards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 1 — Resources
// ═══════════════════════════════════════════════════════════════════════════════

function ResourcesCard({ player, gameState, totalCards }: { player: Player; gameState: GameState; totalCards: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {RES_ORDER.map(res => {
          const count = player.resources[res];
          const ratio = getPlayerTradeRatio(gameState, player.id, res);
          const meta = RES_META[res];
          return (
            <div
              key={res}
              className={`${meta.bgClass} rounded-xl p-2 text-center transition-all ${
                count > 0 ? 'ring-1 ring-white/20 scale-100' : 'opacity-50 scale-95'
              }`}
            >
              <div className="text-lg leading-none mb-1">{meta.emoji}</div>
              <div className="text-white text-lg font-extrabold">{count}</div>
              <div className="text-white/60 text-[9px] font-semibold mt-0.5">{ratio}:1</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-400">Total cards: <span className="text-white font-bold">{totalCards}</span></span>
        {totalCards > 7 && (
          <span className="text-red-400 font-bold animate-pulse">⚠ Over 7!</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 2 — Assets
// ═══════════════════════════════════════════════════════════════════════════════

function AssetsCard({ player }: { player: Player }) {
  const assets = [
    { label: 'Settlements', icon: '🏠', used: 5 - player.settlements, total: 5, color: 'text-green-400' },
    { label: 'Cities',      icon: '🏙️', used: 4 - player.cities,      total: 4, color: 'text-blue-400' },
    { label: 'Roads',       icon: '🛤️', used: 15 - player.roads,      total: 15, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-3">
      {assets.map(a => (
        <div key={a.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
          <span className="text-xl">{a.icon}</span>
          <div className="flex-1">
            <div className="text-xs text-slate-400">{a.label}</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-extrabold ${a.color}`}>{a.used}</span>
              <span className="text-white/30 text-xs">/ {a.total} built</span>
            </div>
          </div>
          {/* Visual progress bar */}
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(a.used / a.total) * 100}%`,
                background: a.color.includes('green') ? '#22c55e' : a.color.includes('blue') ? '#3b82f6' : '#f59e0b',
              }}
            />
          </div>
        </div>
      ))}

      {/* Badges */}
      <div className="flex gap-2">
        {player.hasLongestRoad && (
          <div className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg px-2.5 py-1.5">
            <Route className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300 font-semibold">Longest Road</span>
          </div>
        )}
        {player.hasLargestArmy && (
          <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/30 rounded-lg px-2.5 py-1.5">
            <Sword className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-300 font-semibold">Largest Army</span>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-3 px-1">
        <span>⚔ Knights: {player.playedKnights}</span>
        <span>📜 Dev cards: {player.developmentCards.length}</span>
        <span>⭐ VP: {player.victoryPoints}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 3 — Build Costs
// ═══════════════════════════════════════════════════════════════════════════════

function BuildCostsCard({
  player,
  onBuild,
  onBuyDevCard,
}: {
  player: Player;
  onBuild: (type: 'road' | 'settlement' | 'city') => void;
  onBuyDevCard: () => void;
}) {
  return (
    <div className="space-y-2">
      {BUILD_ITEMS.map(item => {
        const canAfford = hasResources(player, item.cost);
        return (
          <div
            key={item.key}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
              canAfford
                ? 'bg-green-900/20 border border-green-500/25'
                : 'bg-white/5 border border-transparent'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">{item.label}</div>
              <div className="flex gap-1 mt-0.5">
                {RES_ORDER.map(res => {
                  const needed = (item.cost as Record<string, number>)[res] || 0;
                  if (needed === 0) return null;
                  const have = player.resources[res];
                  const ok = have >= needed;
                  return (
                    <span
                      key={res}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {RES_META[res].emoji} {needed}
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              disabled={!canAfford}
              onClick={() => {
                if (item.key === 'devCard') onBuyDevCard();
                else onBuild(item.key as 'road' | 'settlement' | 'city');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-w-[48px] min-h-[44px] flex items-center justify-center ${
                canAfford
                  ? 'bg-green-600 hover:bg-green-500 text-white active:scale-95'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              Build
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 4 — Bank Trade
// ═══════════════════════════════════════════════════════════════════════════════

function BankTradeCard({
  player,
  gameState,
  bankGive,
  bankReceive,
  onGiveChange,
  onReceiveChange,
  onTrade,
}: {
  player: Player;
  gameState: GameState;
  bankGive: ResourceType;
  bankReceive: ResourceType;
  onGiveChange: (r: ResourceType) => void;
  onReceiveChange: (r: ResourceType) => void;
  onTrade: (give: ResourceType, receive: ResourceType) => void;
}) {
  const ratio = getPlayerTradeRatio(gameState, player.id, bankGive);
  const canTrade = player.resources[bankGive] >= ratio && bankGive !== bankReceive;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400 text-center">
        Trade with the bank at your best available ratio
      </div>

      {/* Give section */}
      <div className="bg-white/5 rounded-xl p-3">
        <div className="text-[10px] text-red-400 font-bold uppercase tracking-wide mb-2">You Give ({ratio}×)</div>
        <div className="flex gap-1.5">
          {RES_ORDER.map(res => {
            const selected = res === bankGive;
            const r = getPlayerTradeRatio(gameState, player.id, res);
            return (
              <button
                key={res}
                onClick={() => onGiveChange(res)}
                className={`flex-1 rounded-lg py-2 text-center transition-all min-h-[48px] ${
                  selected
                    ? `${RES_META[res].bgClass} ring-2 ring-white/40 scale-105`
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-base">{RES_META[res].emoji}</div>
                <div className="text-[9px] text-white/60 font-bold">{player.resources[res]} ({r}:1)</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowRight className="w-5 h-5 text-white/30" />
      </div>

      {/* Receive section */}
      <div className="bg-white/5 rounded-xl p-3">
        <div className="text-[10px] text-green-400 font-bold uppercase tracking-wide mb-2">You Receive (1×)</div>
        <div className="flex gap-1.5">
          {RES_ORDER.map(res => {
            const selected = res === bankReceive;
            const disabled = res === bankGive;
            return (
              <button
                key={res}
                onClick={() => !disabled && onReceiveChange(res)}
                disabled={disabled}
                className={`flex-1 rounded-lg py-2 text-center transition-all min-h-[48px] ${
                  disabled
                    ? 'opacity-20 cursor-not-allowed'
                    : selected
                      ? `${RES_META[res].bgClass} ring-2 ring-white/40 scale-105`
                      : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-base">{RES_META[res].emoji}</div>
                <div className="text-[9px] text-white/60 font-bold">{RES_META[res].label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trade button */}
      <button
        disabled={!canTrade}
        onClick={() => canTrade && onTrade(bankGive, bankReceive)}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all min-h-[48px] ${
          canTrade
            ? 'bg-teal-600 hover:bg-teal-500 text-white active:scale-[0.98]'
            : 'bg-white/5 text-white/20 cursor-not-allowed'
        }`}
      >
        Trade {ratio}× {RES_META[bankGive].emoji} → 1× {RES_META[bankReceive].emoji}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 5 — Player Trade
// ═══════════════════════════════════════════════════════════════════════════════

function PlayerTradeCard({
  gameState,
  playerId,
  onOpenFull,
}: {
  gameState: GameState;
  playerId: string;
  onOpenFull: () => void;
}) {
  const others = gameState.players.filter(p => p.id !== playerId);
  const pending = gameState.pendingTrade;

  return (
    <div className="space-y-3">
      {/* Pending trade notification */}
      {pending && pending.toPlayerId === playerId && (
        <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-3">
          <div className="text-xs text-purple-300 font-bold mb-1">
            📨 Incoming offer from {gameState.players.find(p => p.id === pending.fromPlayerId)?.name}
          </div>
          <button
            onClick={onOpenFull}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg mt-1 min-h-[44px]"
          >
            View & Respond
          </button>
        </div>
      )}

      {/* Other players quick view */}
      <div className="space-y-1.5">
        {others.map(p => {
          const total = Object.values(p.resources).reduce((a, b) => a + b, 0);
          return (
            <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-xs text-white font-medium flex-1 truncate">{p.name}</span>
              <span className="text-[10px] text-slate-400">{total} cards</span>
              <span className="text-[10px] text-slate-500">{p.victoryPoints} VP</span>
            </div>
          );
        })}
      </div>

      {/* Open full trade panel */}
      <button
        onClick={onOpenFull}
        className="w-full py-3 bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 min-h-[48px] transition-all active:scale-[0.98]"
      >
        <Handshake className="w-4 h-4" /> Propose a Trade
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 6 — Dev Cards
// ═══════════════════════════════════════════════════════════════════════════════

const DEV_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  'knight':          { icon: '⚔️', label: 'Knight',          desc: 'Move robber, steal 1 resource' },
  'victory-point':   { icon: '⭐', label: 'Victory Point',   desc: 'Worth 1 VP (auto-reveals)' },
  'road-building':   { icon: '🛤️', label: 'Road Building',   desc: 'Build 2 roads for free' },
  'year-of-plenty':  { icon: '🎁', label: 'Year of Plenty',  desc: 'Take any 2 resources from bank' },
  'monopoly':        { icon: '💰', label: 'Monopoly',         desc: 'Take ALL of 1 resource from all players' },
};

function DevCardsCard({ player, gameState }: { player: Player; gameState: GameState }) {
  const unplayed = player.developmentCards.filter(c => !c.isPlayed);
  const played = player.developmentCards.filter(c => c.isPlayed);

  // Group by type
  const grouped = unplayed.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-400">
          Hand: <span className="text-white font-bold">{unplayed.length}</span> unplayed
        </span>
        <span className="text-slate-500">
          ⚔ {player.playedKnights} knights played
        </span>
      </div>

      {/* Unplayed cards */}
      {Object.entries(grouped).length > 0 ? (
        <div className="space-y-1.5">
          {Object.entries(grouped).map(([type, count]) => {
            const meta = DEV_LABELS[type] || { icon: '📜', label: type, desc: '' };
            const isNew = unplayed.some(c => c.type === type && c.turnBought === gameState.turn);
            return (
              <div
                key={type}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  isNew ? 'bg-amber-900/20 border border-amber-500/25' : 'bg-white/5'
                }`}
              >
                <span className="text-xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    {meta.label}
                    {count > 1 && <span className="text-white/50">×{count}</span>}
                    {isNew && <span className="text-[9px] bg-amber-600 text-white px-1 rounded">NEW</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">{meta.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 text-xs">
          No development cards in hand
        </div>
      )}

      {/* Played cards summary */}
      {played.length > 0 && (
        <div className="border-t border-white/10 pt-2">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Played</div>
          <div className="flex flex-wrap gap-1">
            {played.map((c, i) => (
              <span key={i} className="text-[10px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded">
                {DEV_LABELS[c.type]?.icon} {DEV_LABELS[c.type]?.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deck remaining */}
      <div className="text-[10px] text-slate-600 text-center">
        {gameState.developmentCardDeck.length} cards remaining in deck
      </div>
    </div>
  );
}
