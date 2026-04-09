/**
 * TableForge - Risk Game Page
 * Complete game interface with world map
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import {
  Swords, Shield, Users, Globe, ArrowRight,
  Crown, Move, SkipForward, ArrowLeft, RotateCcw
} from 'lucide-react';
import RiskBoard3D from './RiskBoard3D';
import {
  type GameState,
  type Player,
  createInitialGameState,
  getCurrentPlayer,
  getTerritory,
  getPlayerTerritories,
  canAttack,
  canFortify,
  placeArmies,
  attack,
  endAttackPhase,
  fortify,
  skipFortify,
  CONTINENTS,
} from './RiskEngine';

// ============================================================================
// WORLD MAP COMPONENT
// ============================================================================

interface WorldMapProps {
  gameState: GameState;
  selectedTerritory: string | null;
  onTerritoryClick: (territoryId: string) => void;
}

export function _WorldMap({ gameState, selectedTerritory, onTerritoryClick }: WorldMapProps) {
  const getPlayerColor = (playerId: string | null) => {
    if (!playerId) return '#666';
    const player = gameState.players.find(p => p.id === playerId);
    return player?.color || '#666';
  };

  return (
    <svg viewBox="0 0 800 520" className="w-full h-full">
      {/* Ocean background */}
      <rect width="800" height="520" fill="#1a365d" />
      
      {/* Continent backgrounds */}
      {CONTINENTS.map(continent => {
        const territories = gameState.territories.filter(t => t.continent === continent.id);
        const minX = Math.min(...territories.map(t => t.position.x)) - 30;
        const minY = Math.min(...territories.map(t => t.position.y)) - 30;
        const maxX = Math.max(...territories.map(t => t.position.x)) + 30;
        const maxY = Math.max(...territories.map(t => t.position.y)) + 30;
        
        return (
          <rect
            key={continent.id}
            x={minX}
            y={minY}
            width={maxX - minX}
            height={maxY - minY}
            fill={continent.color}
            opacity={0.15}
            rx={10}
          />
        );
      })}

      {/* Connection lines */}
      {gameState.territories.map(territory => 
        territory.neighbors.map(neighborId => {
          const neighbor = getTerritory(gameState, neighborId);
          if (!neighbor || territory.id > neighborId) return null;
          
          // Handle wrap-around connections (Alaska-Kamchatka)
          let x2 = neighbor.position.x;
          if (Math.abs(territory.position.x - neighbor.position.x) > 400) {
            x2 = territory.position.x > 400 ? neighbor.position.x + 800 : neighbor.position.x - 800;
          }
          
          return (
            <line
              key={`${territory.id}-${neighborId}`}
              x1={territory.position.x}
              y1={territory.position.y}
              x2={x2}
              y2={neighbor.position.y}
              stroke="#4a5568"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity={0.5}
            />
          );
        })
      )}

      {/* Territories */}
      {gameState.territories.map(territory => {
        const isSelected = selectedTerritory === territory.id;
        const isAttackTarget = gameState.attackingTo === territory.id;
        const isAttackSource = gameState.attackingFrom === territory.id;
        
        return (
          <g 
            key={territory.id} 
            onClick={() => onTerritoryClick(territory.id)}
            className="cursor-pointer"
          >
            {/* Territory circle */}
            <circle
              cx={territory.position.x}
              cy={territory.position.y}
              r={isSelected ? 22 : 18}
              fill={getPlayerColor(territory.ownerId)}
              stroke={isSelected ? '#fff' : isAttackTarget ? '#ff0' : isAttackSource ? '#f00' : '#000'}
              strokeWidth={isSelected || isAttackTarget || isAttackSource ? 3 : 1}
              className="transition-all duration-200"
            />
            
            {/* Army count */}
            <text
              x={territory.position.x}
              y={territory.position.y + 5}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fill="#fff"
              className="pointer-events-none"
            >
              {territory.armies}
            </text>
            
            {/* Territory name (on hover) */}
            <title>{territory.name} ({territory.armies} armies)</title>
          </g>
        );
      })}

      {/* Continent labels */}
      {CONTINENTS.map(continent => {
        const territories = gameState.territories.filter(t => t.continent === continent.id);
        const avgX = territories.reduce((sum, t) => sum + t.position.x, 0) / territories.length;
        const avgY = territories.reduce((sum, t) => sum + t.position.y, 0) / territories.length;
        
        return (
          <text
            key={`label-${continent.id}`}
            x={avgX}
            y={avgY - 40}
            textAnchor="middle"
            fontSize="10"
            fill={continent.color}
            fontWeight="bold"
            opacity={0.8}
          >
            {continent.name} (+{continent.bonus})
          </text>
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
  gameState: GameState;
}

function PlayerPanel({ player, isCurrentPlayer, gameState }: PlayerPanelProps) {
  const territories = getPlayerTerritories(gameState, player.id);
  const continentsOwned = CONTINENTS.filter(c => {
    const continentTerritories = gameState.territories.filter(t => t.continent === c.id);
    return continentTerritories.every(t => t.ownerId === player.id);
  });

  return (
    <div 
      className={`rounded-lg border-2 p-3 transition-all ${
        isCurrentPlayer 
          ? 'border-yellow-400 bg-slate-800/90 shadow-lg shadow-yellow-400/20' 
          : player.isEliminated 
            ? 'border-red-500/50 bg-slate-900/50 opacity-50'
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
            {player.isEliminated && <span className="text-xs text-red-400">ELIMINATED</span>}
          </div>
        </div>
      </div>

      {!player.isEliminated && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-700/50 rounded p-2">
            <span className="text-slate-400">Territories</span>
            <div className="text-white font-bold">{territories.length}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <span className="text-slate-400">Armies</span>
            <div className="text-white font-bold">
              {territories.reduce((sum, t) => sum + t.armies, 0)}
            </div>
          </div>
        </div>
      )}

      {continentsOwned.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {continentsOwned.map(c => (
            <span 
              key={c.id}
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: c.color, color: '#fff' }}
            >
              {c.name}
            </span>
          ))}
        </div>
      )}

      {player.cards.length > 0 && (
        <div className="mt-2 text-xs text-slate-400">
          🃏 {player.cards.length} cards
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
  selectedTerritory: string | null;
  onAction: (action: string, data?: unknown) => void;
}

function ActionPanel({ gameState, selectedTerritory, onAction }: ActionPanelProps) {
  const currentPlayer = getCurrentPlayer(gameState);
  const [attackDice, setAttackDice] = useState(3);
  const [fortifyAmount, setFortifyAmount] = useState(1);

  const selectedTerr = selectedTerritory ? getTerritory(gameState, selectedTerritory) : null;

  const renderPhaseActions = () => {
    switch (gameState.phase) {
      case 'reinforce':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Reinforcements:</span>
              <span className="text-2xl font-bold text-green-400">{gameState.reinforcements}</span>
            </div>
            
            {selectedTerr && selectedTerr.ownerId === currentPlayer.id && (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Place armies in <span className="text-white font-semibold">{selectedTerr.name}</span>
                </p>
                <div className="flex gap-2">
                  {[1, 3, 5, gameState.reinforcements].filter((n, i, arr) => 
                    n <= gameState.reinforcements && arr.indexOf(n) === i
                  ).map(n => (
                    <button
                      key={n}
                      onClick={() => onAction('place', { territoryId: selectedTerritory, count: n })}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {!selectedTerr && (
              <p className="text-sm text-slate-400">
                Select one of your territories to place armies
              </p>
            )}
          </div>
        );

      case 'attack':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              Attack enemy territories or end attack phase
            </p>
            
            {gameState.attackingFrom && gameState.attackingTo && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                <p className="text-sm text-red-300 mb-2">
                  Attacking from <span className="font-bold">{getTerritory(gameState, gameState.attackingFrom)?.name}</span>
                  {' → '}
                  <span className="font-bold">{getTerritory(gameState, gameState.attackingTo)?.name}</span>
                </p>
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">Dice:</span>
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => setAttackDice(n)}
                      disabled={n > (gameState.attackingFrom ? (getTerritory(gameState, gameState.attackingFrom)?.armies || 1) : 1) - 1}
                      className={`w-8 h-8 rounded ${
                        attackDice === n ? 'bg-red-600' : 'bg-slate-700'
                      } text-white font-bold disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => onAction('attack', { dice: attackDice })}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Swords className="w-4 h-4" />
                  Attack!
                </button>
              </div>
            )}
            
            {gameState.lastDiceRoll && (
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-400">Attacker: {gameState.lastDiceRoll.attacker.join(', ')}</span>
                  <span className="text-blue-400">Defender: {gameState.lastDiceRoll.defender.join(', ')}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Losses: Attacker -{gameState.lastDiceRoll.attackerLosses}, Defender -{gameState.lastDiceRoll.defenderLosses}
                </div>
              </div>
            )}
            
            <button
              onClick={() => onAction('end-attack')}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              End Attack Phase
            </button>
          </div>
        );

      case 'fortify':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              Move armies between connected territories (optional)
            </p>
            
            {gameState.attackingFrom && gameState.attackingTo && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3">
                <p className="text-sm text-blue-300 mb-2">
                  Move from <span className="font-bold">{getTerritory(gameState, gameState.attackingFrom)?.name}</span>
                  {' → '}
                  <span className="font-bold">{getTerritory(gameState, gameState.attackingTo)?.name}</span>
                </p>
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">Armies:</span>
                  <input
                    type="range"
                    min={1}
                    max={(getTerritory(gameState, gameState.attackingFrom)?.armies || 2) - 1}
                    value={fortifyAmount}
                    onChange={(e) => setFortifyAmount(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white font-bold w-8">{fortifyAmount}</span>
                </div>
                
                <button
                  onClick={() => onAction('fortify', { count: fortifyAmount })}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Move className="w-4 h-4" />
                  Move Armies
                </button>
              </div>
            )}
            
            <button
              onClick={() => onAction('skip-fortify')}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              End Turn
            </button>
          </div>
        );

      case 'game-over': {
        const winner = gameState.players.find(p => p.id === gameState.winner);
        return (
          <div className="space-y-3 text-center">
            <div className="text-4xl">🏆</div>
            <h3 className="text-2xl font-bold text-yellow-400">
              {winner?.name} Conquers the World!
            </h3>
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
        {gameState.phase === 'reinforce' && <Shield className="w-5 h-5 text-green-400" />}
        {gameState.phase === 'attack' && <Swords className="w-5 h-5 text-red-400" />}
        {gameState.phase === 'fortify' && <Move className="w-5 h-5 text-blue-400" />}
        {gameState.phase.charAt(0).toUpperCase() + gameState.phase.slice(1)} Phase
      </h3>
      {renderPhaseActions()}
    </div>
  );
}

// ============================================================================
// GAME LOG
// ============================================================================

interface GameLogProps {
  gameState: GameState;
}

function GameLog({ gameState }: GameLogProps) {
  const recentLogs = gameState.log.slice(-8).reverse();

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 max-h-48 overflow-hidden">
      <h3 className="text-sm font-bold text-slate-400 mb-2">Battle Log</h3>
      <div className="space-y-1 overflow-y-auto max-h-36">
        {recentLogs.map(log => (
          <div key={log.id} className="text-xs text-slate-300 py-1 border-b border-slate-700/50">
            {log.message}
          </div>
        ))}
        {recentLogs.length === 0 && (
          <p className="text-slate-500 text-sm">No events yet.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN GAME PAGE
// ============================================================================

export default function RiskGamePage() {
  const mp = useMultiplayerGame<GameState>();
  
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mp.isMultiplayer && mp.playerNames.length > 0) {
      return createInitialGameState(mp.playerNames);
    }
    return createInitialGameState(['Red Empire', 'Blue Legion', 'Green Horde', 'Yellow Dynasty']);
  });
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

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

  const handleTerritoryClick = useCallback((territoryId: string) => {
    const territory = getTerritory(gameState, territoryId);
    const currentPlayer = getCurrentPlayer(gameState);
    
    if (gameState.phase === 'reinforce') {
      if (territory?.ownerId === currentPlayer.id) {
        setSelectedTerritory(territoryId);
      }
    } else if (gameState.phase === 'attack') {
      if (!gameState.attackingFrom) {
        // Select attacking territory
        if (territory?.ownerId === currentPlayer.id && territory.armies > 1) {
          setGameState(prev => ({ ...prev, attackingFrom: territoryId }));
        }
      } else if (!gameState.attackingTo) {
        // Select target territory
        if (canAttack(gameState, gameState.attackingFrom, territoryId)) {
          setGameState(prev => ({ ...prev, attackingTo: territoryId }));
        } else if (territory?.ownerId === currentPlayer.id) {
          // Change attacking territory
          setGameState(prev => ({ ...prev, attackingFrom: territoryId, attackingTo: null }));
        }
      } else {
        // Reset selection
        setGameState(prev => ({ ...prev, attackingFrom: territoryId, attackingTo: null }));
      }
    } else if (gameState.phase === 'fortify') {
      if (!gameState.attackingFrom) {
        if (territory?.ownerId === currentPlayer.id && territory.armies > 1) {
          setGameState(prev => ({ ...prev, attackingFrom: territoryId }));
        }
      } else if (!gameState.attackingTo) {
        if (canFortify(gameState, gameState.attackingFrom, territoryId)) {
          setGameState(prev => ({ ...prev, attackingTo: territoryId }));
        } else if (territory?.ownerId === currentPlayer.id) {
          setGameState(prev => ({ ...prev, attackingFrom: territoryId, attackingTo: null }));
        }
      }
    }
  }, [gameState]);

  const handleAction = useCallback((action: string, data?: unknown) => {
    const d = data as Record<string, unknown> | undefined;
    
    switch (action) {
      case 'place':
        if (d?.territoryId && d?.count) {
          setGameState(prev => placeArmies(prev, d.territoryId as string, d.count as number));
          setSelectedTerritory(null);
        }
        break;

      case 'attack':
        if (gameState.attackingFrom && gameState.attackingTo && d?.dice) {
          setGameState(prev => attack(prev, prev.attackingFrom!, prev.attackingTo!, d.dice as number));
        }
        break;

      case 'end-attack':
        setGameState(prev => endAttackPhase(prev));
        break;

      case 'fortify':
        if (gameState.attackingFrom && gameState.attackingTo && d?.count) {
          setGameState(prev => fortify(prev, prev.attackingFrom!, prev.attackingTo!, d.count as number));
        }
        break;

      case 'skip-fortify':
        setGameState(prev => skipFortify(prev));
        break;

      case 'new-game':
        setGameState(createInitialGameState(['Red Empire', 'Blue Legion', 'Green Horde', 'Yellow Dynasty']));
        setSelectedTerritory(null);
        break;
    }
  }, [gameState]);

  const currentPlayer = getCurrentPlayer(gameState);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-black">
      {/* === FULL-SCREEN 3D MAP BACKGROUND === */}
      <div className="absolute inset-0 z-0">
        <RiskBoard3D
          gameState={gameState}
          selectedTerritory={selectedTerritory}
          onTerritoryClick={handleTerritoryClick}
        />
      </div>

      {/* === FLOATING HEADER BAR === */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
            <Link to="/dashboard" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Risk: World Domination</h1>
              <p className="text-xs text-slate-400">Turn {gameState.turn}</p>
            </div>
          </div>

          <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-white/50" style={{ backgroundColor: currentPlayer.color }} />
            <span className="text-white font-semibold text-sm">{currentPlayer.name}'s Turn</span>
          </div>
        </div>
      </div>

      {/* === LEFT PANEL — Players (floating) === */}
      <div className="absolute left-3 top-16 bottom-3 w-72 z-20 pointer-events-auto overflow-y-auto">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3 space-y-2">
          <h2 className="text-sm font-bold text-white/80 flex items-center gap-2 px-1">
            <Users className="w-4 h-4 text-blue-400" />
            Empires
          </h2>
          {gameState.players.map(player => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayer.id}
              gameState={gameState}
            />
          ))}
        </div>
      </div>

      {/* === RIGHT PANEL — Actions & Log (floating) === */}
      <div className="absolute right-3 top-16 bottom-3 w-80 z-20 pointer-events-auto overflow-y-auto space-y-3">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <ActionPanel 
            gameState={gameState}
            selectedTerritory={selectedTerritory}
            onAction={handleAction}
          />
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <GameLog gameState={gameState} />
        </div>
      </div>
    </div>
  );
}
