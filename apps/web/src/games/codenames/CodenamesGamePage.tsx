/**
 * TableForge - Codenames Game Page
 * Complete game interface with team-based word guessing
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { 
  Users, Eye, EyeOff, MessageSquare, 
  SkipForward, Trophy, Skull, User,
  Hash, ArrowLeft
} from 'lucide-react';
import {
  type GameState,
  type Team,
  type WordCard,
  createInitialGameState,
  getSpymaster,
  getRemainingCards,
  giveClue,
  makeGuess,
  passTurn,
} from './CodenamesEngine';

// ============================================================================
// CARD COMPONENT
// ============================================================================

interface CardProps {
  card: WordCard;
  isSpymaster: boolean;
  isCurrentTeamTurn: boolean;
  canGuess: boolean;
  onGuess: (cardId: number) => void;
}

function Card({ card, isSpymaster, canGuess, onGuess }: CardProps) {
  const getCardColor = () => {
    if (card.isRevealed) {
      switch (card.type) {
        case 'red': return 'bg-red-600 text-white';
        case 'blue': return 'bg-blue-600 text-white';
        case 'neutral': return 'bg-amber-200 text-amber-900';
        case 'assassin': return 'bg-slate-900 text-white';
      }
    }
    
    if (isSpymaster) {
      switch (card.type) {
        case 'red': return 'bg-red-100 border-red-400 text-red-800';
        case 'blue': return 'bg-blue-100 border-blue-400 text-blue-800';
        case 'neutral': return 'bg-amber-50 border-amber-300 text-amber-700';
        case 'assassin': return 'bg-slate-200 border-slate-500 text-slate-800';
      }
    }
    
    return 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200';
  };

  const getIcon = () => {
    if (!card.isRevealed) return null;
    switch (card.type) {
      case 'red': return <User className="w-5 h-5" />;
      case 'blue': return <User className="w-5 h-5" />;
      case 'assassin': return <Skull className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <button
      onClick={() => canGuess && !card.isRevealed && onGuess(card.id)}
      disabled={!canGuess || card.isRevealed}
      className={`
        relative p-3 rounded-lg border-2 font-bold text-sm uppercase tracking-wide
        transition-all duration-200 min-h-[70px] flex items-center justify-center
        ${getCardColor()}
        ${canGuess && !card.isRevealed ? 'cursor-pointer transform hover:scale-105 shadow-md' : ''}
        ${card.isRevealed ? 'opacity-90' : ''}
      `}
    >
      <span className="text-center leading-tight">{card.word}</span>
      {card.isRevealed && (
        <div className="absolute top-1 right-1">
          {getIcon()}
        </div>
      )}
      {isSpymaster && !card.isRevealed && card.type === 'assassin' && (
        <div className="absolute top-1 right-1">
          <Skull className="w-4 h-4 text-slate-600" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// TEAM PANEL
// ============================================================================

interface TeamPanelProps {
  team: Team;
  gameState: GameState;
  isCurrentTurn: boolean;
}

function TeamPanel({ team, gameState, isCurrentTurn }: TeamPanelProps) {
  const spymaster = getSpymaster(gameState, team);
  const remaining = getRemainingCards(gameState, team);
  const total = team === 'red' ? gameState.redTotal : gameState.blueTotal;
  const score = team === 'red' ? gameState.redScore : gameState.blueScore;

  const bgColor = team === 'red' ? 'bg-red-900/50' : 'bg-blue-900/50';
  const borderColor = team === 'red' ? 'border-red-500' : 'border-blue-500';
  const textColor = team === 'red' ? 'text-red-400' : 'text-blue-400';

  return (
    <div className={`rounded-xl p-4 border-2 ${bgColor} ${borderColor} ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-bold uppercase ${textColor}`}>
          {team} Team
        </h3>
        {isCurrentTurn && (
          <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold animate-pulse">
            TURN
          </span>
        )}
      </div>

      <div className="text-center mb-3">
        <div className={`text-4xl font-bold ${textColor}`}>
          {score} / {total}
        </div>
        <div className="text-sm text-slate-400">
          {remaining} remaining
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-purple-400" />
          <span className="text-slate-300">Spymaster:</span>
          <span className="text-white font-semibold">{spymaster?.name || 'None'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-green-400" />
          <span className="text-slate-300">Operatives:</span>
          <span className="text-white font-semibold">
            {gameState.players.filter(p => p.team === team && p.role === 'operative').map(p => p.name).join(', ') || 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CLUE INPUT
// ============================================================================

interface ClueInputProps {
  onSubmit: (word: string, number: number) => void;
  team: Team;
}

function ClueInput({ onSubmit, team }: ClueInputProps) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim()) {
      onSubmit(word.trim(), number);
      setWord('');
      setNumber(1);
    }
  };

  const bgColor = team === 'red' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Clue Word</label>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value.toUpperCase())}
          placeholder="Enter one word..."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Number of Cards</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setNumber(n)}
              className={`w-8 h-8 rounded-lg font-bold transition-all ${
                number === n 
                  ? `${bgColor} text-white` 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={!word.trim()}
        className={`w-full py-2 ${bgColor} disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2`}
      >
        <MessageSquare className="w-4 h-4" />
        Give Clue
      </button>
    </form>
  );
}

// ============================================================================
// CURRENT CLUE DISPLAY
// ============================================================================

interface CurrentClueProps {
  clue: { word: string; number: number; guessesRemaining: number };
  team: Team;
  onPass: () => void;
}

function CurrentClue({ clue, team, onPass }: CurrentClueProps) {
  const bgColor = team === 'red' ? 'bg-red-900/50 border-red-500' : 'bg-blue-900/50 border-blue-500';
  const textColor = team === 'red' ? 'text-red-400' : 'text-blue-400';

  return (
    <div className={`rounded-xl p-4 border-2 ${bgColor}`}>
      <div className="text-center">
        <div className="text-sm text-slate-400 mb-1">Current Clue</div>
        <div className={`text-3xl font-bold ${textColor} mb-1`}>
          "{clue.word}"
        </div>
        <div className="flex items-center justify-center gap-2 text-lg">
          <Hash className="w-5 h-5 text-slate-400" />
          <span className="text-white font-bold">{clue.number}</span>
          <span className="text-slate-400">
            ({clue.guessesRemaining} guesses left)
          </span>
        </div>
      </div>
      <button
        onClick={onPass}
        className="w-full mt-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center justify-center gap-2"
      >
        <SkipForward className="w-4 h-4" />
        End Guessing
      </button>
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
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 max-h-48 overflow-hidden">
      <h3 className="text-sm font-bold text-slate-400 mb-2">Game Log</h3>
      <div className="space-y-1 overflow-y-auto max-h-36">
        {recentLogs.map(log => (
          <div 
            key={log.id} 
            className={`text-xs py-1 border-b border-slate-700/50 ${
              log.team === 'red' ? 'text-red-300' : 'text-blue-300'
            }`}
          >
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

export default function CodenamesGamePage() {
  const mp = useMultiplayerGame<GameState>();
  
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mp.isMultiplayer && mp.playerNames.length > 0) {
      return createInitialGameState(mp.playerNames);
    }
    return createInitialGameState(['Alice', 'Bob', 'Charlie', 'Diana']);
  });
  const [isSpymasterView, setIsSpymasterView] = useState(false);

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

  const handleGiveClue = useCallback((word: string, number: number) => {
    setGameState(prev => giveClue(prev, word, number));
  }, []);

  const handleGuess = useCallback((cardId: number) => {
    setGameState(prev => makeGuess(prev, cardId));
  }, []);

  const handlePass = useCallback(() => {
    setGameState(prev => passTurn(prev));
  }, []);

  const handleNewGame = useCallback(() => {
    setGameState(createInitialGameState(['Alice', 'Bob', 'Charlie', 'Diana']));
  }, []);

  const canGuess = gameState.phase === 'guess' && !isSpymasterView;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950">
      {/* === FLOATING HEADER === */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3 pointer-events-auto bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
            <Link to="/dashboard" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Codenames</h1>
              <p className="text-xs text-slate-400">{gameState.startingTeam === 'red' ? 'Red' : 'Blue'} starts</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setIsSpymasterView(!isSpymasterView)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all backdrop-blur-md border border-white/10 ${
                isSpymasterView ? 'bg-purple-600/80 text-white' : 'bg-black/50 text-slate-300 hover:bg-black/70'
              }`}
            >
              {isSpymasterView ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {isSpymasterView ? 'Spymaster' : 'Operative'}
            </button>
            {gameState.phase === 'game-over' && (
              <button onClick={handleNewGame} className="px-4 py-1.5 bg-green-600/80 hover:bg-green-500 text-white rounded-lg font-semibold backdrop-blur-md">
                New Game
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === WINNER BANNER (floating center) === */}
      {gameState.winner && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className={`px-8 py-3 rounded-2xl flex items-center gap-3 ${
            gameState.winner === 'red' ? 'bg-red-600/90' : 'bg-blue-600/90'
          } backdrop-blur-md border border-white/20 shadow-2xl`}>
            <Trophy className="w-7 h-7 text-yellow-300" />
            <span className="text-xl font-bold text-white uppercase">{gameState.winner} Team Wins!</span>
            <Trophy className="w-7 h-7 text-yellow-300" />
          </div>
        </div>
      )}

      {/* === LEFT PANEL — Red Team (floating) === */}
      <div className="absolute left-3 top-16 w-64 z-20 pointer-events-auto space-y-3 max-h-[calc(100vh-5rem)] overflow-y-auto">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-red-500/20 p-3">
          <TeamPanel team="red" gameState={gameState} isCurrentTurn={gameState.currentTeam === 'red'} />
        </div>
        {gameState.phase === 'give-clue' && gameState.currentTeam === 'red' && isSpymasterView && (
          <div className="bg-black/50 backdrop-blur-md rounded-xl border border-red-500/20 p-3">
            <h3 className="text-sm font-bold text-red-400 mb-2">Give Clue</h3>
            <ClueInput onSubmit={handleGiveClue} team="red" />
          </div>
        )}
      </div>

      {/* === CENTER — Card Grid (fills main area) === */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-72 py-20">
        {/* Current Clue */}
        {gameState.currentClue && (
          <div className="mb-4 w-full max-w-3xl">
            <CurrentClue clue={gameState.currentClue} team={gameState.currentTeam} onPass={handlePass} />
          </div>
        )}

        {/* Card Grid — large and centered */}
        <div className="grid grid-cols-5 gap-3 w-full max-w-3xl">
          {gameState.cards.map(card => (
            <Card key={card.id} card={card} isSpymaster={isSpymasterView} isCurrentTeamTurn={true} canGuess={canGuess} onGuess={handleGuess} />
          ))}
        </div>

        {/* Phase indicator */}
        {gameState.phase !== 'game-over' && (
          <div className="mt-4 text-center text-slate-400 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
            {gameState.phase === 'give-clue' && (
              <span>Waiting for <span className={gameState.currentTeam === 'red' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>{gameState.currentTeam.toUpperCase()}</span> spymaster to give a clue...</span>
            )}
            {gameState.phase === 'guess' && (
              <span><span className={gameState.currentTeam === 'red' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>{gameState.currentTeam.toUpperCase()}</span> team is guessing...</span>
            )}
          </div>
        )}
      </div>

      {/* === RIGHT PANEL — Blue Team (floating) === */}
      <div className="absolute right-3 top-16 w-64 z-20 pointer-events-auto space-y-3 max-h-[calc(100vh-5rem)] overflow-y-auto">
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-blue-500/20 p-3">
          <TeamPanel team="blue" gameState={gameState} isCurrentTurn={gameState.currentTeam === 'blue'} />
        </div>
        {gameState.phase === 'give-clue' && gameState.currentTeam === 'blue' && isSpymasterView && (
          <div className="bg-black/50 backdrop-blur-md rounded-xl border border-blue-500/20 p-3">
            <h3 className="text-sm font-bold text-blue-400 mb-2">Give Clue</h3>
            <ClueInput onSubmit={handleGiveClue} team="blue" />
          </div>
        )}
        <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
          <GameLog gameState={gameState} />
        </div>
      </div>
    </div>
  );
}
