/**
 * useMultiplayerGame - Bridge between game engines and WebSocket multiplayer
 * 
 * Usage in game pages:
 *   const mp = useMultiplayerGame<MyGameState>();
 *   // mp.isMultiplayer - true if connected to a room
 *   // mp.isHost - true if this player is the host (runs the engine)
 *   // mp.syncState(state) - host broadcasts state to other players
 *   // mp.remoteState - latest state from host (for non-host players)
 *   // mp.onAction(callback) - register handler for remote player actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGameSync, type BoardGameType } from './useGameSync';

interface UseMultiplayerGameReturn<T> {
  // Mode
  isMultiplayer: boolean;
  isHost: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  roomCode: string | null;
  playerId: string | null;

  // State sync (host → clients)
  syncState: (state: T) => void;
  remoteState: T | null;

  // Action relay (client → host)
  sendAction: (action: string, data?: unknown) => void;

  // Player info
  playerCount: number;
  playerNames: string[];

  // Chat & dice
  sendChat: (msg: string) => void;
  rollDice: (count: number) => void;
}

const PLAYER_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];

export function useMultiplayerGame<T = unknown>(): UseMultiplayerGameReturn<T> {
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get('room');
  const isMultiplayerParam = searchParams.get('multiplayer') === 'true';
  const shouldConnect = !!(roomCode && isMultiplayerParam);

  const [playerName] = useState(() => `Player_${Math.random().toString(36).substring(2, 6)}`);
  const [playerColor] = useState(() => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  // Only connect if multiplayer params present
  const sync = useGameSync({
    roomCode: roomCode || 'NONE',
    playerName,
    playerColor,
    deviceType: 'pc',
    enabled: shouldConnect, // Only connect when multiplayer mode is active
    onError: (err) => console.warn('[Multiplayer] Error:', err),
  });

  // Track whether we actually want multiplayer
  const [active] = useState(shouldConnect);

  // Remote state for non-host players
  const [remoteState, setRemoteState] = useState<T | null>(null);

  // Update remote state when boardGameState changes
  useEffect(() => {
    if (active && sync.boardGameState) {
      setRemoteState(sync.boardGameState as T);
    }
  }, [active, sync.boardGameState]);

  // Sync state (host sends to all clients)
  const lastSyncRef = useRef<number>(0);
  const syncState = useCallback((state: T) => {
    if (!active || !sync.isHost) return;
    // Throttle to max 10 updates per second
    const now = Date.now();
    if (now - lastSyncRef.current < 100) return;
    lastSyncRef.current = now;
    sync.broadcastGameState(state);
  }, [active, sync]);

  // Send action (non-host sends to host)
  const sendAction = useCallback((action: string, data?: unknown) => {
    if (!active) return;
    sync.sendGameAction(action, data);
  }, [active, sync]);

  // Chat
  const sendChat = useCallback((msg: string) => {
    if (!active) return;
    sync.sendChatMessage(msg);
  }, [active, sync]);

  // Dice
  const rollDice = useCallback((count: number) => {
    if (!active) return;
    sync.rollDice(count);
  }, [active, sync]);

  // If not multiplayer, return noop defaults
  if (!active) {
    return {
      isMultiplayer: false,
      isHost: true,
      isConnected: false,
      isConnecting: false,
      roomCode: null,
      playerId: null,
      syncState: () => {},
      remoteState: null,
      sendAction: () => {},
      playerCount: 1,
      playerNames: [],
      sendChat: () => {},
      rollDice: () => {},
    };
  }

  return {
    isMultiplayer: true,
    isHost: sync.isHost,
    isConnected: sync.isConnected,
    isConnecting: sync.isConnecting,
    roomCode,
    playerId: sync.playerId,
    syncState,
    remoteState,
    sendAction,
    playerCount: sync.players.length,
    playerNames: sync.players.map(p => p.name),
    sendChat,
    rollDice,
  };
}

export default useMultiplayerGame;
