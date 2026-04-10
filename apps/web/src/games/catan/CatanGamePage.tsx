/**
 * TableForge - Catan Game Page
 * Complete game interface with hexagonal board
 */

import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import CatanBoard3D from './CatanBoard3D';
const CatanTradePanel = lazy(() => import('./CatanTradePanel'));
import { Resource3DIcon } from './CatanResourceFlow';

type CameraMode = 'tactical' | 'table' | 'inspect' | 'cinematic';
import CatanPresence, { type PresencePeerInfo } from './CatanPresence';
import { type Presence3DPlayer } from './CatanPresence3D';
import CatanDice from './CatanDice';
import {
  computeUIProjection,
  computeVPBreakdown,
  computeResourceSummary,
  computeProduction,
  type ProductionEntry,
} from './CatanProjections';
import CatanLobby, { type LobbyConfig } from './CatanLobby';
import { useCatanAI, type AIDifficulty } from './useCatanAI';
import {
  TutorialOverlay,
  RulesReference,
  GameChat,
  DiceHistoryChart,
  ResourceGainNotifications,
  ZoomControls,
  SaveLoadPanel,
  ReplayControls,
  type ChatMessage,
  type ResourceGain,
} from './CatanHUDFeatures';
import { useCatanSounds } from './useCatanSounds';
import { useCatanPersistence } from './useCatanPersistence';
import {
  Home, Building2, Route, ScrollText,
  Users, ArrowRight, Package,
  Crown, Sword, Map,
  ArrowLeft, RotateCcw, Save, FolderOpen, Undo2, Bot, Handshake,
  BookOpen, MessageSquare, BarChart3, HelpCircle, ListOrdered,
  Trophy, AlertTriangle, ArrowUpDown,
  Move, Settings, Volume2, VolumeX, X
} from 'lucide-react';
import {
  type GameState,
  type Player,
  type ResourceType,
  type DevelopmentCard,
  createInitialGameState,
  getCurrentPlayer,
  performRoll,
  buyDevelopmentCard,
  moveRobber,
  stealResource,
  endTurn,
  advanceSetup,
  buildSettlement,
  buildCity,
  buildRoad,
  bankTrade,
  canBuildSettlement,
  canBuildCity,
  canBuildRoad,
  canBuyDevelopmentCard,
  playKnight,
  playYearOfPlenty,
  playMonopoly,
  playRoadBuilding,
  buildFreeRoad,
  hasResources,
  discardResources,
  BUILDING_COSTS,
} from './CatanEngine';

// ============================================================================
// DISCARD PANEL — lets the robbed player select resources to discard
// ============================================================================

interface DiscardPanelProps {
  player: Player;
  mustDiscard: number;
  onDiscard: (resources: Record<ResourceType, number>) => void;
}

function DiscardPanel({ player, mustDiscard, onDiscard }: DiscardPanelProps) {
  const [selection, setSelection] = useState<Record<ResourceType, number>>(
    { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  );
  const totalSelected = Object.values(selection).reduce((a, b) => a + b, 0);

  const adjust = (r: ResourceType, delta: number) => {
    setSelection(prev => {
      const next = { ...prev, [r]: Math.max(0, Math.min(player.resources[r], prev[r] + delta)) };
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {(Object.keys(player.resources) as ResourceType[]).map(r => (
        <div key={r} className="flex items-center justify-between">
          <span className="text-sm text-slate-300 capitalize w-16">{r}</span>
          <span className="text-xs text-slate-500 w-8">×{player.resources[r]}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => adjust(r, -1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center">−</button>
            <span className="text-white font-bold w-5 text-center">{selection[r]}</span>
            <button onClick={() => adjust(r, +1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center">+</button>
          </div>
        </div>
      ))}
      <button
        disabled={totalSelected !== mustDiscard}
        onClick={() => onDiscard(selection)}
        className="w-full py-2 mt-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg"
      >
        Discard {totalSelected}/{mustDiscard}
      </button>
    </div>
  );
}

// ============================================================================
// RESOURCE COLORS
// ============================================================================

const ResourceColors: Record<ResourceType, string> = {
  wood: 'bg-green-600',
  brick: 'bg-red-600',
  sheep: 'bg-lime-500',
  wheat: 'bg-yellow-500',
  ore: 'bg-slate-500',
};

const ResourceEmoji: Record<ResourceType, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛏️',
};


// ============================================================================
// PLAYER PANEL
// ============================================================================

interface PlayerPanelProps {
  player: Player;
  isCurrentPlayer: boolean;
  isAI?: boolean;
  currentTurn?: number;
  gameState: GameState;
}

function PlayerPanel({ player, isCurrentPlayer, isAI, currentTurn = 0, gameState }: PlayerPanelProps) {
  const vp = computeVPBreakdown(gameState, player.id);
  const playerIndex = gameState.players.indexOf(player);
  const turnOrder = playerIndex + 1;
  return (
    <div 
      className={`rounded-lg border-2 p-3 transition-all ${
        isCurrentPlayer
          ? 'border-yellow-400 bg-slate-800/90 shadow-lg shadow-yellow-400/20 scale-105'
          : 'border-slate-600 bg-slate-800/70 opacity-80'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        {/* Turn order badge */}
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          isCurrentPlayer ? 'bg-yellow-500 text-black' : 'bg-slate-600 text-slate-300'
        }`}>
          {turnOrder}
        </div>
        <div className="relative flex-shrink-0">
          <img
            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.color.replace('#', '')}`}
            alt={player.name}
            className="w-8 h-8 rounded-full object-cover border-2"
            style={{ borderColor: player.color }}
          />
          {isCurrentPlayer && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold truncate ${isCurrentPlayer ? 'text-yellow-300' : 'text-slate-300'}`}>
              {player.name}
            </span>
            {isAI && <Bot className="w-3 h-3 text-purple-400" />}
          </div>
          <div className="text-sm text-purple-400 font-bold">{vp.total} VP</div>
          {vp.total > 0 && (
            <div className="text-[8px] text-slate-500 flex gap-0.5 flex-wrap mt-0.5">
              {vp.settlements > 0 && <span>🏠×{vp.settlements}</span>}
              {vp.cities > 0 && <span>🏙×{vp.cities}</span>}
              {vp.longestRoad > 0 && <span className="text-blue-400">🛤+2</span>}
              {vp.largestArmy > 0 && <span className="text-red-400">⚔+2</span>}
              {vp.devCardVP > 0 && <span className="text-yellow-400">⭐×{vp.devCardVP}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Resources — ABAS-style grid with emoji icons + count */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {(Object.entries(player.resources) as [ResourceType, number][]).map(([resource, count]) => (
          <div 
            key={resource}
            className={`${ResourceColors[resource]} rounded-lg p-1 text-center transition-transform ${count > 0 ? 'ring-1 ring-white/20 scale-100' : 'opacity-60 scale-95'}`}
            title={`${resource}: ${count}`}
          >
            <div className="text-[10px] leading-none mb-0.5">{ResourceEmoji[resource]}</div>
            <div className="text-white text-xs font-extrabold">{count}</div>
          </div>
        ))}
      </div>

      {/* Building pieces remaining + stats */}
      <div className="flex items-center gap-2 text-[9px] text-slate-400 mb-1.5 flex-wrap">
        <span title="Settlements built / remaining">🏠 {5 - player.settlements}/{5}</span>
        <span title="Cities built / remaining">🏙 {4 - player.cities}/{4}</span>
        <span title="Roads built / remaining">🛤 {15 - player.roads}/{15}</span>
        <span title="Knights played">⚔ {player.playedKnights}</span>
        <span title="Dev cards held">📜 {player.developmentCards.length}</span>
      </div>

      {/* Badges */}
      <div className="flex gap-2 text-xs">
        {player.hasLongestRoad && (
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
            <Route className="w-3 h-3" /> Longest Road
          </span>
        )}
        {player.hasLargestArmy && (
          <span className="bg-red-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
            <Sword className="w-3 h-3" /> Largest Army
          </span>
        )}
      </div>

      {/* Dev cards with per-card hover tooltips */}
      {player.developmentCards.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {player.developmentCards.map((card, idx) => (
            <DevCardBadge key={idx} card={card} currentTurn={currentTurn} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEV CARD BADGE WITH TOOLTIP
// ============================================================================

const DEV_CARD_LABELS: Record<string, string> = {
  'knight': '⚔️ Knight',
  'victory-point': '⭐ Victory Point',
  'road-building': '🛤️ Road Building',
  'year-of-plenty': '🎁 Year of Plenty',
  'monopoly': '💰 Monopoly',
};

function DevCardBadge({ card, currentTurn }: { card: DevelopmentCard; currentTurn: number }) {
  const [hovered, setHovered] = useState(false);
  const isNew = card.turnBought === currentTurn;
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-default select-none transition-all ${
        card.isPlayed
          ? 'bg-slate-700 text-slate-500 line-through'
          : isNew
            ? 'bg-amber-600 text-white ring-1 ring-amber-400'
            : 'bg-purple-700 text-purple-200'
      }`}>
        📜
      </div>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap">
          <div className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 shadow-xl">
            <div className="font-bold">{DEV_CARD_LABELS[card.type] ?? card.type}</div>
            {isNew && !card.isPlayed && (
              <div className="text-amber-400 text-[9px] font-semibold mt-0.5">NEW — cannot play yet</div>
            )}
            {card.isPlayed && (
              <div className="text-slate-500 text-[9px] mt-0.5">Already played</div>
            )}
          </div>
          <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-600 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACTION PANEL
// ============================================================================

interface ActionPanelProps {
  gameState: GameState;
  onAction: (action: string, data?: unknown) => void;
  rolling: boolean;
  rollKey?: number;
  onOpenTrade?: () => void;
}

function ActionPanel({ gameState, onAction, rolling, rollKey = 0, onOpenTrade }: ActionPanelProps) {
  const currentPlayer = getCurrentPlayer(gameState);
  const [yopR1, setYopR1] = useState<ResourceType>('wood');
  const [yopR2, setYopR2] = useState<ResourceType>('wheat');
  const [monoRes, setMonoRes] = useState<ResourceType>('wood');
  const RESOURCES: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

  const renderPhaseActions = () => {
    switch (gameState.phase) {
      case 'setup-settlement':
        return (
          <div className="space-y-3">
            <p className="text-slate-300 font-semibold">
              🏠 {currentPlayer.name}: Place your settlement (Round {gameState.setupRound})
            </p>
            <p className="text-sm text-slate-400">
              Click a <span className="text-yellow-400 font-medium">glowing gold diamond ◆</span> on any hex corner
            </p>
          </div>
        );

      case 'setup-road':
        return (
          <div className="space-y-3">
            <p className="text-slate-300 font-semibold">
              🛤️ {currentPlayer.name}: Place your road
            </p>
            <p className="text-sm text-slate-400">
              Click a <span className="text-orange-400 font-medium">glowing orange bar ━</span> next to your settlement
            </p>
          </div>
        );

      case 'roll':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}'s turn. Roll the dice!
            </p>
            {currentPlayer.developmentCards.some(
              c => !c.isPlayed && c.type === 'knight' && c.turnBought < gameState.turn
            ) && !gameState.devCardPlayedThisTurn && (
              <button
                onClick={() => onAction('play-knight')}
                className="w-full py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm rounded-lg flex items-center justify-center gap-1.5"
              >
                ⚔️ Play Knight Before Roll
              </button>
            )}
            <button
              onClick={() => onAction('roll')}
              disabled={rolling}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              {rolling ? 'Rolling...' : '🎲 Roll Dice'}
            </button>
          </div>
        );

      case 'discard': {
        const discIdx = gameState.discardingPlayerIndex ?? 0;
        const discPlayer = gameState.players[discIdx];
        const totalRes = discPlayer ? Object.values(discPlayer.resources).reduce((a, b) => a + b, 0) : 0;
        const mustDiscard = Math.floor(totalRes / 2);
        const isMyTurn = discPlayer?.id === currentPlayer.id;
        return (
          <div className="space-y-3">
            <p className={`font-semibold ${isMyTurn ? 'text-red-300' : 'text-orange-300'}`}>
              {discPlayer?.name} must discard {mustDiscard} of {totalRes} resources
            </p>
            {isMyTurn && (
              <DiscardPanel
                player={discPlayer!}
                mustDiscard={mustDiscard}
                onDiscard={(resources) => onAction('discard', resources)}
              />
            )}
            {!isMyTurn && (
              <p className="text-slate-400 text-sm">Waiting for {discPlayer?.name}…</p>
            )}
          </div>
        );
      }

      case 'robber-move':
        return (
          <div className="space-y-3">
            <p className="text-orange-300">
              Move the robber! Click on a hex tile.
            </p>
          </div>
        );

      case 'robber-steal': {
        const robHex = gameState.hexTiles.find(h => h.id === gameState.robberHexId);
        const adjIds = robHex
          ? new Set(gameState.vertices
              .filter(v => v.hexIds.includes(robHex.id) && v.building && v.building.playerId !== currentPlayer.id)
              .map(v => v.building!.playerId))
          : new Set<string>();
        const stealTargets = adjIds.size > 0
          ? gameState.players.filter(p => adjIds.has(p.id))
          : gameState.players.filter(p => p.id !== currentPlayer.id);
        return (
          <div className="space-y-3">
            <p className="text-orange-300">
              {stealTargets.length ? 'Steal from an adjacent player:' : 'No adjacent opponents — no steal'}
            </p>
            {stealTargets.map(p => (
              <button
                key={p.id}
                onClick={() => onAction('steal', p.id)}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                Steal from {p.name}
              </button>
            ))}
            {!stealTargets.length && (
              <button onClick={() => onAction('end-turn')}
                className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">
                Continue
              </button>
            )}
          </div>
        );
      }

      case 'main':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}'s turn - Build, trade, or end turn
            </p>
            
            {/* Build options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAction('build-road')}
                disabled={!hasResources(currentPlayer, BUILDING_COSTS.road)}
                className="py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center justify-center gap-1"
              >
                <Route className="w-4 h-4" /> Road
              </button>
              <button
                onClick={() => onAction('build-settlement')}
                disabled={!hasResources(currentPlayer, BUILDING_COSTS.settlement)}
                className="py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center justify-center gap-1"
              >
                <Home className="w-4 h-4" /> Settlement
              </button>
              <button
                onClick={() => onAction('build-city')}
                disabled={!hasResources(currentPlayer, BUILDING_COSTS.city)}
                className="py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center justify-center gap-1"
              >
                <Building2 className="w-4 h-4" /> City
              </button>
              <button
                onClick={() => onAction('buy-dev-card')}
                disabled={!canBuyDevelopmentCard(gameState, currentPlayer.id)}
                className="py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center justify-center gap-1"
              >
                <ScrollText className="w-4 h-4" /> Dev Card
              </button>
            </div>

            {/* Trade button — opens full trade panel */}
            <button
              onClick={onOpenTrade}
              className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Handshake className="w-4 h-4" /> Trade
            </button>

            {/* Dev card hand */}
            {(() => {
              const hand = currentPlayer.developmentCards.filter(
                c => !c.isPlayed && c.turnBought < gameState.turn
              );
              if (!hand.length) return null;
              const canPlay = !gameState.devCardPlayedThisTurn;
              const cnt = (t: string) => hand.filter(c => (c.type as string) === t).length;
              return (
                <div className="space-y-1.5 border-t border-slate-600 pt-2">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                    Dev Cards{!canPlay && <span className="text-yellow-500 normal-case ml-1">(1/turn used)</span>}
                  </p>
                  {cnt('knight') > 0 && (
                    <button disabled={!canPlay} onClick={() => onAction('play-knight')}
                      className="w-full py-1.5 bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white text-sm rounded flex items-center justify-center gap-1">
                      ⚔️ Knight ×{cnt('knight')}
                    </button>
                  )}
                  {cnt('road-building') > 0 && (
                    <button disabled={!canPlay} onClick={() => onAction('play-road-building')}
                      className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm rounded flex items-center justify-center gap-1">
                      🛣️ Road Building ×{cnt('road-building')}
                    </button>
                  )}
                  {cnt('year-of-plenty') > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <select value={yopR1} onChange={e => setYopR1(e.target.value as ResourceType)}
                          className="flex-1 text-xs bg-slate-700 border border-slate-500 rounded px-1 py-1 text-white">
                          {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select value={yopR2} onChange={e => setYopR2(e.target.value as ResourceType)}
                          className="flex-1 text-xs bg-slate-700 border border-slate-500 rounded px-1 py-1 text-white">
                          {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <button disabled={!canPlay} onClick={() => onAction('play-year-of-plenty', { r1: yopR1, r2: yopR2 })}
                        className="w-full py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm rounded flex items-center justify-center gap-1">
                        🌾 Year of Plenty ×{cnt('year-of-plenty')}
                      </button>
                    </div>
                  )}
                  {cnt('monopoly') > 0 && (
                    <div className="space-y-1">
                      <select value={monoRes} onChange={e => setMonoRes(e.target.value as ResourceType)}
                        className="w-full text-xs bg-slate-700 border border-slate-500 rounded px-2 py-1 text-white">
                        {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button disabled={!canPlay} onClick={() => onAction('play-monopoly', monoRes)}
                        className="w-full py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-sm rounded flex items-center justify-center gap-1">
                        💰 Monopoly ×{cnt('monopoly')}
                      </button>
                    </div>
                  )}
                  {cnt('victory-point') > 0 && (
                    <p className="text-xs text-yellow-400 text-center">⭐ {cnt('victory-point')}× VP (auto-reveals on win)</p>
                  )}
                </div>
              );
            })()}

            {/* End turn */}
            <button
              onClick={() => onAction('end-turn')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" /> End Turn
            </button>
          </div>
        );

      case 'game-over': {
        const winner = gameState.players.find(p => p.id === gameState.winner);
        return (
          <div className="space-y-3 text-center">
            <div className="text-4xl">🏆</div>
            <h3 className="text-2xl font-bold text-yellow-400">
              {winner?.name} Wins!
            </h3>
            <p className="text-slate-300">
              Victory Points: {winner?.victoryPoints}
            </p>
            <button
              onClick={() => onAction('new-game')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 mt-4"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </button>
          </div>
        );
      }

      default:
        return <p className="text-slate-400">Phase: {gameState.phase}</p>;
    }
  };

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Map className="w-5 h-5 text-orange-400" />
        Actions
      </h3>
      {renderPhaseActions()}

      {/* Dice display */}
      {gameState.diceRoll && (
        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-center">
          <CatanDice values={gameState.diceRoll} rollKey={rollKey} />
        </div>
      )}
    </div>
  );
}

interface ResourcePanelProps {
  player: Player;
  gameState: GameState;
}

function ResourcePanel({ player, gameState }: ResourcePanelProps) {
  const summary = computeResourceSummary(gameState, player.id);
  const rateColor = (r: number) =>
    r === 2 ? 'text-green-400' : r === 3 ? 'text-yellow-400' : 'text-slate-600';

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Package className="w-5 h-5 text-green-400" />
        Your Resources
        <span className="ml-auto text-xs text-slate-400 font-normal">{summary.totalCards} cards</span>
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(player.resources) as [ResourceType, number][]).map(([resource, count]) => (
          <div
            key={resource}
            className={`bg-slate-700/50 rounded-lg p-2 text-center ${count > 0 ? 'ring-1 ring-white/10' : ''}`}
          >
            <div className="flex justify-center mb-1">
              <Resource3DIcon resource={resource} size={32} />
            </div>
            <div className={`font-bold ${count > 0 ? 'text-white' : 'text-slate-600'}`}>{count}</div>
            <div className="text-[9px] text-slate-500 capitalize">{resource}</div>
            <div className={`text-[9px] font-bold ${rateColor(summary.maritimeRates[resource])}`}>
              {summary.maritimeRates[resource]}:1
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {([
          { label: '🛤️ Road',       can: summary.canAfford.road },
          { label: '🏠 Settlement', can: summary.canAfford.settlement },
          { label: '🏙️ City',       can: summary.canAfford.city },
          { label: '📜 Dev Card',   can: summary.canAfford.devCard },
        ] as { label: string; can: boolean }[]).map(({ label, can }) => (
          <span
            key={label}
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              can
                ? 'bg-green-900/60 text-green-300 ring-1 ring-green-600/40'
                : 'bg-slate-700/40 text-slate-600'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN GAME PAGE
// ============================================================================

export default function CatanGamePage() {
  const mp = useMultiplayerGame<GameState>();

  // ── Lobby ──────────────────────────────────────────────────────────────────
  const [showLobby, setShowLobby] = useState(!mp.isMultiplayer);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('standard');
  const [aiPlayerIds, setAiPlayerIds] = useState<string[]>([]);
  
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mp.isMultiplayer && mp.playerNames.length > 0) {
      return createInitialGameState(mp.playerNames);
    }
    return createInitialGameState(['Red', 'Blue', 'Orange', 'White']);
  });
  const [rolling, setRolling] = useState(false);
  const [buildMode, setBuildMode] = useState<'settlement' | 'city' | 'road' | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('tactical');
  const [rollKey, setRollKey] = useState(0);
  const [productionLog, setProductionLog] = useState<ProductionEntry[]>([]);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);
  const [introPhase, setIntroPhase] = useState<'shuffle' | 'letters' | 'numbers'>('shuffle');

  // ── New HUD feature toggles ────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDiceHistory, setShowDiceHistory] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [diceHistory, setDiceHistory] = useState<number[]>([]);
  const [resourceGains, setResourceGains] = useState<ResourceGain[]>([]);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [txLog, setTxLog] = useState<{ t: number; msg: string }[]>([]);
  const [showTxLog, setShowTxLog] = useState(false);
  const [vpCelebration, setVpCelebration] = useState<{ player: string; vp: number } | null>(null);
  const prevVPs = useRef<Record<string, number>>({});
  const [layoutMode, setLayoutMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [selectedVertex, setSelectedVertex] = useState<string | null>(null);

  // ── 3D Presence bridge — WebRTC streams ↔ 3D video panels ──────────────
  const [presencePlayers, setPresencePlayers] = useState<Presence3DPlayer[]>([]);

  const handlePeersChange = useCallback((localStream: MediaStream | null, peerInfos: PresencePeerInfo[]) => {
    // Build Presence3DPlayer[] from real WebRTC streams
    const presence3D: Presence3DPlayer[] = gameState.players.map(p => {
      const peerInfo = peerInfos.find(pi => pi.id === p.id);
      const isLocal = p.id === (mp.playerId ?? 'local');
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        stream: isLocal ? localStream : (peerInfo?.stream ?? null),
        audioEnabled: isLocal ? true : (peerInfo?.audioEnabled ?? false),
        videoEnabled: isLocal ? true : (peerInfo?.videoEnabled ?? false),
        isActive: gameState.currentPlayerIndex === gameState.players.indexOf(p),
        victoryPoints: p.victoryPoints,
      };
    });
    setPresencePlayers(presence3D);
  }, [gameState.players, gameState.currentPlayerIndex, mp.playerId]);

  // Solo mode — still show 3D panels (no streams, avatar placeholder) for all players
  useEffect(() => {
    if (mp.isMultiplayer) return; // multiplayer handled by onPeersChange
    const soloPresence: Presence3DPlayer[] = gameState.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      stream: null,
      audioEnabled: false,
      videoEnabled: false,
      isActive: i === gameState.currentPlayerIndex,
      victoryPoints: p.victoryPoints,
    }));
    setPresencePlayers(soloPresence);
  }, [mp.isMultiplayer, gameState.players, gameState.currentPlayerIndex]);

  // ── VP celebration detection ───────────────────────────────────────────────
  useEffect(() => {
    for (const p of gameState.players) {
      const prev = prevVPs.current[p.id] ?? p.victoryPoints;
      if (p.victoryPoints > prev) {
        setVpCelebration({ player: p.name, vp: p.victoryPoints });
        setTxLog(l => [...l, { t: Date.now(), msg: `🏆 ${p.name} reached ${p.victoryPoints} VP` }]);
        setTimeout(() => setVpCelebration(null), 2500);
      }
      prevVPs.current[p.id] = p.victoryPoints;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.map(p => p.victoryPoints).join(',')]);

  // ── Hand limit warning ─────────────────────────────────────────────────────
  const activeP = gameState.players[gameState.currentPlayerIndex];
  const totalCards = activeP
    ? Object.values(activeP.resources).reduce((a, b) => a + b, 0)
    : 0;
  const handLimitWarning = totalCards > 7;

  // ── Sounds ────────────────────────────────────────────────────────────────
  useCatanSounds({ gameState });

  // ── Persistence (save / load / undo) ─────────────────────────────────────
  const { pushHistory, undo, canUndo, saveGame, loadGame, hasSave } = useCatanPersistence();

  // ── AI ────────────────────────────────────────────────────────────────────
  const humanIds = gameState.players
    .filter(p => !aiPlayerIds.includes(p.id))
    .map(p => p.id);
  const { triggerAITurn } = useCatanAI({
    setGameState,
    difficulty,
    humanPlayerIds: humanIds,
  });

  // Auto-trigger AI when it's an AI player's turn
  useEffect(() => {
    const current = getCurrentPlayer(gameState);
    if (aiPlayerIds.includes(current.id) && gameState.phase !== 'game-over') {
      const delay = setTimeout(() => triggerAITurn(gameState), 600);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayerIndex, gameState.phase]);

  // ── Intro Animation Sequence ────────────────────────────────────────────────
  useEffect(() => {
    if (!showIntroAnimation) return;

    // Phase 1: Shuffle hexes (2 seconds)
    const shuffleTimeout = setTimeout(() => {
      setIntroPhase('letters');
    }, 2000);

    // Phase 2: Show alphabetical letters (2 seconds)
    const lettersTimeout = setTimeout(() => {
      setIntroPhase('numbers');
    }, 4000);

    // Phase 3: Reveal actual numbers (1 second)
    const numbersTimeout = setTimeout(() => {
      setShowIntroAnimation(false);
    }, 5000);

    return () => {
      clearTimeout(shuffleTimeout);
      clearTimeout(lettersTimeout);
      clearTimeout(numbersTimeout);
    };
  }, [showIntroAnimation]);

  // ── Lobby start handler ───────────────────────────────────────────────────
  const handleLobbyStart = useCallback((config: LobbyConfig) => {
    const playerNames = config.players.map(p => p.name);
    const initialState = createInitialGameState(
      mp.isMultiplayer && mp.playerNames.length > 0 ? mp.playerNames : playerNames,
      config.boardSize,
    );
    // Override player colors from lobby config
    const stateWithColors = {
      ...initialState,
      players: initialState.players.map((p, i) => ({
        ...p,
        color: config.players[i]?.color ?? p.color,
      })),
    };
    const aiIds = config.players
      .filter(p => p.isAI)
      .map((_, i) => stateWithColors.players[i]?.id)
      .filter((id): id is string => !!id);
    setAiPlayerIds(aiIds);
    setDifficulty(config.difficulty);
    setGameState(stateWithColors);
    pushHistory(stateWithColors);
    setBuildMode(null);
    setShowLobby(false);
  }, [mp.isMultiplayer, mp.playerNames, pushHistory]);

  // ── Presence signaling bridge ────────────────────────────────────────────
  const presenceSendRef = useRef<((msg: unknown) => void) | null>(null);
  useEffect(() => {
    mp.registerSignalHandler((_fromPlayerId, signal) => {
      presenceSendRef.current?.(signal);
    });
    return () => mp.registerSignalHandler(null);
  }, [mp]);

  // Multiplayer: sync state to remote players when host changes it
  useEffect(() => {
    if (mp.isMultiplayer && mp.isHost) {
      mp.syncState(gameState);
    }
  }, [gameState, mp]);

  // Multiplayer: receive state from host (non-host players)
  useEffect(() => {
    if (mp.isMultiplayer && !mp.isHost && mp.remoteState) {
      setGameState(mp.remoteState);
    }
  }, [mp.isMultiplayer, mp.isHost, mp.remoteState]);

  const handleAction = useCallback((action: string, data?: unknown) => {
    switch (action) {
      case 'roll':
        setRolling(true);
        setRollKey(k => k + 1);
        setProductionLog([]);
        
        // Play distinct, physically accurate satisfying dice roll sound
        const rollAudio = new Audio('https://actions.google.com/sounds/v1/foley/rolling_dice.ogg');
        rollAudio.volume = 0.7;
        rollAudio.play().catch(() => {});

        setTimeout(() => {
          setGameState(prev => {
            const next = performRoll(prev);
            pushHistory(next);
            if (next.diceRoll) {
              const total = next.diceRoll[0] + next.diceRoll[1];
              setDiceHistory(h => [...h, total]);
              if (total !== 7) {
                const prod = computeProduction(prev, total);
                setProductionLog(prod);
                // Push resource gain notifications
                for (const entry of prod) {
                  setResourceGains(g => [...g, {
                    id: `rg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    resource: entry.resource,
                    amount: entry.amount,
                    timestamp: Date.now(),
                  }]);
                }
              }
            }
            return next;
          });
          setRolling(false);
        }, 800);
        break;

      case 'undo': {
        const prev = undo();
        if (prev) {
          setGameState(prev);
          setBuildMode(null);
        }
        break;
      }

      case 'save':
        saveGame(gameState);
        break;

      case 'load': {
        const saved = loadGame();
        if (saved) {
          setGameState(saved.state);
          setBuildMode(null);
        }
        break;
      }

      case 'end-turn':
        setGameState(prev => endTurn(prev));
        setBuildMode(null);
        break;

      case 'steal':
        if (typeof data === 'string') {
          setGameState(prev => stealResource(prev, data));
        }
        break;

      case 'buy-dev-card':
        setGameState(prev => buyDevelopmentCard(prev, getCurrentPlayer(prev).id));
        break;

      case 'build-settlement':
        setBuildMode(prev => prev === 'settlement' ? null : 'settlement');
        break;

      case 'build-city':
        setBuildMode(prev => prev === 'city' ? null : 'city');
        break;

      case 'build-road':
        setBuildMode(prev => prev === 'road' ? null : 'road');
        break;

      case 'bank-trade':
        if (data && typeof data === 'object') {
          const { give, receive } = data as { give: ResourceType; receive: ResourceType };
          setGameState(prev => bankTrade(prev, getCurrentPlayer(prev).id, give, receive));
        }
        break;

      case 'play-knight':
        setGameState(prev => playKnight(prev, getCurrentPlayer(prev).id));
        break;

      case 'play-year-of-plenty':
        if (data && typeof data === 'object') {
          const { r1, r2 } = data as { r1: ResourceType; r2: ResourceType };
          setGameState(prev => playYearOfPlenty(prev, getCurrentPlayer(prev).id, r1, r2));
        }
        break;

      case 'play-monopoly':
        if (typeof data === 'string') {
          setGameState(prev => playMonopoly(prev, getCurrentPlayer(prev).id, data as ResourceType));
        }
        break;

      case 'play-road-building':
        setGameState(prev => playRoadBuilding(prev, getCurrentPlayer(prev).id));
        break;

      case 'discard':
        if (data && typeof data === 'object') {
          setGameState(prev => {
            const discIdx = prev.discardingPlayerIndex ?? 0;
            const playerId = prev.players[discIdx]?.id;
            if (!playerId) return prev;
            return discardResources(prev, playerId, data as Record<ResourceType, number>);
          });
        }
        break;

      case 'new-game':
        setShowLobby(true);
        setBuildMode(null);
        break;

      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, undo, saveGame, loadGame, pushHistory]);

  const handleHexClick = useCallback((hexId: number) => {
    if (gameState.phase === 'robber-move') {
      setGameState(prev => moveRobber(prev, hexId));
    }
  }, [gameState.phase]);

  const handleVertexClick = useCallback((vertexId: string) => {
    const phase = gameState.phase;
    const playerId = getCurrentPlayer(gameState).id;

    if (phase === 'setup-settlement') {
      setGameState(prev => {
        const next = buildSettlement(prev, playerId, vertexId);
        if (next !== prev) return advanceSetup(next);
        return prev;
      });
      return;
    }

    // During main phase (build mode), show popup instead of immediately building
    if (phase === 'main' && buildMode) {
      setSelectedVertex(vertexId);
      return;
    }

    // Always show bank management popup when clicking a vertex
    setSelectedVertex(vertexId);

    if (buildMode === 'settlement' && phase === 'main') {
      if (canBuildSettlement(gameState, playerId, vertexId)) {
        setGameState(prev => buildSettlement(prev, playerId, vertexId));
        setBuildMode(null);
      }
      return;
    }

    if (buildMode === 'city' && phase === 'main') {
      if (canBuildCity(gameState, playerId, vertexId)) {
        setGameState(prev => buildCity(prev, playerId, vertexId));
        setBuildMode(null);
      }
      return;
    }
  }, [gameState, buildMode]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    const phase = gameState.phase;
    const playerId = getCurrentPlayer(gameState).id;

    if (phase === 'setup-road') {
      setGameState(prev => {
        const next = buildRoad(prev, playerId, edgeId);
        if (next !== prev) return advanceSetup(next);
        return prev;
      });
      return;
    }

    if (buildMode === 'road' && phase === 'main') {
      if (canBuildRoad(gameState, playerId, edgeId)) {
        setGameState(prev => buildRoad(prev, playerId, edgeId));
        setBuildMode(null);
      }
      return;
    }

    // Free road placement from Road Building dev card
    if (gameState.freeRoadsRemaining > 0) {
      setGameState(prev => buildFreeRoad(prev, playerId, edgeId));
      return;
    }
  }, [gameState, buildMode]);

  // Show vertex/edge targets when in build mode or setup phase
  const showVertexTargets = buildMode === 'settlement' || buildMode === 'city' || gameState.phase === 'setup-settlement';
  const showEdgeTargets = buildMode === 'road' || gameState.phase === 'setup-road' || gameState.freeRoadsRemaining > 0;

  const currentPlayer = getCurrentPlayer(gameState);

  // Compute ONLY the valid placement positions — filter out illegal spots
  const validVertexIds = useMemo(() => {
    if (!showVertexTargets) return [];
    const pid = currentPlayer.id;
    const isSetup = gameState.phase === 'setup-settlement';

    if (buildMode === 'city') {
      // City: only the current player's existing settlements
      return gameState.vertices
        .filter(v => canBuildCity(gameState, pid, v.id))
        .map(v => v.id);
    }

    // Settlement (setup or main phase)
    return gameState.vertices
      .filter(v => canBuildSettlement(gameState, pid, v.id, isSetup))
      .map(v => v.id);
  }, [showVertexTargets, gameState, buildMode, currentPlayer.id]);

  const validEdgeIds = useMemo(() => {
    if (!showEdgeTargets) return [];
    const pid = currentPlayer.id;
    const isSetup = gameState.phase === 'setup-road';

    return gameState.edges
      .filter(e => canBuildRoad(gameState, pid, e.id, isSetup))
      .map(e => e.id);
  }, [showEdgeTargets, gameState, currentPlayer.id]);
  const uiProjection = computeUIProjection(gameState, currentPlayer.id);
  const diceVisible = gameState.phase === 'roll' || !!gameState.diceRoll;
  const phaseHelp = (() => {
    switch (gameState.phase) {
      case 'setup-settlement':
        return '👆 Click a glowing gold diamond on any hex corner to place your starting settlement.';
      case 'setup-road':
        return '👆 Click a glowing orange bar next to your settlement to place your starting road.';
      case 'roll':
        return 'Roll is available now. After the roll, production or robber flow resolves automatically.';
      case 'discard':
        return 'A 7 was rolled. Players above the hand limit must discard before the robber moves.';
      case 'robber-move':
        return 'Select a destination hex for the robber. The current robber hex is blocked.';
      case 'robber-steal':
        return 'Choose one adjacent opponent to steal a random resource from.';
      case 'main':
        return 'Main phase: build, trade, play an eligible development card, or end your turn.';
      case 'game-over':
        return 'The match is over.';
      default:
        return 'Follow the current phase prompt to continue the match.';
    }
  })();

  // ── Lobby gate ────────────────────────────────────────────────────────────
  if (showLobby) {
    return <CatanLobby onStart={handleLobbyStart} />;
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative bg-gradient-to-br from-blue-950 via-cyan-950 to-emerald-950 select-none">
      {/* === INTRO ANIMATION OVERLAY === */}
      {showIntroAnimation && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-6xl font-bold text-white mb-4">CATAN</h1>
              <p className="text-2xl text-slate-300">
                {introPhase === 'shuffle' && 'Shuffling Hexagons...'}
                {introPhase === 'letters' && 'Assigning Numbers in Alphabetical Order...'}
                {introPhase === 'numbers' && 'Revealing Numbers...'}
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              {introPhase === 'shuffle' && (
                <>
                  <div className="w-16 h-16 bg-amber-600 rounded-lg animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-16 h-16 bg-green-600 rounded-lg animate-bounce" style={{ animationDelay: '100ms' }}></div>
                  <div className="w-16 h-16 bg-blue-600 rounded-lg animate-bounce" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-16 h-16 bg-yellow-600 rounded-lg animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-16 h-16 bg-gray-600 rounded-lg animate-bounce" style={{ animationDelay: '400ms' }}></div>
                </>
              )}
              {introPhase === 'letters' && (
                <div className="text-4xl font-bold text-white">
                  A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
                </div>
              )}
              {introPhase === 'numbers' && (
                <div className="text-4xl font-bold text-white">
                  2 3 4 5 6 7 8 9 10 11 12
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === FULL-SCREEN 3D BOARD === */}
      <div className="absolute inset-0 z-0">
        <CatanBoard3D
          gameState={gameState}
          presencePlayers={presencePlayers}
          onHexClick={handleHexClick}
          onVertexClick={showVertexTargets ? handleVertexClick : undefined}
          onEdgeClick={showEdgeTargets ? handleEdgeClick : undefined}
          validVertexIds={validVertexIds}
          validEdgeIds={validEdgeIds}
        />
      </div>

      {/* === VERTEX POPUP — Bank resource management with -/+ === */}
      <AnimatePresence>
        {selectedVertex && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="pointer-events-auto bg-slate-900/95 border border-slate-600 rounded-2xl p-5 shadow-2xl max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Bank Resource Management</h3>
                <button
                  onClick={() => setSelectedVertex(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as ResourceType[]).map(resource => {
                  const player = getCurrentPlayer(gameState);
                  const count = player.resources[resource];
                  const emoji = ResourceEmoji[resource];

                  return (
                    <div key={resource} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg">
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-white font-semibold w-16">{count}</span>
                      <button
                        onClick={() => {
                          // Withdraw from bank (add to player)
                          setGameState(prev => {
                            const idx = prev.players.findIndex(p => p.id === player.id);
                            if (idx === -1) return prev;
                            const updated = [...prev.players];
                            updated[idx] = {
                              ...updated[idx],
                              resources: {
                                ...updated[idx].resources,
                                [resource]: updated[idx].resources[resource] + 1,
                              },
                            };
                            return { ...prev, players: updated };
                          });
                        }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl py-2 rounded-lg transition-all active:scale-95"
                      >
                        +
                      </button>
                      <button
                        onClick={() => {
                          // Deposit to bank (remove from player)
                          if (count > 0) {
                            setGameState(prev => {
                              const idx = prev.players.findIndex(p => p.id === player.id);
                              if (idx === -1) return prev;
                              const updated = [...prev.players];
                              updated[idx] = {
                                ...updated[idx],
                                resources: {
                                  ...updated[idx].resources,
                                  [resource]: updated[idx].resources[resource] - 1,
                                },
                              };
                              return { ...prev, players: updated };
                            });
                          }
                        }}
                        disabled={count === 0}
                        className={`flex-1 font-bold text-xl py-2 rounded-lg transition-all active:scale-95 ${
                          count > 0
                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        −
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-slate-400 text-xs mt-4 text-center">
                Click + to withdraw from bank, − to deposit to bank
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* === FLOATING HEADER — safe-area aware, compact on mobile === */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none safe-top">
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 gap-2">
          {/* Back + title */}
          <div className="flex items-center gap-2 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/10 min-w-0">
            <Link to="/dashboard" className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
            </Link>
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Map className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-white truncate">Settlers of Catan</h1>
              <p className="text-xs text-slate-400">Turn {gameState.turn}</p>
            </div>
          </div>

          {/* Player avatar bar — circular portraits (like ABAS top bar) */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-black/60 backdrop-blur-md rounded-xl px-2 sm:px-3 py-1.5 border border-white/10">
            {gameState.players.map((p, i) => {
              const isActive = i === gameState.currentPlayerIndex;
              return (
                <div key={p.id} className="relative group" title={`${p.name} · ${p.victoryPoints} VP`}>
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.color.replace('#', '')}`}
                    alt={p.name}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 transition-all ${
                      isActive ? 'scale-110 ring-2 ring-yellow-400/70' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ borderColor: p.color }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {isActive && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]" />
                  )}
                  {aiPlayerIds.includes(p.id) && (
                    <Bot className="w-3 h-3 text-violet-300 absolute -top-0.5 -right-0.5 bg-slate-900 rounded-full p-px" />
                  )}
                  {/* Hover tooltip */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-black/90 rounded-lg px-2 py-1 border border-white/15 text-center whitespace-nowrap">
                      <div className="text-[10px] font-bold text-white">{p.name}</div>
                      <div className="text-[9px] font-bold" style={{ color: p.color }}>{p.victoryPoints} VP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Camera mode switcher — hidden on small phones, visible from sm */}
          <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 border border-white/10 hidden xs:flex items-center gap-0.5 sm:gap-1">
            {(['tactical', 'table', 'inspect', 'cinematic'] as CameraMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setCameraMode(mode)}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                  cameraMode === mode
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {/* Abbreviate on narrow screens */}
                <span className="hidden sm:inline">{mode}</span>
                <span className="sm:hidden">{mode[0].toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Save / Load / Undo + HUD toggles */}
          <div className="pointer-events-auto flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-xl px-2 py-1.5 border border-white/10">
            <button
              onClick={() => handleAction('undo')}
              disabled={!canUndo()}
              title="Undo last action"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('save')}
              title="Save game"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Save className="w-4 h-4" />
            </button>
            {hasSave() && (
              <button
                onClick={() => handleAction('load')}
                title="Load saved game"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-4 bg-white/15 mx-0.5" />
            <button
              onClick={() => setShowTutorial(v => !v)}
              title="Tutorial"
              className={`p-1.5 rounded-lg transition-colors ${showTutorial ? 'text-amber-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRules(v => !v)}
              title="Rules Reference"
              className={`p-1.5 rounded-lg transition-colors ${showRules ? 'text-blue-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowChat(v => !v)}
              title="Chat"
              className={`p-1.5 rounded-lg transition-colors ${showChat ? 'text-green-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDiceHistory(v => !v)}
              title="Dice History"
              className={`p-1.5 rounded-lg transition-colors ${showDiceHistory ? 'text-orange-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSaveLoad(v => !v)}
              title="Save / Load"
              className={`p-1.5 rounded-lg transition-colors ${showSaveLoad ? 'text-purple-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowReplay(v => !v); setReplayIndex(gameState.log.length - 1); }}
              title="Replay Log"
              className={`p-1.5 rounded-lg transition-colors ${showReplay ? 'text-cyan-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowLeaderboard(v => !v)}
              title="Leaderboard"
              className={`p-1.5 rounded-lg transition-colors ${showLeaderboard ? 'text-yellow-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <Trophy className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTxLog(v => !v)}
              title="Transaction Log"
              className={`p-1.5 rounded-lg transition-colors ${showTxLog ? 'text-pink-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-white/15 mx-0.5" />
            <button
              onClick={() => setLayoutMode(v => !v)}
              title="Layout Mode — drag panels in 3D space"
              className={`p-1.5 rounded-lg transition-colors ${layoutMode ? 'text-teal-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <Move className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSoundMuted(v => !v)}
              title={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
              className={`p-1.5 rounded-lg transition-colors ${soundMuted ? 'text-red-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowSettings(v => !v)}
              title="Settings"
              className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/10 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-300 flex-shrink-0">
            <ScrollText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{gameState.developmentCardDeck.length} cards</span>
            <span className="sm:hidden">{gameState.developmentCardDeck.length}</span>
          </div>
        </div>

        {/* Build Mode / Free Roads floating banner — large, prominent, with instructions */}
        {(buildMode || gameState.freeRoadsRemaining > 0) && (
          <div className="flex justify-center mt-2 pointer-events-auto">
            <div className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-bold shadow-xl animate-pulse ${
              gameState.freeRoadsRemaining > 0
                ? 'bg-green-600/90 text-white border-2 border-green-300/50 shadow-green-500/30'
                : buildMode === 'road'
                  ? 'bg-amber-600/90 text-white border-2 border-amber-300/50 shadow-amber-500/30'
                  : buildMode === 'city'
                    ? 'bg-blue-600/90 text-white border-2 border-blue-300/50 shadow-blue-500/30'
                    : 'bg-emerald-600/90 text-white border-2 border-emerald-300/50 shadow-emerald-500/30'
            } backdrop-blur-lg`}>
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl">
                  {gameState.freeRoadsRemaining > 0 ? '🛤️' : buildMode === 'road' ? '🛤️' : buildMode === 'city' ? '🏰' : '🏠'}
                </span>
                <div>
                  <div>
                    {gameState.freeRoadsRemaining > 0
                      ? `Road Building: Place ${gameState.freeRoadsRemaining} free road${gameState.freeRoadsRemaining > 1 ? 's' : ''}`
                      : `Place a ${buildMode}`}
                  </div>
                  <div className="text-[10px] sm:text-xs font-normal opacity-80 mt-0.5">
                    {buildMode === 'road' || gameState.freeRoadsRemaining > 0
                      ? '👆 Click a glowing orange bar between two corners'
                      : buildMode === 'city'
                        ? '👆 Click one of your existing settlements to upgrade'
                        : '👆 Click a glowing gold diamond on any hex corner'}
                  </div>
                </div>
                {buildMode && (
                  <button onClick={() => setBuildMode(null)} className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">✕ Cancel</button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center mt-1 px-2 sm:px-4 pointer-events-none">
          <div className="max-w-3xl w-full bg-black/45 backdrop-blur-md rounded-xl border border-white/10 px-3 sm:px-4 py-2 text-center">
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/35 font-bold">
              {uiProjection.phaseLabel}
            </div>
            <div className="text-xs sm:text-sm text-white/78 mt-0.5">
              {phaseHelp}
            </div>
          </div>
        </div>
      </div>

      {/* === LEFT PANEL — Players (floating, collapses on mobile) === */}
      <div className="absolute left-1.5 sm:left-3 top-16 sm:top-20 w-48 sm:w-64 z-20 pointer-events-auto overflow-y-auto max-h-[calc(100dvh-5rem)] sm:max-h-[calc(100dvh-6rem)]">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-2 sm:p-3 space-y-1.5 sm:space-y-2">
          <h2 className="text-xs sm:text-sm font-bold text-white/80 flex items-center gap-1.5 sm:gap-2 px-1">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
            Players
          </h2>
          {gameState.players.map(player => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayer.id}
              isAI={aiPlayerIds.includes(player.id)}
              currentTurn={gameState.turn}
              gameState={gameState}
            />
          ))}
        </div>
      </div>

      {/* === RIGHT PANEL — Actions & Resources (floating) === */}
      {/* On mobile: anchored to bottom as a compact strip; on desktop: right side panel */}
      <div className="absolute right-1.5 sm:right-3 bottom-16 sm:bottom-auto sm:top-20 w-[calc(100vw-8.5rem)] sm:w-72 z-20 pointer-events-auto overflow-y-auto max-h-[50vh] sm:max-h-[calc(100dvh-6rem)] space-y-2 sm:space-y-3">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-2 sm:p-3">
          <ActionPanel 
            gameState={gameState} 
            onAction={handleAction}
            rolling={rolling}
            rollKey={rollKey}
            onOpenTrade={() => setShowTradePanel(true)}
          />
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-2 sm:p-3">
          <ResourcePanel player={currentPlayer} gameState={gameState} />
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/45 font-bold">
            <span>Dice Flow</span>
            <span className={gameState.phase === 'roll' ? 'text-amber-300' : 'text-white/35'}>
              {gameState.phase === 'roll' ? 'Ready' : gameState.diceRoll ? 'Resolved' : 'Waiting'}
            </span>
          </div>
          {diceVisible ? (
            <div className="flex flex-col items-center gap-2">
              <CatanDice values={gameState.diceRoll ?? [1, 1]} rollKey={rollKey} />
              <p className="text-[11px] text-center text-slate-300 leading-relaxed">
                {gameState.phase === 'roll'
                  ? 'Press Roll Dice in the Actions panel to begin the turn.'
                  : gameState.diceRoll
                    ? `Latest total: ${gameState.diceRoll[0] + gameState.diceRoll[1]}.`
                    : 'Dice will become active when the turn reaches the roll phase.'}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dice are intentionally hidden during the initial settlement/road setup because no roll is allowed yet.
            </p>
          )}
        </div>
      </div>

      {/* === FLOATING DICE OVERLAY — prominent center-screen roll result === */}
      {gameState.diceRoll && gameState.phase !== 'setup-settlement' && gameState.phase !== 'setup-road' && (
        <div className="absolute bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/15 shadow-2xl flex flex-col items-center gap-2">
            <p className="text-[10px] text-white/45 font-semibold uppercase tracking-widest">
              {currentPlayer.name} rolled
            </p>
            <CatanDice values={gameState.diceRoll} rollKey={rollKey} />
            {gameState.diceRoll[0] + gameState.diceRoll[1] === 7 && (
              <p className="text-amber-400 text-xs font-bold tracking-wide animate-pulse">⚠ Robber activated!</p>
            )}
            {productionLog.length > 0 && (
              <div className="w-full border-t border-white/10 pt-2 mt-1 space-y-1 min-w-[180px]">
                {productionLog.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-white/60 truncate">{entry.playerName}</span>
                    <span className={`font-bold text-white px-1.5 py-0.5 rounded text-[10px] ${ResourceColors[entry.resource]}`}>
                      +{entry.amount} {entry.resource}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TURN BANNER — top-centre current player + phase indicator === */}
      {gameState.phase !== 'game-over' && (
        <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
          <div
            className="flex items-center gap-2 bg-black/65 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1 sm:py-1.5 border"
            style={{ borderColor: currentPlayer.color + '99' }}
          >
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full animate-pulse" style={{ background: currentPlayer.color }} />
            <span className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">
              {currentPlayer.name}{aiPlayerIds.includes(currentPlayer.id) ? ' 🤖' : ''}
            </span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/55 text-xs">{uiProjection.phaseLabel}</span>
          </div>
        </div>
      )}

      {/* === TRADE PANEL === */}
      <AnimatePresence>
        {showTradePanel && (
          <Suspense fallback={null}>
            <CatanTradePanel
              gameState={gameState}
              currentPlayerId={currentPlayer.id}
              onStateChange={(s) => { setGameState(s); setShowTradePanel(false); }}
              onClose={() => setShowTradePanel(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* === TELEPRESENCE PANEL — WebRTC T1 video panels (multiplayer only) === */}
      {mp.isMultiplayer && (
        <CatanPresence
          localPlayerId={mp.playerId ?? 'local'}
          players={gameState.players.map(p => ({ id: p.id, name: p.name, color: p.color }))}
          sendSignal={(msg) => mp.sendSignal(msg)}
          onSignal={(handler) => {
            presenceSendRef.current = handler as unknown as (msg: unknown) => void;
            return () => { presenceSendRef.current = null; };
          }}
          onPeersChange={handlePeersChange}
        />
      )}

      {/* === HUD OVERLAYS (Tutorial, Rules, Chat, Dice History) === */}
      <TutorialOverlay isActive={showTutorial} onClose={() => setShowTutorial(false)} />
      <RulesReference isOpen={showRules} onClose={() => setShowRules(false)} />
      <GameChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={chatMessages}
        onSend={(text) => {
          setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            playerColor: currentPlayer.color,
            text,
            timestamp: Date.now(),
          }]);
        }}
        currentPlayerId={currentPlayer.id}
      />
      <DiceHistoryChart isOpen={showDiceHistory} onClose={() => setShowDiceHistory(false)} history={diceHistory} />
      <SaveLoadPanel
        isOpen={showSaveLoad}
        onClose={() => setShowSaveLoad(false)}
        onSave={() => saveGame(gameState)}
        onLoad={() => {
          const saved = loadGame();
          if (saved) { setGameState(saved.state); setBuildMode(null); }
        }}
        hasSave={hasSave()}
      />
      <ReplayControls
        isActive={showReplay}
        log={gameState.log}
        currentIndex={replayIndex}
        onStep={setReplayIndex}
        onPlay={() => setReplayPlaying(true)}
        onPause={() => setReplayPlaying(false)}
        onClose={() => { setShowReplay(false); setReplayPlaying(false); }}
        isPlaying={replayPlaying}
      />
      <ResourceGainNotifications gains={resourceGains} />
      <ZoomControls
        onZoomIn={() => {/* OrbitControls zoom handled by scroll — placeholder for programmatic zoom */}}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
      />

      {/* === VP CELEBRATION OVERLAY — sparkle animation on VP gain === */}
      {vpCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="animate-bounce text-center">
            <div className="text-6xl mb-2">🎉</div>
            <div className="bg-black/80 backdrop-blur-lg rounded-2xl px-8 py-4 border border-yellow-500/40 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
              <p className="text-yellow-400 text-lg font-extrabold tracking-wide">{vpCelebration.player}</p>
              <p className="text-white text-3xl font-black mt-1">{vpCelebration.vp} VP ⭐</p>
            </div>
          </div>
          {/* Sparkle particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-yellow-400 animate-ping"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 0.12}s`,
                animationDuration: '1.5s',
              }}
            />
          ))}
        </div>
      )}

      {/* === HAND LIMIT WARNING — alert when > 7 cards (vulnerable to robber) === */}
      {handLimitWarning && gameState.phase !== 'game-over' && (
        <div className="absolute top-32 sm:top-36 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-red-900/80 backdrop-blur-md rounded-xl px-4 py-2 border border-red-500/40 shadow-lg animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-200 text-xs font-semibold">
              {totalCards} cards in hand! Discard to 7 if a 7 is rolled.
            </span>
          </div>
        </div>
      )}

      {/* === LEADERBOARD PANEL — VP ranking sidebar === */}
      {showLeaderboard && (
        <div className="absolute left-1/2 -translate-x-1/2 top-40 z-40 pointer-events-auto">
          <div className="bg-black/85 backdrop-blur-lg rounded-2xl border border-white/15 shadow-2xl px-5 py-4 min-w-[260px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Leaderboard
              </h3>
              <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-1.5">
              {[...gameState.players]
                .sort((a, b) => b.victoryPoints - a.victoryPoints)
                .map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      i === 0 ? 'bg-yellow-500/15 border border-yellow-500/30' : 'bg-white/5'
                    }`}
                  >
                    <span className="text-xs font-bold text-white/50 w-4">{i + 1}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-sm text-white font-medium flex-1 truncate">{p.name}</span>
                    <span className="text-sm font-extrabold" style={{ color: p.color }}>
                      {p.victoryPoints} VP
                    </span>
                    {p.hasLongestRoad && <span className="text-[10px]" title="Longest Road">🛤</span>}
                    {p.playedKnights >= 3 && <span className="text-[10px]" title="Largest Army">⚔</span>}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* === TRANSACTION LOG — resource flow history === */}
      {showTxLog && (
        <div className="absolute right-3 top-40 z-40 pointer-events-auto">
          <div className="bg-black/85 backdrop-blur-lg rounded-2xl border border-white/15 shadow-2xl px-4 py-3 w-72 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-pink-400" />
                Transaction Log
              </h3>
              <button onClick={() => setShowTxLog(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            {txLog.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No transactions yet.</p>
            ) : (
              <div className="space-y-1">
                {txLog.slice(-50).reverse().map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-b border-white/5 pb-1">
                    <span className="text-white/30 text-[10px] tabular-nums flex-shrink-0">
                      {new Date(entry.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-white/70">{entry.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === LAYOUT MODE INDICATOR === */}
      {layoutMode && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <div className="bg-teal-900/85 backdrop-blur-md rounded-xl px-5 py-2 border border-teal-500/40 flex items-center gap-3 shadow-lg">
            <Move className="w-4 h-4 text-teal-300" />
            <span className="text-teal-200 text-xs font-semibold">Layout Mode Active — drag presence panels in 3D space</span>
            <button
              onClick={() => setLayoutMode(false)}
              className="text-teal-400 hover:text-white text-xs underline ml-2"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* === SETTINGS PANEL === */}
      {showSettings && (
        <div className="absolute right-3 top-14 z-50 pointer-events-auto">
          <div className="bg-black/90 backdrop-blur-lg rounded-2xl border border-white/15 shadow-2xl px-5 py-4 w-72">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                Game Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-3">
              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Sound Effects</span>
                <button
                  onClick={() => setSoundMuted(v => !v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    soundMuted ? 'bg-red-600/30 text-red-300 border border-red-500/30' : 'bg-green-600/30 text-green-300 border border-green-500/30'
                  }`}
                >
                  {soundMuted ? 'Muted' : 'On'}
                </button>
              </div>
              {/* Layout mode */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Layout Mode</span>
                <button
                  onClick={() => setLayoutMode(v => !v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    layoutMode ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'bg-slate-600/30 text-slate-300 border border-slate-500/30'
                  }`}
                >
                  {layoutMode ? 'Active' : 'Off'}
                </button>
              </div>
              {/* Camera mode */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Camera</span>
                <select
                  value={cameraMode}
                  onChange={e => setCameraMode(e.target.value as CameraMode)}
                  className="bg-slate-800 text-white text-xs rounded-lg px-2 py-1 border border-white/15"
                >
                  {(['tactical', 'table', 'inspect', 'cinematic'] as CameraMode[]).map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
              {/* Board info */}
              <div className="border-t border-white/10 pt-2 mt-2 text-[10px] text-white/30 space-y-0.5">
                <div>Players: {gameState.players.length} · Turn: {gameState.turn}</div>
                <div>Dev cards remaining: {gameState.developmentCardDeck.length}</div>
                <div>Phase: {gameState.phase}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
