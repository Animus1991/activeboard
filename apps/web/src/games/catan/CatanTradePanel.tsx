/**
 * CatanTradePanel — player-to-player + bank trade modal
 * Bank trade respects harbour ratios; player trade sends a proposal
 * that the target player must accept/decline.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Handshake, Building2 } from 'lucide-react';
import { evaluateTradeOffer } from './useCatanAI';
import {
  type GameState,
  type ResourceType,
  getPlayerTradeRatio,
  bankTrade,
  proposeTrade,
  acceptTrade,
  declineTrade,
} from './CatanEngine';

const RES_META: Record<ResourceType, { label: string; color: string; emoji: string }> = {
  wood:  { label: 'Wood',  color: '#1A5C10', emoji: '🌲' },
  brick: { label: 'Brick', color: '#8C2E10', emoji: '🧱' },
  sheep: { label: 'Sheep', color: '#4EA030', emoji: '🐑' },
  wheat: { label: 'Wheat', color: '#C88C0C', emoji: '🌾' },
  ore:   { label: 'Ore',   color: '#566070', emoji: '⛏' },
};

const ALL_RES: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

interface Props {
  gameState: GameState;
  currentPlayerId: string;
  onStateChange: (s: GameState) => void;
  onClose: () => void;
}

export default function CatanTradePanel({ gameState, currentPlayerId, onStateChange, onClose }: Props) {
  const [tab, setTab] = useState<'bank' | 'player'>('bank');
  const [offering, setOffering] = useState<Partial<Record<ResourceType, number>>>({});
  const [requesting, setRequesting] = useState<Partial<Record<ResourceType, number>>>({});
  const [targetId, setTargetId] = useState('');

  const me = gameState.players.find(p => p.id === currentPlayerId)!;
  const others = gameState.players.filter(p => p.id !== currentPlayerId);

  const totalOffering  = (Object.values(offering)  as number[]).reduce((a, b) => a + b, 0);
  const totalRequesting = (Object.values(requesting) as number[]).reduce((a, b) => a + b, 0);

  // ── Bank trade ─────────────────────────────────────────────────────────────
  const handleBankTrade = (giveRes: ResourceType, getRes: ResourceType) => {
    const ratio = getPlayerTradeRatio(gameState, currentPlayerId, giveRes);
    if ((me.resources[giveRes] ?? 0) < ratio) return;
    onStateChange(bankTrade(gameState, currentPlayerId, giveRes, getRes));
  };

  // ── Player trade: propose ──────────────────────────────────────────────────
  const handlePropose = () => {
    if (!targetId || totalOffering === 0 || totalRequesting === 0) return;
    onStateChange(proposeTrade(gameState, currentPlayerId, targetId, { ...offering }, { ...requesting }));
    setOffering({});
    setRequesting({});
    setTargetId('');
  };

  // ── Incoming trade offer ───────────────────────────────────────────────────
  const pending = gameState.pendingTrade;
  const pendingForMe = pending && pending.toPlayerId === currentPlayerId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('bank')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'bank' ? 'bg-amber-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              <Building2 size={15} /> Bank
            </button>
            <button
              onClick={() => setTab('player')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'player' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              <Handshake size={15} /> Players
            </button>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          <AnimatePresence mode="wait">

            {/* ── BANK TRADE ── */}
            {tab === 'bank' && (
              <motion.div key="bank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Click a resource you own → select what you want</p>
                <div className="grid grid-cols-5 gap-3">
                  {ALL_RES.map(gRes => {
                    const ratio = getPlayerTradeRatio(gameState, currentPlayerId, gRes);
                    const count = me.resources[gRes] ?? 0;
                    const canAfford = count >= ratio;
                    return (
                      <div key={gRes} className="flex flex-col gap-2">
                        <div
                          className={`relative rounded-xl p-3 text-center border-2 transition-all ${canAfford ? 'border-white/20 hover:border-white/60 cursor-pointer' : 'border-white/5 opacity-30'}`}
                          style={{ background: RES_META[gRes].color + '33' }}
                        >
                          <div className="text-xl mb-1">{RES_META[gRes].emoji}</div>
                          <div className="text-white text-xs font-bold">{count}</div>
                          <div className="text-white/40 text-[9px] mt-0.5">{ratio}:1</div>
                        </div>
                        {canAfford && (
                          <div className="flex flex-col gap-1">
                            {ALL_RES.filter(r => r !== gRes).map(getRes => (
                              <button
                                key={getRes}
                                onClick={() => handleBankTrade(gRes, getRes)}
                                className="text-[9px] bg-white/5 hover:bg-white/15 text-white/60 hover:text-white px-2 py-1 rounded-lg transition-colors text-center"
                              >
                                → {RES_META[getRes].emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── PLAYER TRADE ── */}
            {tab === 'player' && (
              <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

                {/* Incoming offer banner */}
                {pendingForMe && pending && (
                  <div className="bg-blue-900/60 border border-blue-400/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                      <Handshake size={16} /> Incoming trade from {gameState.players.find(p => p.id === pending.fromPlayerId)?.name}
                    </div>
                    {/* AI Trade Fairness Rating */}
                    {(() => {
                      const rating = evaluateTradeOffer(gameState, currentPlayerId, pending.requesting, pending.offering, 'standard');
                      const label = rating.score > 1 ? '🟢 Great Deal' : rating.score > -0.3 ? '🟡 Fair' : '🔴 Bad Deal';
                      const color = rating.score > 1 ? 'bg-green-800/60 text-green-300' : rating.score > -0.3 ? 'bg-yellow-800/60 text-yellow-300' : 'bg-red-800/60 text-red-300';
                      return (
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
                          {label} <span className="opacity-60">({rating.score > 0 ? '+' : ''}{rating.score.toFixed(1)})</span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-white/40 text-[9px] uppercase">They offer</span>
                        <div className="flex gap-1 flex-wrap">
                          {(Object.entries(pending.offering) as [ResourceType, number][]).filter(([,n]) => n > 0).map(([r, n]) => (
                            <div key={r} className="rounded-lg px-2 py-1 text-white text-xs font-bold" style={{ background: RES_META[r].color }}>
                              {RES_META[r].emoji} {n}
                            </div>
                          ))}
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-white/20" />
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-white/40 text-[9px] uppercase">They want</span>
                        <div className="flex gap-1 flex-wrap">
                          {(Object.entries(pending.requesting) as [ResourceType, number][]).filter(([,n]) => n > 0).map(([r, n]) => (
                            <div key={r} className="rounded-lg px-2 py-1 text-white text-xs font-bold" style={{ background: RES_META[r].color }}>
                              {RES_META[r].emoji} {n}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => onStateChange(acceptTrade(gameState, currentPlayerId))} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl font-bold text-sm transition-colors">Accept</button>
                      <button onClick={() => onStateChange(declineTrade(gameState))} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl font-bold text-sm transition-colors">Decline</button>
                    </div>
                  </div>
                )}

                {/* Trade with player selector */}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Trade with</p>
                  <div className="flex gap-2 flex-wrap">
                    {others.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setTargetId(p.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-all ${targetId === p.id ? 'border-white text-white bg-white/10' : 'border-white/10 text-white/50 hover:border-white/40'}`}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offer / Request grid */}
                <div className="grid grid-cols-2 gap-5">
                  {(['offering', 'requesting'] as const).map(side => {
                    const state = side === 'offering' ? offering : requesting;
                    const setter = side === 'offering' ? setOffering : setRequesting;
                    const label  = side === 'offering' ? 'You Give' : 'You Want';
                    return (
                      <div key={side}>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{label}</p>
                        <div className="flex gap-2 flex-wrap">
                          {ALL_RES.map(r => {
                            const maxPool = side === 'offering' ? (me.resources[r] ?? 0) : 99;
                            const sel = state[r] ?? 0;
                            return (
                              <button
                                key={r}
                                onClick={() => {
                                  if (sel < maxPool) setter(prev => ({ ...prev, [r]: (prev[r] ?? 0) + 1 }));
                                  else setter(prev => ({ ...prev, [r]: 0 }));
                                }}
                                onContextMenu={e => { e.preventDefault(); setter(prev => ({ ...prev, [r]: Math.max(0, (prev[r] ?? 0) - 1) })); }}
                                className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-lg border-2 transition-all ${sel > 0 ? 'border-white scale-105' : 'border-transparent opacity-50'}`}
                                style={{ background: RES_META[r].color + '99' }}
                                title={`${RES_META[r].label}: left-click +1, right-click -1`}
                              >
                                {RES_META[r].emoji}
                                {sel > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-white text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                    {sel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  disabled={!targetId || totalOffering === 0 || totalRequesting === 0}
                  onClick={handlePropose}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white py-3 rounded-2xl font-bold tracking-wider text-sm transition-colors"
                >
                  Propose Trade
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
