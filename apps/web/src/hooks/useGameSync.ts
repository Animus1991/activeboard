import { useState, useEffect, useCallback, useRef } from 'react';

// Types matching backend
export interface GamePiece {
  id: string;
  unitTypeId: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  ownerId: string;
  isSelected: boolean;
  stats: {
    wounds: number;
    maxWounds: number;
  };
}

export interface PlayerPresence {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedPieceId: string | null;
  isReady: boolean;
  deviceType: 'touch-table' | 'pc' | 'vr' | 'mobile';
}

export interface GameLogEntry {
  id: string;
  playerId: string;
  playerName: string;
  action: string;
  timestamp: number;
}

export type BoardGameType = 'catan' | 'monopoly' | 'risk' | 'codenames';

export interface BoardGameState {
  gameType: BoardGameType;
  state: unknown;
  hostId: string;
  startedAt: number;
}

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  turnNumber: number;
  currentPlayerId: string;
  phase: 'lobby' | 'setup' | 'deployment' | 'playing' | 'ended';
  gameLog: GameLogEntry[];
  players: PlayerPresence[];
  pieces: GamePiece[];
  selectedGame: BoardGameType | null;
  boardGame: BoardGameState | null;
}

// Message types
type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; player: Omit<PlayerPresence, 'id'> }
  | { type: 'LEAVE_ROOM' }
  | { type: 'UPDATE_PRESENCE'; presence: Partial<PlayerPresence> }
  | { type: 'MOVE_PIECE'; pieceId: string; position: { x: number; y: number; z: number } }
  | { type: 'SELECT_PIECE'; pieceId: string | null }
  | { type: 'ROLL_DICE'; count: number }
  | { type: 'END_TURN' }
  | { type: 'CHAT_MESSAGE'; message: string }
  | { type: 'SYNC_REQUEST' }
  // Board game messages
  | { type: 'SELECT_GAME'; gameType: BoardGameType }
  | { type: 'PLAYER_READY'; ready: boolean }
  | { type: 'START_BOARD_GAME' }
  | { type: 'GAME_ACTION'; action: string; data?: unknown }
  | { type: 'GAME_STATE_UPDATE'; gameState: unknown };

type ServerMessage =
  | { type: 'CONNECTED'; playerId: string }
  | { type: 'ROOM_STATE'; room: GameRoom }
  | { type: 'PLAYER_JOINED'; player: PlayerPresence }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PRESENCE_UPDATED'; playerId: string; presence: Partial<PlayerPresence> }
  | { type: 'PIECE_MOVED'; pieceId: string; position: { x: number; y: number; z: number }; playerId: string }
  | { type: 'PIECE_SELECTED'; pieceId: string | null; playerId: string }
  | { type: 'DICE_ROLLED'; playerId: string; playerName: string; results: number[] }
  | { type: 'TURN_ENDED'; nextPlayerId: string; turnNumber: number }
  | { type: 'CHAT_MESSAGE'; playerId: string; playerName: string; message: string; timestamp: number }
  | { type: 'GAME_LOG'; entry: GameLogEntry }
  | { type: 'ERROR'; message: string }
  // Board game messages
  | { type: 'GAME_SELECTED'; gameType: BoardGameType; selectedBy: string }
  | { type: 'PLAYER_READY_UPDATE'; playerId: string; ready: boolean }
  | { type: 'BOARD_GAME_STARTED'; gameType: BoardGameType; gameState: unknown; hostId: string }
  | { type: 'GAME_ACTION_RECEIVED'; playerId: string; playerName: string; action: string; data?: unknown }
  | { type: 'GAME_STATE_UPDATED'; gameState: unknown; updatedBy: string };

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface DiceRoll {
  playerId: string;
  playerName: string;
  results: number[];
  timestamp: number;
}

interface UseGameSyncOptions {
  roomCode: string;
  playerName: string;
  playerColor: string;
  deviceType: PlayerPresence['deviceType'];
  enabled?: boolean; // default true - set false to skip connection
  onError?: (error: string) => void;
  onGameAction?: (playerId: string, action: string, data?: unknown) => void;
}

export { type UseGameSyncOptions };

interface UseGameSyncReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  playerId: string | null;
  isHost: boolean;
  
  // Room state
  room: GameRoom | null;
  players: PlayerPresence[];
  pieces: GamePiece[];
  currentTurn: string | null;
  turnNumber: number;
  phase: GameRoom['phase'] | null;
  selectedGame: BoardGameType | null;
  
  // Board game state
  boardGameState: unknown | null;
  boardGameStarted: boolean;
  
  // Game log & chat
  gameLog: GameLogEntry[];
  chatMessages: ChatMessage[];
  lastDiceRoll: DiceRoll | null;
  
  // Actions
  movePiece: (pieceId: string, position: { x: number; y: number; z: number }) => void;
  selectPiece: (pieceId: string | null) => void;
  rollDice: (count: number) => void;
  endTurn: () => void;
  sendChatMessage: (message: string) => void;
  updatePresence: (presence: Partial<PlayerPresence>) => void;
  requestSync: () => void;
  disconnect: () => void;
  
  // Board game actions
  selectGame: (gameType: BoardGameType) => void;
  setReady: (ready: boolean) => void;
  startBoardGame: () => void;
  sendGameAction: (action: string, data?: unknown) => void;
  broadcastGameState: (gameState: unknown) => void;
}

export function useGameSync({
  roomCode,
  playerName,
  playerColor,
  deviceType,
  enabled = true,
  onError,
  onGameAction,
}: UseGameSyncOptions): UseGameSyncReturn {
  // Skip connection if disabled
  const shouldConnect = enabled && roomCode && roomCode !== 'NONE';
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // Room state
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastDiceRoll, setLastDiceRoll] = useState<DiceRoll | null>(null);
  
  // Board game state
  const [boardGameState, setBoardGameState] = useState<unknown | null>(null);
  const [boardGameStarted, setBoardGameStarted] = useState(false);
  
  // Callbacks for board game events
  const onGameActionRef = useRef<((playerId: string, action: string, data?: unknown) => void) | null>(null);

  // Keep onGameAction callback in sync with the option (so callers can update without re-creating the hook)
  useEffect(() => {
    onGameActionRef.current = onGameAction ?? null;
  }, [onGameAction]);
  const onGameStartedRef = useRef<((gameType: BoardGameType) => void) | null>(null);
  
  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Send message helper
  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as ServerMessage;

      switch (message.type) {
        case 'CONNECTED':
          setPlayerId(message.playerId);
          // Join room after connection
          sendMessage({
            type: 'JOIN_ROOM',
            roomCode,
            player: {
              name: playerName,
              color: playerColor,
              cursor: null,
              selectedPieceId: null,
              isReady: false,
              deviceType,
            },
          });
          break;

        case 'ROOM_STATE':
          setRoom(message.room);
          setIsConnected(true);
          setIsConnecting(false);
          reconnectAttemptsRef.current = 0;
          break;

        case 'PLAYER_JOINED':
          setRoom(prev => prev ? {
            ...prev,
            players: [...prev.players, message.player],
          } : null);
          break;

        case 'PLAYER_LEFT':
          setRoom(prev => prev ? {
            ...prev,
            players: prev.players.filter(p => p.id !== message.playerId),
          } : null);
          break;

        case 'PRESENCE_UPDATED':
          setRoom(prev => prev ? {
            ...prev,
            players: prev.players.map(p =>
              p.id === message.playerId ? { ...p, ...message.presence } : p
            ),
          } : null);
          break;

        case 'PIECE_MOVED':
          setRoom(prev => prev ? {
            ...prev,
            pieces: prev.pieces.map(p =>
              p.id === message.pieceId ? { ...p, position: message.position } : p
            ),
          } : null);
          break;

        case 'PIECE_SELECTED':
          setRoom(prev => prev ? {
            ...prev,
            players: prev.players.map(p =>
              p.id === message.playerId ? { ...p, selectedPieceId: message.pieceId } : p
            ),
          } : null);
          break;

        case 'DICE_ROLLED':
          setLastDiceRoll({
            playerId: message.playerId,
            playerName: message.playerName,
            results: message.results,
            timestamp: Date.now(),
          });
          break;

        case 'TURN_ENDED':
          setRoom(prev => prev ? {
            ...prev,
            currentPlayerId: message.nextPlayerId,
            turnNumber: message.turnNumber,
          } : null);
          break;

        case 'CHAT_MESSAGE':
          setChatMessages(prev => [...prev, {
            playerId: message.playerId,
            playerName: message.playerName,
            message: message.message,
            timestamp: message.timestamp,
          }]);
          break;

        case 'GAME_LOG':
          setRoom(prev => prev ? {
            ...prev,
            gameLog: [...prev.gameLog, message.entry],
          } : null);
          break;

        case 'ERROR':
          onError?.(message.message);
          break;

        // Board game messages
        case 'GAME_SELECTED':
          setRoom(prev => prev ? { ...prev, selectedGame: message.gameType } : null);
          break;

        case 'PLAYER_READY_UPDATE':
          setRoom(prev => prev ? {
            ...prev,
            players: prev.players.map(p =>
              p.id === message.playerId ? { ...p, isReady: message.ready } : p
            ),
          } : null);
          break;

        case 'BOARD_GAME_STARTED':
          setRoom(prev => prev ? { ...prev, phase: 'playing' } : null);
          setBoardGameStarted(true);
          onGameStartedRef.current?.(message.gameType);
          break;

        case 'GAME_ACTION_RECEIVED':
          onGameActionRef.current?.(message.playerId, message.action, message.data);
          break;

        case 'GAME_STATE_UPDATED':
          setBoardGameState(message.gameState);
          break;
      }
    } catch (error) {
      console.error('[GameSync] Error parsing message:', error);
    }
  }, [roomCode, playerName, playerColor, deviceType, sendMessage, onError]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setIsConnecting(true);
    
    const wsUrl = `ws://${window.location.hostname}:3001/ws/game`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[GameSync] Connected to server');
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log('[GameSync] Disconnected from server');
      setIsConnected(false);
      setIsConnecting(false);
      
      // Attempt reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      if (reconnectAttemptsRef.current === 0) {
        console.warn('[GameSync] Server unavailable at', wsUrl);
      }
      onError?.('Connection error');
    };
  }, [handleMessage, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      sendMessage({ type: 'LEAVE_ROOM' });
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setRoom(null);
    setPlayerId(null);
  }, [sendMessage]);

  // Keep latest connect/disconnect in refs to avoid effect dependency churn
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  // Connect on mount (only if enabled)
  useEffect(() => {
    if (shouldConnect) {
      connectRef.current();
    }
    return () => disconnectRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect]);

  // Actions
  const movePiece = useCallback((pieceId: string, position: { x: number; y: number; z: number }) => {
    sendMessage({ type: 'MOVE_PIECE', pieceId, position });
  }, [sendMessage]);

  const selectPiece = useCallback((pieceId: string | null) => {
    sendMessage({ type: 'SELECT_PIECE', pieceId });
  }, [sendMessage]);

  const rollDice = useCallback((count: number) => {
    sendMessage({ type: 'ROLL_DICE', count });
  }, [sendMessage]);

  const endTurn = useCallback(() => {
    sendMessage({ type: 'END_TURN' });
  }, [sendMessage]);

  const sendChatMessage = useCallback((message: string) => {
    sendMessage({ type: 'CHAT_MESSAGE', message });
  }, [sendMessage]);

  const updatePresence = useCallback((presence: Partial<PlayerPresence>) => {
    sendMessage({ type: 'UPDATE_PRESENCE', presence });
  }, [sendMessage]);

  const requestSync = useCallback(() => {
    sendMessage({ type: 'SYNC_REQUEST' });
  }, [sendMessage]);

  // Board game actions
  const selectGame = useCallback((gameType: BoardGameType) => {
    sendMessage({ type: 'SELECT_GAME', gameType });
  }, [sendMessage]);

  const setReady = useCallback((ready: boolean) => {
    sendMessage({ type: 'PLAYER_READY', ready });
  }, [sendMessage]);

  const startBoardGame = useCallback(() => {
    sendMessage({ type: 'START_BOARD_GAME' });
  }, [sendMessage]);

  const sendGameAction = useCallback((action: string, data?: unknown) => {
    sendMessage({ type: 'GAME_ACTION', action, data });
  }, [sendMessage]);

  const broadcastGameState = useCallback((gameState: unknown) => {
    sendMessage({ type: 'GAME_STATE_UPDATE', gameState });
  }, [sendMessage]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    playerId,
    isHost: !!(playerId && room && room.hostId === playerId),
    
    // Room state
    room,
    players: room?.players ?? [],
    pieces: room?.pieces ?? [],
    currentTurn: room?.currentPlayerId ?? null,
    turnNumber: room?.turnNumber ?? 1,
    phase: room?.phase ?? null,
    selectedGame: room?.selectedGame ?? null,
    
    // Board game state
    boardGameState,
    boardGameStarted,
    
    // Game log & chat
    gameLog: room?.gameLog ?? [],
    chatMessages,
    lastDiceRoll,
    
    // Actions
    movePiece,
    selectPiece,
    rollDice,
    endTurn,
    sendChatMessage,
    updatePresence,
    requestSync,
    disconnect,
    
    // Board game actions
    selectGame,
    setReady,
    startBoardGame,
    sendGameAction,
    broadcastGameState,
  };
}

export default useGameSync;
