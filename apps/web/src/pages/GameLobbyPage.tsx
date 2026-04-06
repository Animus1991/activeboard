/**
 * GameLobbyPage - Multiplayer game lobby
 * Players join a room, select a game, ready up, and start playing
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users, Crown, Check, Copy, ArrowLeft, Gamepad2,
  Map, Landmark, Globe, MessageSquare, Play, Loader2,
  Wifi, WifiOff, UserPlus, Clock,
} from 'lucide-react';
import { useGameSync, type BoardGameType } from '@/hooks/useGameSync';

const GAME_OPTIONS: { id: BoardGameType; name: string; icon: typeof Map; color: string; players: string; description: string }[] = [
  {
    id: 'catan',
    name: 'Settlers of Catan',
    icon: Map,
    color: 'from-orange-500 to-red-600',
    players: '3-4',
    description: 'Trade resources, build settlements, race to 10 VP',
  },
  {
    id: 'monopoly',
    name: 'Monopoly',
    icon: Landmark,
    color: 'from-red-500 to-red-700',
    players: '2-4',
    description: 'Buy properties, build houses & hotels, bankrupt opponents',
  },
  {
    id: 'risk',
    name: 'Risk',
    icon: Globe,
    color: 'from-red-600 to-orange-600',
    players: '2-6',
    description: 'Deploy armies, attack territories, conquer the world',
  },
  {
    id: 'codenames',
    name: 'Codenames',
    icon: MessageSquare,
    color: 'from-purple-500 to-pink-600',
    players: '4+',
    description: 'Team word guessing with spymasters and operatives',
  },
];

const PLAYER_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function GameLobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [playerName] = useState(() => `Player_${Math.random().toString(36).substring(2, 6)}`);
  const [playerColor] = useState(() => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  const {
    isConnected,
    isConnecting,
    playerId,
    isHost,
    room,
    players,
    selectedGame,
    boardGameStarted,
    gameLog,
    selectGame,
    setReady,
    startBoardGame,
  } = useGameSync({
    roomCode: roomCode || '',
    playerName,
    playerColor,
    deviceType: 'pc',
    onError: (err) => console.error('WebSocket error:', err),
  });

  // Navigate to game when started
  useEffect(() => {
    if (boardGameStarted && selectedGame) {
      navigate(`/games/${selectedGame}?room=${roomCode}&multiplayer=true`);
    }
  }, [boardGameStarted, selectedGame, roomCode, navigate]);

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady || p.id === room?.hostId);
  const canStart = isHost && selectedGame && allPlayersReady;

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
        <p className="text-red-400">Invalid room code</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Game Lobby</h1>
                <p className="text-xs text-slate-400">Room: {roomCode}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection status */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnected ? 'bg-green-500/20 text-green-400' : isConnecting ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {isConnected ? <Wifi className="w-3.5 h-3.5" /> : isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5" />}
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </div>

              {/* Copy room code */}
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
              >
                <span className="text-purple-400 font-mono font-bold">{roomCode}</span>
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Players Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Players ({players.length})
            </h2>

            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    player.id === playerId
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{player.name}</span>
                        {player.id === room?.hostId && (
                          <Crown className="w-3.5 h-3.5 text-yellow-400" />
                        )}
                        {player.id === playerId && (
                          <span className="text-xs text-purple-400">(You)</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{player.deviceType}</span>
                    </div>
                  </div>

                  <div>
                    {player.isReady ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
                        <Clock className="w-3 h-3" /> Waiting
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {players.length < 4 && (
                <div className="flex items-center justify-center p-3 rounded-lg border border-dashed border-slate-700 text-slate-500 text-sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Waiting for players...
                </div>
              )}
            </div>

            {/* Ready / Start buttons */}
            <div className="space-y-2 pt-2">
              {!isHost && (
                <button
                  onClick={() => {
                    const myPlayer = players.find(p => p.id === playerId);
                    setReady(!myPlayer?.isReady);
                  }}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                    players.find(p => p.id === playerId)?.isReady
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {players.find(p => p.id === playerId)?.isReady ? '✓ Ready!' : 'Ready Up'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={startBoardGame}
                  disabled={!canStart}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    canStart
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {!selectedGame ? 'Select a Game First' : !allPlayersReady ? 'Waiting for Players...' : 'Start Game!'}
                </button>
              )}
            </div>
          </div>

          {/* Center: Game Selection */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
              {isHost ? 'Choose a Game' : 'Selected Game'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GAME_OPTIONS.map((game) => {
                const Icon = game.icon;
                const isSelected = selectedGame === game.id;

                return (
                  <button
                    key={game.id}
                    onClick={() => isHost && selectGame(game.id)}
                    disabled={!isHost}
                    className={`group text-left p-6 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                        : isHost
                          ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                          : 'border-slate-700/50 bg-slate-800/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.color} ${isSelected ? 'scale-110' : ''} transition-transform`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-bold ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                            {game.name}
                          </h3>
                          {isSelected && <Check className="w-5 h-5 text-purple-400" />}
                        </div>
                        <p className="text-slate-400 text-sm mt-1">{game.description}</p>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mt-2 inline-block">
                          {game.players} players
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Game Log */}
            {gameLog.length > 0 && (
              <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-2">Activity Log</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {gameLog.slice(-10).map((entry) => (
                    <div key={entry.id} className="text-xs text-slate-400">
                      <span className="text-slate-300 font-medium">{entry.playerName}</span>{' '}
                      {entry.action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Play Option (when WebSocket is unavailable) */}
            {!isConnected && !isConnecting && (
              <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-6">
                <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                  <WifiOff className="w-4 h-4" />
                  Server Not Available
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Multiplayer server is offline. You can still play locally with hot-seat mode:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {GAME_OPTIONS.map((game) => {
                    const Icon = game.icon;
                    return (
                      <button
                        key={game.id}
                        onClick={() => navigate(`/games/${game.id}`)}
                        className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-all text-left"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${game.color}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="text-white text-sm font-medium block">{game.name}</span>
                          <span className="text-slate-500 text-xs">Local Play</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Share invite (when connected) */}
            {isConnected && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center">
                <h3 className="text-white font-bold mb-2">Invite Friends</h3>
                <p className="text-slate-400 text-sm mb-4">Share this room code with your friends:</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-mono font-bold text-purple-400 tracking-wider">{roomCode}</span>
                  <button
                    onClick={copyRoomCode}
                    className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
                  </button>
                </div>
                <p className="text-slate-500 text-xs mt-3">
                  They can join at <span className="text-purple-400">/lobby/{roomCode}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
