import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';

// Types for game state synchronization
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

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  players: Map<string, PlayerPresence>;
  pieces: Map<string, GamePiece>;
  turnNumber: number;
  currentPlayerId: string;
  phase: 'lobby' | 'setup' | 'deployment' | 'playing' | 'ended';
  gameLog: Array<{
    id: string;
    playerId: string;
    playerName: string;
    action: string;
    timestamp: number;
  }>;
  selectedGame: BoardGameType | null;
  boardGame: BoardGameState | null;
}

// Board game types
export type BoardGameType = 'catan' | 'monopoly' | 'risk' | 'codenames';

export interface BoardGameState {
  gameType: BoardGameType;
  state: unknown; // Game-specific state (CatanGameState, MonopolyGameState, etc.)
  hostId: string;
  startedAt: number;
}

// Message types
export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; player: Omit<PlayerPresence, 'id'> }
  | { type: 'LEAVE_ROOM' }
  | { type: 'UPDATE_PRESENCE'; presence: Partial<PlayerPresence> }
  | { type: 'MOVE_PIECE'; pieceId: string; position: { x: number; y: number; z: number } }
  | { type: 'SELECT_PIECE'; pieceId: string | null }
  | { type: 'ROLL_DICE'; count: number }
  | { type: 'END_TURN' }
  | { type: 'CHAT_MESSAGE'; message: string }
  | { type: 'SYNC_REQUEST' }
  // Board game specific messages
  | { type: 'SELECT_GAME'; gameType: BoardGameType }
  | { type: 'PLAYER_READY'; ready: boolean }
  | { type: 'START_BOARD_GAME' }
  | { type: 'GAME_ACTION'; action: string; data?: unknown }
  | { type: 'GAME_STATE_UPDATE'; gameState: unknown };

export type ServerMessage =
  | { type: 'CONNECTED'; playerId: string }
  | { type: 'ROOM_STATE'; room: SerializedRoom }
  | { type: 'PLAYER_JOINED'; player: PlayerPresence }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PRESENCE_UPDATED'; playerId: string; presence: Partial<PlayerPresence> }
  | { type: 'PIECE_MOVED'; pieceId: string; position: { x: number; y: number; z: number }; playerId: string }
  | { type: 'PIECE_SELECTED'; pieceId: string | null; playerId: string }
  | { type: 'DICE_ROLLED'; playerId: string; playerName: string; results: number[] }
  | { type: 'TURN_ENDED'; nextPlayerId: string; turnNumber: number }
  | { type: 'CHAT_MESSAGE'; playerId: string; playerName: string; message: string; timestamp: number }
  | { type: 'GAME_LOG'; entry: GameRoom['gameLog'][0] }
  | { type: 'ERROR'; message: string }
  // Board game specific messages
  | { type: 'GAME_SELECTED'; gameType: BoardGameType; selectedBy: string }
  | { type: 'PLAYER_READY_UPDATE'; playerId: string; ready: boolean }
  | { type: 'BOARD_GAME_STARTED'; gameType: BoardGameType; gameState: unknown; hostId: string }
  | { type: 'GAME_ACTION_RECEIVED'; playerId: string; playerName: string; action: string; data?: unknown }
  | { type: 'GAME_STATE_UPDATED'; gameState: unknown; updatedBy: string };

interface SerializedRoom {
  id: string;
  code: string;
  hostId: string;
  turnNumber: number;
  currentPlayerId: string;
  phase: GameRoom['phase'];
  gameLog: GameRoom['gameLog'];
  players: PlayerPresence[];
  pieces: GamePiece[];
  selectedGame: BoardGameType | null;
  boardGame: BoardGameState | null;
}

interface PlayerSocket {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

// In-memory storage (use Redis in production)
const rooms = new Map<string, GameRoom>();
const sockets = new Map<WebSocket, PlayerSocket>();

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function broadcastToRoom(roomCode: string, message: ServerMessage, excludePlayerId?: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  
  for (const [playerId] of room.players) {
    if (playerId === excludePlayerId) continue;
    
    for (const [ws, socketData] of sockets) {
      if (socketData.playerId === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }
}

function serializeRoom(room: GameRoom): SerializedRoom {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    turnNumber: room.turnNumber,
    currentPlayerId: room.currentPlayerId,
    phase: room.phase,
    gameLog: room.gameLog,
    players: Array.from(room.players.values()),
    pieces: Array.from(room.pieces.values()),
    selectedGame: room.selectedGame,
    boardGame: room.boardGame,
  };
}

function addGameLogEntry(room: GameRoom, playerId: string, playerName: string, action: string): void {
  const entry = {
    id: generateId(),
    playerId,
    playerName,
    action,
    timestamp: Date.now(),
  };
  room.gameLog.push(entry);
  
  // Keep only last 100 entries
  if (room.gameLog.length > 100) {
    room.gameLog = room.gameLog.slice(-100);
  }
  
  broadcastToRoom(room.code, { type: 'GAME_LOG', entry });
}

function handleMessage(ws: WebSocket, socketData: PlayerSocket, message: ClientMessage): void {
  const { playerId } = socketData;

  switch (message.type) {
    case 'JOIN_ROOM': {
      const { roomCode, player } = message;
      
      // Get or create room
      let room = rooms.get(roomCode);
      if (!room) {
        room = {
          id: generateId(),
          code: roomCode,
          hostId: playerId,
          players: new Map(),
          pieces: new Map(),
          turnNumber: 1,
          currentPlayerId: playerId,
          phase: 'lobby',
          gameLog: [],
          selectedGame: null,
          boardGame: null,
        };
        rooms.set(roomCode, room);
      }
      
      // Add player to room
      const playerPresence: PlayerPresence = {
        ...player,
        id: playerId,
      };
      room.players.set(playerId, playerPresence);
      socketData.roomCode = roomCode;
      
      // Send room state to joining player
      ws.send(JSON.stringify({ type: 'ROOM_STATE', room: serializeRoom(room) }));
      
      // Notify others
      broadcastToRoom(roomCode, { type: 'PLAYER_JOINED', player: playerPresence }, playerId);
      addGameLogEntry(room, playerId, player.name, 'joined the game');
      
      console.log(`[WS] Player ${playerId} joined room ${roomCode}`);
      break;
    }

    case 'LEAVE_ROOM': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        room.players.delete(playerId);
        socketData.roomCode = null;
        
        if (player) {
          addGameLogEntry(room, playerId, player.name, 'left the game');
        }
        
        broadcastToRoom(roomCode, { type: 'PLAYER_LEFT', playerId });
        
        // Clean up empty rooms
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          console.log(`[WS] Room ${roomCode} deleted (empty)`);
        }
      }
      
      console.log(`[WS] Player ${playerId} left room ${roomCode}`);
      break;
    }

    case 'UPDATE_PRESENCE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          Object.assign(player, message.presence);
          broadcastToRoom(roomCode, {
            type: 'PRESENCE_UPDATED',
            playerId,
            presence: message.presence,
          }, playerId);
        }
      }
      break;
    }

    case 'MOVE_PIECE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const piece = room.pieces.get(message.pieceId);
        if (piece) {
          piece.position = message.position;
          broadcastToRoom(roomCode, {
            type: 'PIECE_MOVED',
            pieceId: message.pieceId,
            position: message.position,
            playerId,
          });
          
          const player = room.players.get(playerId);
          if (player) {
            addGameLogEntry(room, playerId, player.name, `moved ${piece.name}`);
          }
        }
      }
      break;
    }

    case 'SELECT_PIECE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          player.selectedPieceId = message.pieceId;
          broadcastToRoom(roomCode, {
            type: 'PIECE_SELECTED',
            pieceId: message.pieceId,
            playerId,
          }, playerId);
        }
      }
      break;
    }

    case 'ROLL_DICE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          const results = Array.from({ length: message.count }, () => 
            Math.floor(Math.random() * 6) + 1
          );
          
          broadcastToRoom(roomCode, {
            type: 'DICE_ROLLED',
            playerId,
            playerName: player.name,
            results,
          });
          
          const successes = results.filter(r => r >= 4).length;
          addGameLogEntry(room, playerId, player.name, 
            `rolled ${message.count}D6: [${results.join(', ')}] (${successes} successes)`);
        }
      }
      break;
    }

    case 'END_TURN': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room && room.currentPlayerId === playerId) {
        const playerIds = Array.from(room.players.keys());
        const currentIndex = playerIds.indexOf(playerId);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextIndex];
        
        if (nextIndex === 0) {
          room.turnNumber++;
        }
        room.currentPlayerId = nextPlayerId;
        
        broadcastToRoom(roomCode, {
          type: 'TURN_ENDED',
          nextPlayerId,
          turnNumber: room.turnNumber,
        });
        
        const player = room.players.get(playerId);
        if (player) {
          addGameLogEntry(room, playerId, player.name, 'ended their turn');
        }
      }
      break;
    }

    case 'CHAT_MESSAGE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          broadcastToRoom(roomCode, {
            type: 'CHAT_MESSAGE',
            playerId,
            playerName: player.name,
            message: message.message,
            timestamp: Date.now(),
          });
        }
      }
      break;
    }

    case 'SYNC_REQUEST': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        ws.send(JSON.stringify({ type: 'ROOM_STATE', room: serializeRoom(room) }));
      }
      break;
    }

    // ================================================================
    // BOARD GAME SPECIFIC HANDLERS
    // ================================================================

    case 'SELECT_GAME': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room && room.hostId === playerId && room.phase === 'lobby') {
        room.selectedGame = message.gameType;
        broadcastToRoom(roomCode, {
          type: 'GAME_SELECTED',
          gameType: message.gameType,
          selectedBy: playerId,
        });
        
        const player = room.players.get(playerId);
        if (player) {
          addGameLogEntry(room, playerId, player.name, `selected ${message.gameType}`);
        }
        console.log(`[WS] Game ${message.gameType} selected in room ${roomCode}`);
      }
      break;
    }

    case 'PLAYER_READY': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          player.isReady = message.ready;
          broadcastToRoom(roomCode, {
            type: 'PLAYER_READY_UPDATE',
            playerId,
            ready: message.ready,
          });
        }
      }
      break;
    }

    case 'START_BOARD_GAME': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room && room.hostId === playerId && room.selectedGame && room.phase === 'lobby') {
        // Verify minimum players
        if (room.players.size < 2) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players' }));
          break;
        }
        
        room.phase = 'playing';
        // The host will send the initial game state via GAME_STATE_UPDATE
        broadcastToRoom(roomCode, {
          type: 'BOARD_GAME_STARTED',
          gameType: room.selectedGame,
          gameState: null, // Host will send state separately
          hostId: playerId,
        });
        
        const player = room.players.get(playerId);
        if (player) {
          addGameLogEntry(room, playerId, player.name, `started ${room.selectedGame}`);
        }
        console.log(`[WS] Board game ${room.selectedGame} started in room ${roomCode}`);
      }
      break;
    }

    case 'GAME_ACTION': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room && room.phase === 'playing') {
        const player = room.players.get(playerId);
        if (player) {
          // Relay action to host (who runs the game engine)
          broadcastToRoom(roomCode, {
            type: 'GAME_ACTION_RECEIVED',
            playerId,
            playerName: player.name,
            action: message.action,
            data: message.data,
          });
        }
      }
      break;
    }

    case 'GAME_STATE_UPDATE': {
      const { roomCode } = socketData;
      if (!roomCode) break;
      
      const room = rooms.get(roomCode);
      if (room && room.hostId === playerId && room.phase === 'playing') {
        // Host sends updated game state to all players
        room.boardGame = {
          gameType: room.selectedGame!,
          state: message.gameState,
          hostId: playerId,
          startedAt: room.boardGame?.startedAt ?? Date.now(),
        };
        
        broadcastToRoom(roomCode, {
          type: 'GAME_STATE_UPDATED',
          gameState: message.gameState,
          updatedBy: playerId,
        }, playerId); // Don't send back to host
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Unknown message type' }));
  }
}

function handleDisconnect(ws: WebSocket): void {
  const socketData = sockets.get(ws);
  if (!socketData) return;

  const { playerId, roomCode } = socketData;
  
  if (roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
      const player = room.players.get(playerId);
      room.players.delete(playerId);
      
      if (player) {
        addGameLogEntry(room, playerId, player.name, 'disconnected');
      }
      
      broadcastToRoom(roomCode, { type: 'PLAYER_LEFT', playerId });
      
      if (room.players.size === 0) {
        rooms.delete(roomCode);
        console.log(`[WS] Room ${roomCode} deleted (empty)`);
      }
    }
  }
  
  sockets.delete(ws);
  console.log(`[WS] Player ${playerId} disconnected`);
}

// Initialize WebSocket server
export function initializeWebSocket(server: HttpServer | HttpsServer): WebSocketServer {
  const wss = new WebSocketServer({ server: server as HttpServer, path: '/ws/game' });

  wss.on('connection', (ws: WebSocket) => {
    const playerId = generateId();
    const socketData: PlayerSocket = { ws, playerId, roomCode: null };
    sockets.set(ws, socketData);
    
    // Send connection confirmation
    ws.send(JSON.stringify({ type: 'CONNECTED', playerId }));
    console.log(`[WS] Player ${playerId} connected`);

    ws.on('message', (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        handleMessage(ws, socketData, message);
      } catch (error) {
        console.error('[WS] Error processing message:', error);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('[WS] Socket error:', error);
      handleDisconnect(ws);
    });
  });

  console.log('[WS] WebSocket server initialized on /ws/game');
  return wss;
}

// Export for testing
export { rooms, sockets };
