/**
 * TableForge - Catan Game Page
 * Complete game interface with hexagonal board
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import CatanBoard3D from './CatanBoard3D';
import { 
  Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
  Home, Building2, Route, ScrollText,
  Users, ArrowRight, Repeat, Package,
  Crown, Sword, Map, Wheat, Trees, Mountain,
  Layers, ArrowLeft, RotateCcw
} from 'lucide-react';
import {
  type GameState,
  type Player,
  type ResourceType,
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
  canPlayDevCard,
  playKnight,
  playYearOfPlenty,
  playMonopoly,
  playRoadBuilding,
  buildFreeRoad,
  getPlayerTradeRatio,
  hasResources,
  BUILDING_COSTS,
} from './CatanEngine';

// ============================================================================
// RESOURCE ICONS
// ============================================================================

const ResourceIcons: Record<ResourceType, React.ReactNode> = {
  wood: <Trees className="w-4 h-4 text-green-600" />,
  brick: <Layers className="w-4 h-4 text-red-600" />,
  sheep: <Package className="w-4 h-4 text-lime-500" />,
  wheat: <Wheat className="w-4 h-4 text-yellow-500" />,
  ore: <Mountain className="w-4 h-4 text-slate-400" />,
};

const ResourceColors: Record<ResourceType, string> = {
  wood: 'bg-green-600',
  brick: 'bg-red-600',
  sheep: 'bg-lime-500',
  wheat: 'bg-yellow-500',
  ore: 'bg-slate-500',
};

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

// ============================================================================
// HEX BOARD COMPONENT
// ============================================================================

interface HexBoardProps {
  gameState: GameState;
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

function HexBoard({ gameState, onHexClick, onVertexClick, onEdgeClick }: HexBoardProps) {
  const hexSize = 50;

  const getHexCenter = (q: number, r: number) => {
    const x = hexSize * (3/2 * q);
    const y = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
    return { x: x + 300, y: y + 250 };
  };

  const getHexPoints = (cx: number, cy: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = cx + hexSize * Math.cos(angle);
      const y = cy + hexSize * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const terrainColors: Record<string, [string, string]> = {
    forest: ['#1B5E20', '#2E7D32'],
    hills: ['#A0522D', '#CD853F'],
    pasture: ['#558B2F', '#7CB342'],
    fields: ['#F9A825', '#FDD835'],
    mountains: ['#546E7A', '#78909C'],
    desert: ['#D4A056', '#E8C878'],
  };

  // Probability dots for number tokens
  const getProbDots = (n: number): number => {
    const dots: Record<number, number> = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 };
    return dots[n] || 0;
  };

  return (
    <svg viewBox="0 0 600 500" className="w-full h-full">
      <defs>
        {/* Ocean gradient */}
        <radialGradient id="ocean-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1565C0" />
          <stop offset="100%" stopColor="#0D47A1" />
        </radialGradient>
        {/* Terrain gradients */}
        {Object.entries(terrainColors).map(([terrain, [c1, c2]]) => (
          <radialGradient key={terrain} id={`terrain-${terrain}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
          </radialGradient>
        ))}
        {/* Number token glow */}
        <filter id="token-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.4" />
        </filter>
        {/* Hex border glow */}
        <filter id="hex-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Ocean background with gradient */}
      <rect width="600" height="500" fill="url(#ocean-grad)" />
      {/* Wave pattern overlay */}
      <rect width="600" height="500" fill="url(#ocean-grad)" opacity="0.8" rx="20" />
      
      {/* Hex tiles */}
      {gameState.hexTiles.map(hex => {
        const center = getHexCenter(hex.position.q, hex.position.r);
        const points = getHexPoints(center.x, center.y);
        
        return (
          <g key={hex.id} onClick={() => onHexClick?.(hex.id)} className="cursor-pointer">
            {/* Hex tile with gradient fill */}
            <polygon
              points={points}
              fill={`url(#terrain-${hex.terrain})`}
              stroke="#5D4037"
              strokeWidth="2.5"
              filter="url(#hex-glow)"
            />
            {/* Terrain decoration — inner highlight */}
            <polygon
              points={getHexPoints(center.x, center.y - 1).split(' ').map((p, i) => {
                const [px, py] = p.split(',').map(Number);
                const dx = px - center.x;
                const dy = py - center.y;
                return `${center.x + dx * 0.92},${center.y + dy * 0.92}`;
              }).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
            {/* Number token with shadow */}
            {hex.number && (
              <>
                <circle
                  cx={center.x}
                  cy={center.y}
                  r="17"
                  fill="#FFF8DC"
                  stroke={hex.number === 6 || hex.number === 8 ? '#C62828' : '#5D4037'}
                  strokeWidth={hex.number === 6 || hex.number === 8 ? 2.5 : 1.5}
                  filter="url(#token-shadow)"
                />
                <text
                  x={center.x}
                  y={center.y + 5}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="bold"
                  fill={hex.number === 6 || hex.number === 8 ? '#C62828' : '#3E2723'}
                >
                  {hex.number}
                </text>
                {/* Probability dots */}
                <text
                  x={center.x}
                  y={center.y + 14}
                  textAnchor="middle"
                  fontSize="6"
                  fill={hex.number === 6 || hex.number === 8 ? '#C62828' : '#795548'}
                >
                  {'●'.repeat(getProbDots(hex.number))}
                </text>
              </>
            )}
            {/* Robber figure */}
            {hex.hasRobber && (
              <g>
                <circle cx={center.x} cy={center.y} r="13" fill="#1a1a1a" stroke="#444" strokeWidth="1.5" />
                <text x={center.x} y={center.y + 5} textAnchor="middle" fontSize="14" fill="#EF5350">🗡</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Buildings on vertices */}
      {gameState.vertices.filter(v => v.building).map(vertex => {
        // Calculate vertex position (simplified - center of adjacent hexes)
        const hexCenters = vertex.hexIds.map(id => {
          const hex = gameState.hexTiles.find(h => h.id === id);
          return hex ? getHexCenter(hex.position.q, hex.position.r) : null;
        }).filter(Boolean) as { x: number; y: number }[];
        
        if (hexCenters.length === 0) return null;
        
        const avgX = hexCenters.reduce((sum, c) => sum + c.x, 0) / hexCenters.length;
        const avgY = hexCenters.reduce((sum, c) => sum + c.y, 0) / hexCenters.length;
        
        const player = gameState.players.find(p => p.id === vertex.building!.playerId);
        const isCity = vertex.building!.type === 'city';
        
        return (
          <g key={vertex.id}>
            {isCity ? (
              <rect
                x={avgX - 10}
                y={avgY - 10}
                width="20"
                height="20"
                fill={player?.color || '#888'}
                stroke="#000"
                strokeWidth="2"
              />
            ) : (
              <circle
                cx={avgX}
                cy={avgY}
                r="8"
                fill={player?.color || '#888'}
                stroke="#000"
                strokeWidth="2"
              />
            )}
          </g>
        );
      })}

      {/* Roads on edges */}
      {gameState.edges.filter(e => e.road).map(edge => {
        const [v1Id, v2Id] = edge.vertexIds;
        const v1 = gameState.vertices.find(v => v.id === v1Id);
        const v2 = gameState.vertices.find(v => v.id === v2Id);
        
        if (!v1 || !v2) return null;
        
        const getVertexPos = (vertex: typeof v1) => {
          const hexCenters = vertex!.hexIds.map(id => {
            const hex = gameState.hexTiles.find(h => h.id === id);
            return hex ? getHexCenter(hex.position.q, hex.position.r) : null;
          }).filter(Boolean) as { x: number; y: number }[];
          
          if (hexCenters.length === 0) return { x: 0, y: 0 };
          return {
            x: hexCenters.reduce((sum, c) => sum + c.x, 0) / hexCenters.length,
            y: hexCenters.reduce((sum, c) => sum + c.y, 0) / hexCenters.length,
          };
        };
        
        const pos1 = getVertexPos(v1);
        const pos2 = getVertexPos(v2);
        const player = gameState.players.find(p => p.id === edge.road!.playerId);
        
        return (
          <line
            key={edge.id}
            x1={pos1.x}
            y1={pos1.y}
            x2={pos2.x}
            y2={pos2.y}
            stroke={player?.color || '#888'}
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}

      {/* Clickable empty edges for road placement */}
      {onEdgeClick && gameState.edges.filter(e => !e.road).map(edge => {
        const [v1Id, v2Id] = edge.vertexIds;
        const v1 = gameState.vertices.find(v => v.id === v1Id);
        const v2 = gameState.vertices.find(v => v.id === v2Id);
        if (!v1 || !v2) return null;

        const getPos = (vertex: typeof v1) => {
          const hexCenters = vertex!.hexIds.map(id => {
            const hex = gameState.hexTiles.find(h => h.id === id);
            return hex ? getHexCenter(hex.position.q, hex.position.r) : null;
          }).filter(Boolean) as { x: number; y: number }[];
          if (hexCenters.length === 0) return null;
          return {
            x: hexCenters.reduce((sum, c) => sum + c.x, 0) / hexCenters.length,
            y: hexCenters.reduce((sum, c) => sum + c.y, 0) / hexCenters.length,
          };
        };
        const p1 = getPos(v1);
        const p2 = getPos(v2);
        if (!p1 || !p2) return null;

        return (
          <line
            key={`edge-click-${edge.id}`}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#FFD700"
            strokeWidth="10"
            strokeLinecap="round"
            opacity={0.5}
            className="cursor-pointer hover:opacity-90 transition-opacity animate-pulse"
            onClick={(e) => { e.stopPropagation(); onEdgeClick(edge.id); }}
          />
        );
      })}

      {/* Clickable empty vertices for settlement/city placement */}
      {onVertexClick && gameState.vertices.filter(v => !v.building).map(vertex => {
        const hexCenters = vertex.hexIds.map(id => {
          const hex = gameState.hexTiles.find(h => h.id === id);
          return hex ? getHexCenter(hex.position.q, hex.position.r) : null;
        }).filter(Boolean) as { x: number; y: number }[];
        if (hexCenters.length === 0) return null;
        const avgX = hexCenters.reduce((sum, c) => sum + c.x, 0) / hexCenters.length;
        const avgY = hexCenters.reduce((sum, c) => sum + c.y, 0) / hexCenters.length;

        return (
          <circle
            key={`vertex-click-${vertex.id}`}
            cx={avgX} cy={avgY} r="10"
            fill="#FFD700"
            stroke="#FFF"
            strokeWidth="2"
            opacity={0.6}
            className="cursor-pointer hover:opacity-100 transition-opacity animate-pulse"
            onClick={(e) => { e.stopPropagation(); onVertexClick(vertex.id); }}
          />
        );
      })}
    </svg>
  );
}

// ============================================================================
// PLAYER PANEL
// ============================================================================

interface PlayerPanelProps {
  player: Player;
  isCurrentPlayer: boolean;
}

function PlayerPanel({ player, isCurrentPlayer }: PlayerPanelProps) {
  return (
    <div 
      className={`rounded-lg border-2 p-3 transition-all ${
        isCurrentPlayer 
          ? 'border-yellow-400 bg-slate-800/90 shadow-lg shadow-yellow-400/20' 
          : 'border-slate-600 bg-slate-800/70'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: player.color }}
        >
          {player.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{player.name}</span>
            {isCurrentPlayer && <Crown className="w-4 h-4 text-yellow-400" />}
          </div>
          <div className="text-sm text-purple-400 font-bold">{player.victoryPoints} VP</div>
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {(Object.entries(player.resources) as [ResourceType, number][]).map(([resource, count]) => (
          <div 
            key={resource}
            className={`${ResourceColors[resource]} rounded p-1 text-center text-white text-xs font-bold`}
            title={resource}
          >
            {count}
          </div>
        ))}
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

      {/* Dev cards count */}
      {player.developmentCards.length > 0 && (
        <div className="mt-2 text-xs text-slate-400">
          <ScrollText className="w-3 h-3 inline mr-1" />
          {player.developmentCards.length} development cards
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
}

function ActionPanel({ gameState, onAction, rolling }: ActionPanelProps) {
  const currentPlayer = getCurrentPlayer(gameState);

  const renderPhaseActions = () => {
    switch (gameState.phase) {
      case 'setup-settlement':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}: Place your settlement (Round {gameState.setupRound})
            </p>
            <p className="text-sm text-slate-400">
              Click on a valid intersection on the board
            </p>
          </div>
        );

      case 'setup-road':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}: Place your road
            </p>
            <p className="text-sm text-slate-400">
              Click on an edge adjacent to your settlement
            </p>
          </div>
        );

      case 'roll':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}'s turn. Roll the dice!
            </p>
            <button
              onClick={() => onAction('roll')}
              disabled={rolling}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              {rolling ? 'Rolling...' : 'Roll Dice'}
            </button>
          </div>
        );

      case 'robber-move':
        return (
          <div className="space-y-3">
            <p className="text-orange-300">
              Move the robber! Click on a hex tile.
            </p>
          </div>
        );

      case 'robber-steal':
        return (
          <div className="space-y-3">
            <p className="text-orange-300">
              Choose a player to steal from:
            </p>
            {gameState.players
              .filter(p => p.id !== currentPlayer.id)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => onAction('steal', p.id)}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Steal from {p.name}
                </button>
              ))}
          </div>
        );

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

            {/* Trade with bank */}
            <button
              onClick={() => onAction('bank-trade')}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Repeat className="w-4 h-4" /> Trade with Bank (4:1)
            </button>

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
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-center gap-4">
            {DiceIcons[gameState.diceRoll[0] - 1] && (
              <>
                {(() => {
                  const Icon1 = DiceIcons[gameState.diceRoll[0] - 1];
                  const Icon2 = DiceIcons[gameState.diceRoll[1] - 1];
                  return (
                    <>
                      <Icon1 className="w-12 h-12 text-white" />
                      <span className="text-2xl text-slate-400">+</span>
                      <Icon2 className="w-12 h-12 text-white" />
                      <span className="text-2xl text-slate-400">=</span>
                      <span className="text-3xl font-bold text-white">
                        {gameState.diceRoll[0] + gameState.diceRoll[1]}
                      </span>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESOURCE PANEL
// ============================================================================

interface ResourcePanelProps {
  player: Player;
}

function ResourcePanel({ player }: ResourcePanelProps) {
  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Package className="w-5 h-5 text-green-400" />
        Your Resources
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(player.resources) as [ResourceType, number][]).map(([resource, count]) => (
          <div 
            key={resource}
            className="bg-slate-700/50 rounded-lg p-2 text-center"
          >
            <div className="flex justify-center mb-1">
              {ResourceIcons[resource]}
            </div>
            <div className="text-white font-bold">{count}</div>
            <div className="text-xs text-slate-400 capitalize">{resource}</div>
          </div>
        ))}
      </div>

      {/* Building costs reference */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <h4 className="text-sm font-semibold text-slate-400 mb-2">Building Costs:</h4>
        <div className="text-xs text-slate-500 space-y-1">
          <div>🛤️ Road: 1 Wood + 1 Brick</div>
          <div>🏠 Settlement: 1 Wood + 1 Brick + 1 Sheep + 1 Wheat</div>
          <div>🏙️ City: 2 Wheat + 3 Ore</div>
          <div>📜 Dev Card: 1 Sheep + 1 Wheat + 1 Ore</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN GAME PAGE
// ============================================================================

export default function CatanGamePage() {
  const mp = useMultiplayerGame<GameState>();
  
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mp.isMultiplayer && mp.playerNames.length > 0) {
      return createInitialGameState(mp.playerNames);
    }
    return createInitialGameState(['Red', 'Blue', 'Orange', 'White']);
  });
  const [rolling, setRolling] = useState(false);
  const [buildMode, setBuildMode] = useState<'settlement' | 'city' | 'road' | null>(null);

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
        setTimeout(() => {
          setGameState(prev => performRoll(prev));
          setRolling(false);
        }, 800);
        break;

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

      case 'new-game':
        setGameState(createInitialGameState(['Red', 'Blue', 'Orange', 'White']));
        setBuildMode(null);
        break;

      default:
        break;
    }
  }, []);

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

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gradient-to-br from-blue-950 via-cyan-950 to-emerald-950">
      {/* === FULL-SCREEN 3D BOARD === */}
      <div className="absolute inset-0 z-0">
        <CatanBoard3D
          gameState={gameState}
          onHexClick={handleHexClick}
          onVertexClick={showVertexTargets ? handleVertexClick : undefined}
          onEdgeClick={showEdgeTargets ? handleEdgeClick : undefined}
        />
      </div>

      {/* === FLOATING HEADER === */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
            <Link to="/dashboard" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Settlers of Catan</h1>
              <p className="text-xs text-slate-400">Turn {gameState.turn}</p>
            </div>
          </div>

          <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-2 text-sm text-slate-300">
            <ScrollText className="w-4 h-4" />
            {gameState.developmentCardDeck.length} cards remaining
          </div>
        </div>

        {/* Build Mode / Free Roads floating banner */}
        {(buildMode || gameState.freeRoadsRemaining > 0) && (
          <div className="flex justify-center mt-1 pointer-events-auto">
            <div className={`px-6 py-2 rounded-xl text-sm font-semibold ${
              gameState.freeRoadsRemaining > 0
                ? 'bg-green-600/80 text-white border border-green-400/30'
                : 'bg-yellow-600/80 text-white border border-yellow-400/30'
            } backdrop-blur-md`}>
              {gameState.freeRoadsRemaining > 0
                ? `Road Building: Place ${gameState.freeRoadsRemaining} free road${gameState.freeRoadsRemaining > 1 ? 's' : ''}`
                : `Build Mode: Click to place a ${buildMode}`}
              {buildMode && (
                <button onClick={() => setBuildMode(null)} className="ml-3 underline opacity-80 hover:opacity-100">Cancel</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === LEFT PANEL — Players (floating) === */}
      <div className="absolute left-3 top-20 w-64 z-20 pointer-events-auto overflow-y-auto max-h-[calc(100vh-6rem)]">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3 space-y-2">
          <h2 className="text-sm font-bold text-white/80 flex items-center gap-2 px-1">
            <Users className="w-4 h-4 text-blue-400" />
            Players
          </h2>
          {gameState.players.map(player => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayer.id}
            />
          ))}
        </div>
      </div>

      {/* === RIGHT PANEL — Actions & Resources (floating) === */}
      <div className="absolute right-3 top-20 w-72 z-20 pointer-events-auto overflow-y-auto max-h-[calc(100vh-6rem)] space-y-3">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <ActionPanel 
            gameState={gameState} 
            onAction={handleAction}
            rolling={rolling}
          />
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <ResourcePanel player={currentPlayer} />
        </div>
      </div>
    </div>
  );
}
