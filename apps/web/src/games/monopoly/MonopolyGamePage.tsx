/**
 * TableForge - Monopoly Game Page
 * Complete game interface with 3D board and controls
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { 
  Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
  Home, Hotel, DollarSign, Users, Clock, 
  ArrowRight, X, Check, Gavel,
  Building2, Landmark,
  ChevronDown, ChevronUp, RotateCcw,
  Volume2, VolumeX,
  Crown, Banknote, CreditCard, ArrowLeft
} from 'lucide-react';
import MonopolyBoard3D from './MonopolyBoard3D';
import {
  type GameState,
  type Player,
  type PropertySpace,
  type RailroadSpace,
  type UtilitySpace,
  createInitialGameState,
  getCurrentPlayer,
  getSpace,
  getProperty,
  getPropertyOwner,
  calculateRent,
  canBuildHouse,
  canSellHouse,
  canMortgage,
  canUnmortgage,
  performRoll,
  buyProperty,
  declinePurchase,
  payRent,
  payJailFine,
  useGetOutOfJailCard,
  rollForJail,
  buildHouse,
  sellHouse,
  mortgageProperty,
  unmortgageProperty,
  declareBankruptcy,
  endTurn,
} from './MonopolyEngine';

// ============================================================================
// DICE ICONS
// ============================================================================

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

function DiceIcon({ value, className }: { value: number; className?: string }) {
  const Icon = DiceIcons[value - 1] || Dice1;
  return <Icon className={className} />;
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
  const [expanded, setExpanded] = useState(isCurrentPlayer);

  const playerProperties = gameState.properties.filter(p => p.ownerId === player.id);
  const totalAssets = player.money + playerProperties.reduce((sum, prop) => {
    const space = getSpace(prop.spaceId) as PropertySpace | RailroadSpace | UtilitySpace;
    return sum + (prop.isMortgaged ? 0 : space.price) + (prop.houses * 50);
  }, 0);

  return (
    <div 
      className={`rounded-lg border-2 transition-all ${
        isCurrentPlayer 
          ? 'border-yellow-400 bg-slate-800/90 shadow-lg shadow-yellow-400/20' 
          : player.isBankrupt 
            ? 'border-red-500/50 bg-slate-900/50 opacity-50'
            : 'border-slate-600 bg-slate-800/70'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: player.color }}
          >
            {player.name[0]}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{player.name}</span>
              {isCurrentPlayer && <Crown className="w-4 h-4 text-yellow-400" />}
              {player.isBankrupt && <span className="text-xs text-red-400">BANKRUPT</span>}
            </div>
            <div className="text-sm text-green-400 font-mono">${player.money.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{playerProperties.length} props</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && !player.isBankrupt && (
        <div className="px-3 pb-3 border-t border-slate-700">
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-700/50 rounded p-2">
              <span className="text-slate-400">Total Assets</span>
              <div className="text-green-400 font-mono">${totalAssets.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <span className="text-slate-400">Position</span>
              <div className="text-white">{getSpace(player.position).name}</div>
            </div>
          </div>

          {player.inJail && (
            <div className="mt-2 bg-orange-500/20 border border-orange-500/50 rounded p-2 text-xs text-orange-300">
              🔒 In Jail (Turn {player.jailTurns + 1}/3)
            </div>
          )}

          {player.getOutOfJailCards > 0 && (
            <div className="mt-2 bg-purple-500/20 border border-purple-500/50 rounded p-2 text-xs text-purple-300">
              🎫 Get Out of Jail Free x{player.getOutOfJailCards}
            </div>
          )}

          {playerProperties.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-slate-400 mb-1">Properties:</div>
              <div className="flex flex-wrap gap-1">
                {playerProperties.map(prop => {
                  const space = getSpace(prop.spaceId);
                  const colorMap: Record<string, string> = {
                    brown: 'bg-amber-800',
                    lightBlue: 'bg-sky-300',
                    pink: 'bg-pink-400',
                    orange: 'bg-orange-500',
                    red: 'bg-red-500',
                    yellow: 'bg-yellow-400',
                    green: 'bg-green-600',
                    darkBlue: 'bg-blue-800',
                    railroad: 'bg-slate-600',
                    utility: 'bg-slate-500',
                  };
                  return (
                    <div
                      key={prop.spaceId}
                      className={`px-2 py-0.5 rounded text-xs text-white ${colorMap[space.color] || 'bg-slate-600'} ${prop.isMortgaged ? 'opacity-50 line-through' : ''}`}
                      title={`${space.name}${prop.houses > 0 ? ` (${prop.houses === 5 ? 'Hotel' : `${prop.houses}H`})` : ''}`}
                    >
                      {space.name.split(' ')[0]}
                      {prop.houses > 0 && prop.houses < 5 && <span className="ml-1">🏠×{prop.houses}</span>}
                      {prop.houses === 5 && <span className="ml-1">🏨</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
  const currentSpace = getSpace(currentPlayer.position);
  const _property = getProperty(gameState, currentPlayer.position);
  void _property; // Used for future property info display
  const owner = getPropertyOwner(gameState, currentPlayer.position);

  const renderPhaseActions = () => {
    switch (gameState.phase) {
      case 'roll':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}'s turn. Roll the dice to move!
            </p>
            <button
              onClick={() => onAction('roll')}
              disabled={rolling}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              {rolling ? (
                <>
                  <div className="animate-spin">🎲</div>
                  Rolling...
                </>
              ) : (
                <>
                  <Dice6 className="w-5 h-5" />
                  Roll Dice
                </>
              )}
            </button>
          </div>
        );

      case 'jail-decision':
        return (
          <div className="space-y-3">
            <p className="text-orange-300">
              {currentPlayer.name} is in Jail! Choose an option:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onAction('roll-for-jail')}
                className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Dice6 className="w-4 h-4" />
                Roll for Doubles
              </button>
              {currentPlayer.money >= 50 && (
                <button
                  onClick={() => onAction('pay-jail-fine')}
                  className="py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  Pay $50 Fine
                </button>
              )}
              {currentPlayer.getOutOfJailCards > 0 && (
                <button
                  onClick={() => onAction('use-jail-card')}
                  className="py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Use Get Out of Jail Card
                </button>
              )}
            </div>
          </div>
        );

      case 'buy-decision':
        const buyableSpace = currentSpace as PropertySpace | RailroadSpace | UtilitySpace;
        return (
          <div className="space-y-3">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <h4 className="font-bold text-white">{currentSpace.name}</h4>
              <p className="text-2xl font-bold text-green-400">${buyableSpace.price}</p>
              {currentSpace.type === 'property' && (
                <p className="text-sm text-slate-400">
                  Rent: ${(currentSpace as PropertySpace).rent[0]}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAction('buy')}
                disabled={currentPlayer.money < buyableSpace.price}
                className="py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Buy
              </button>
              <button
                onClick={() => onAction('decline')}
                className="py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Auction
              </button>
            </div>
          </div>
        );

      case 'pay-rent':
        const rent = calculateRent(gameState, currentPlayer.position, gameState.diceRoll || undefined);
        return (
          <div className="space-y-3">
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-300">
                You landed on {owner?.name}'s property!
              </p>
              <p className="text-2xl font-bold text-red-400">Pay ${rent}</p>
            </div>
            <button
              onClick={() => onAction('pay-rent')}
              disabled={currentPlayer.money < rent}
              className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Banknote className="w-4 h-4" />
              Pay Rent
            </button>
            {currentPlayer.money < rent && (
              <button
                onClick={() => onAction('bankrupt')}
                className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
              >
                Declare Bankruptcy
              </button>
            )}
          </div>
        );

      case 'end-turn':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              {currentPlayer.name}'s turn is complete.
            </p>
            <button
              onClick={() => onAction('end-turn')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              End Turn
            </button>
          </div>
        );

      case 'bankrupt': {
        const pendingAmount = (gameState.pendingAction?.data as Record<string, unknown>)?.amount as number | undefined;
        const creditorId = (gameState.pendingAction?.data as Record<string, unknown>)?.toPlayerId as string | undefined;
        const creditor = creditorId ? gameState.players.find(p => p.id === creditorId) : null;
        const playerProps = gameState.properties.filter(p => p.ownerId === currentPlayer.id);
        const canRaiseFunds = playerProps.some(p => !p.isMortgaged || p.houses > 0);

        return (
          <div className="space-y-3">
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-300 font-bold">Insufficient Funds!</p>
              {pendingAmount && (
                <p className="text-red-400 text-sm mt-1">
                  You owe ${pendingAmount}{creditor ? ` to ${creditor.name}` : ''} but only have ${currentPlayer.money}
                </p>
              )}
            </div>

            {canRaiseFunds && (
              <p className="text-sm text-slate-400">
                Sell houses or mortgage properties below to raise funds, then try paying again.
              </p>
            )}

            {pendingAmount && currentPlayer.money >= pendingAmount && (
              <button
                onClick={() => onAction('retry-payment')}
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Pay ${pendingAmount} Now
              </button>
            )}

            <button
              onClick={() => onAction('bankrupt')}
              className="w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Declare Bankruptcy
            </button>
          </div>
        );
      }

      case 'game-over': {
        const winner = gameState.players.find(p => p.id === gameState.winner);
        return (
          <div className="space-y-3 text-center">
            <div className="text-4xl">🎉</div>
            <h3 className="text-2xl font-bold text-yellow-400">
              {winner?.name} Wins!
            </h3>
            <p className="text-slate-300">
              Final wealth: ${winner?.money.toLocaleString()}
            </p>
            <button
              onClick={() => onAction('new-game')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </button>
          </div>
        );
      }

      case 'auction':
        return (
          <div className="space-y-3">
            <p className="text-slate-300">
              Auction phase — not yet implemented. Skipping...
            </p>
            <button
              onClick={() => onAction('end-turn')}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Continue
            </button>
          </div>
        );

      default:
        return (
          <div className="space-y-3">
            <p className="text-slate-400">
              Phase: {gameState.phase}
            </p>
            <button
              onClick={() => onAction('end-turn')}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Continue
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Gavel className="w-5 h-5 text-purple-400" />
        Actions
      </h3>
      {renderPhaseActions()}

      {/* Dice display */}
      {gameState.diceRoll && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-center gap-4">
            <DiceIcon value={gameState.diceRoll[0]} className="w-12 h-12 text-white" />
            <span className="text-2xl text-slate-400">+</span>
            <DiceIcon value={gameState.diceRoll[1]} className="w-12 h-12 text-white" />
            <span className="text-2xl text-slate-400">=</span>
            <span className="text-3xl font-bold text-white">
              {gameState.diceRoll[0] + gameState.diceRoll[1]}
            </span>
          </div>
          {gameState.diceRoll[0] === gameState.diceRoll[1] && (
            <p className="text-center text-yellow-400 mt-2">🎯 Doubles!</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROPERTY MANAGEMENT PANEL
// ============================================================================

interface PropertyManagementProps {
  gameState: GameState;
  playerId: string;
  onAction: (action: string, data?: unknown) => void;
}

function PropertyManagement({ gameState, playerId, onAction }: PropertyManagementProps) {
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const playerProperties = gameState.properties.filter(p => p.ownerId === playerId);

  if (playerProperties.length === 0) {
    return (
      <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Properties
        </h3>
        <p className="text-slate-400 text-sm">No properties owned yet.</p>
      </div>
    );
  }

  const selectedProp = selectedProperty !== null 
    ? gameState.properties.find(p => p.spaceId === selectedProperty)
    : null;
  const selectedSpace = selectedProperty !== null 
    ? getSpace(selectedProperty) as PropertySpace
    : null;

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-400" />
        Manage Properties
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {playerProperties.map(prop => {
          const space = getSpace(prop.spaceId);
          const colorMap: Record<string, string> = {
            brown: 'bg-amber-800 hover:bg-amber-700',
            lightBlue: 'bg-sky-400 hover:bg-sky-300',
            pink: 'bg-pink-500 hover:bg-pink-400',
            orange: 'bg-orange-500 hover:bg-orange-400',
            red: 'bg-red-500 hover:bg-red-400',
            yellow: 'bg-yellow-500 hover:bg-yellow-400',
            green: 'bg-green-600 hover:bg-green-500',
            darkBlue: 'bg-blue-800 hover:bg-blue-700',
            railroad: 'bg-slate-600 hover:bg-slate-500',
            utility: 'bg-slate-500 hover:bg-slate-400',
          };
          return (
            <button
              key={prop.spaceId}
              onClick={() => setSelectedProperty(prop.spaceId === selectedProperty ? null : prop.spaceId)}
              className={`p-2 rounded text-xs text-white transition-all ${
                colorMap[space.color] || 'bg-slate-600'
              } ${prop.spaceId === selectedProperty ? 'ring-2 ring-white' : ''} ${
                prop.isMortgaged ? 'opacity-50' : ''
              }`}
            >
              <div className="font-semibold truncate">{space.name}</div>
              {prop.houses > 0 && (
                <div className="text-[10px] mt-0.5">
                  {prop.houses === 5 ? '🏨 Hotel' : `🏠 ×${prop.houses}`}
                </div>
              )}
              {prop.isMortgaged && <div className="text-[10px] text-red-300">Mortgaged</div>}
            </button>
          );
        })}
      </div>

      {selectedProp && selectedSpace && (
        <div className="border-t border-slate-700 pt-3 space-y-2">
          <h4 className="font-semibold text-white">{selectedSpace.name}</h4>
          
          {selectedSpace.type === 'property' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAction('build', selectedProperty)}
                disabled={!canBuildHouse(gameState, playerId, selectedProperty!)}
                className="py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded flex items-center justify-center gap-1"
              >
                <Home className="w-3 h-3" />
                Build (${selectedSpace.houseCost})
              </button>
              <button
                onClick={() => onAction('sell-house', selectedProperty)}
                disabled={!canSellHouse(gameState, playerId, selectedProperty!)}
                className="py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded flex items-center justify-center gap-1"
              >
                <Home className="w-3 h-3" />
                Sell (+${Math.floor(selectedSpace.houseCost / 2)})
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!selectedProp.isMortgaged ? (
              <button
                onClick={() => onAction('mortgage', selectedProperty)}
                disabled={!canMortgage(gameState, playerId, selectedProperty!) || selectedProp.houses > 0}
                className="py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded flex items-center justify-center gap-1"
              >
                <Landmark className="w-3 h-3" />
                Mortgage (+${selectedSpace.mortgageValue})
              </button>
            ) : (
              <button
                onClick={() => onAction('unmortgage', selectedProperty)}
                disabled={!canUnmortgage(gameState, playerId, selectedProperty!)}
                className="py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded flex items-center justify-center gap-1"
              >
                <Landmark className="w-3 h-3" />
                Unmortgage (-${Math.floor(selectedSpace.mortgageValue * 1.1)})
              </button>
            )}
          </div>
        </div>
      )}
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
  const recentLogs = gameState.log.slice(-10).reverse();

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 max-h-60 overflow-hidden">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5 text-green-400" />
        Game Log
      </h3>
      <div className="space-y-1 overflow-y-auto max-h-40">
        {recentLogs.map(log => (
          <div key={log.id} className="text-xs text-slate-300 py-1 border-b border-slate-700/50">
            <span className="text-slate-500">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {' '}
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

export default function MonopolyGamePage() {
  const mp = useMultiplayerGame<GameState>();
  
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mp.isMultiplayer && mp.playerNames.length > 0) {
      return createInitialGameState(mp.playerNames);
    }
    return createInitialGameState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  });
  const [rolling, setRolling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

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
        }, 1000);
        break;

      case 'roll-for-jail':
        setRolling(true);
        setTimeout(() => {
          const player = getCurrentPlayer(gameState);
          setGameState(prev => rollForJail(prev, player.id));
          setRolling(false);
        }, 1000);
        break;

      case 'pay-jail-fine':
        setGameState(prev => payJailFine(prev, getCurrentPlayer(prev).id));
        break;

      case 'use-jail-card':
        setGameState(prev => useGetOutOfJailCard(prev, getCurrentPlayer(prev).id));
        break;

      case 'buy':
        setGameState(prev => buyProperty(prev, getCurrentPlayer(prev).id));
        break;

      case 'decline':
        setGameState(prev => declinePurchase(prev));
        // For now, skip auction and just end turn
        setTimeout(() => {
          setGameState(prev => endTurn(prev));
        }, 100);
        break;

      case 'pay-rent':
        setGameState(prev => payRent(prev, getCurrentPlayer(prev).id));
        break;

      case 'end-turn':
        setGameState(prev => endTurn(prev));
        break;

      case 'build':
        if (typeof data === 'number') {
          setGameState(prev => buildHouse(prev, getCurrentPlayer(prev).id, data));
        }
        break;

      case 'sell-house':
        if (typeof data === 'number') {
          setGameState(prev => sellHouse(prev, getCurrentPlayer(prev).id, data));
        }
        break;

      case 'mortgage':
        if (typeof data === 'number') {
          setGameState(prev => mortgageProperty(prev, getCurrentPlayer(prev).id, data));
        }
        break;

      case 'unmortgage':
        if (typeof data === 'number') {
          setGameState(prev => unmortgageProperty(prev, getCurrentPlayer(prev).id, data));
        }
        break;

      case 'retry-payment': {
        // Player raised enough funds during bankrupt phase - retry the pending payment
        setGameState(prev => {
          const pending = prev.pendingAction;
          if (!pending) return { ...prev, phase: 'end-turn' };
          
          const player = getCurrentPlayer(prev);
          const amount = (pending.data as Record<string, unknown>).amount as number;
          const toPlayerId = (pending.data as Record<string, unknown>).toPlayerId as string | undefined;
          
          if (player.money >= amount) {
            const playerIndex = prev.players.findIndex(p => p.id === player.id);
            const updatedPlayers = [...prev.players];
            updatedPlayers[playerIndex] = { ...player, money: player.money - amount };
            
            if (toPlayerId) {
              const creditorIndex = updatedPlayers.findIndex(p => p.id === toPlayerId);
              updatedPlayers[creditorIndex] = {
                ...updatedPlayers[creditorIndex],
                money: updatedPlayers[creditorIndex].money + amount,
              };
            }
            
            return { ...prev, players: updatedPlayers, phase: 'end-turn', pendingAction: null };
          }
          return prev;
        });
        break;
      }

      case 'bankrupt':
        setGameState(prev => {
          const creditorId = (prev.pendingAction?.data as Record<string, unknown>)?.toPlayerId as string | undefined;
          return declareBankruptcy(prev, getCurrentPlayer(prev).id, creditorId);
        });
        break;

      case 'new-game':
        setGameState(createInitialGameState(['Player 1', 'Player 2', 'Player 3', 'Player 4']));
        break;
    }
  }, [gameState]);

  const currentPlayer = getCurrentPlayer(gameState);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-black">
      {/* === FULL-SCREEN 3D BOARD === */}
      <div className="absolute inset-0 z-0">
        <MonopolyBoard3D 
          gameState={gameState} 
          rolling={rolling}
        />
      </div>

      {/* === FLOATING HEADER === */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
            <Link to="/dashboard" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Monopoly</h1>
              <p className="text-xs text-slate-400">Turn {gameState.turnNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-400"><Home className="w-3.5 h-3.5" />{gameState.houses}</span>
              <span className="flex items-center gap-1 text-red-400"><Hotel className="w-3.5 h-3.5" />{gameState.hotels}</span>
            </div>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* === LEFT PANEL — Players (floating) === */}
      <div className="absolute left-3 top-16 bottom-3 w-72 z-20 pointer-events-auto overflow-y-auto">
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
              gameState={gameState}
            />
          ))}
        </div>
      </div>

      {/* === RIGHT PANEL — Actions & Properties (floating) === */}
      <div className="absolute right-3 top-16 bottom-3 w-80 z-20 pointer-events-auto overflow-y-auto space-y-3">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <ActionPanel 
            gameState={gameState} 
            onAction={handleAction}
            rolling={rolling}
          />
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <PropertyManagement
            gameState={gameState}
            playerId={currentPlayer.id}
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
