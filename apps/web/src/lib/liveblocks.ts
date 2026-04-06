import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

// Liveblocks client configuration
// In production, use environment variable for public key
const client = createClient({
  publicApiKey: (import.meta as unknown as { env: Record<string, string> }).env.VITE_LIVEBLOCKS_PUBLIC_KEY || 'pk_dev_placeholder',
  throttle: 16, // 60fps sync
});

// Game piece position and state
export type GamePiece = {
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
};

// Terrain piece
export type TerrainPiece = {
  id: string;
  type: 'ruin' | 'crater' | 'forest' | 'building' | 'barricade' | 'hill';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

// Dice roll result
export type DiceRoll = {
  id: string;
  playerId: string;
  playerName: string;
  dice: number[];
  results: number[];
  timestamp: number;
};

// Measurement line
export type MeasurementLine = {
  id: string;
  playerId: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  distance: number; // in inches
};

// Player presence (cursor, selection, etc.)
export type PlayerPresence = {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedPieceId: string | null;
  isReady: boolean;
  deviceType: 'touch-table' | 'pc' | 'vr' | 'mobile';
};

// Game room state stored in Liveblocks
export type GameRoomStorage = {
  // Game metadata
  gameId: string;
  gameSystemId: string;
  turnNumber: number;
  currentPlayerId: string;
  phase: 'setup' | 'deployment' | 'playing' | 'ended';
  
  // Board state - using Record instead of Map for Liveblocks compatibility
  pieces: Record<string, GamePiece>;
  terrain: Record<string, TerrainPiece>;
  
  // Ephemeral state
  diceRolls: DiceRoll[];
  measurements: Record<string, MeasurementLine>;
  
  // Chat/log
  gameLog: Array<{
    id: string;
    playerId: string;
    playerName: string;
    action: string;
    timestamp: number;
  }>;
};

// Create Liveblocks room context with types
export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useSelf,
  useStorage,
  useMutation,
  useBroadcastEvent,
  useEventListener,
  useStatus,
} = createRoomContext<PlayerPresence, GameRoomStorage>(client);

// Event types for real-time actions
export type GameEvent =
  | { type: 'DICE_ROLL'; playerId: string; playerName: string; dice: number[]; results: number[] }
  | { type: 'PIECE_MOVED'; pieceId: string; playerId: string; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }
  | { type: 'TURN_ENDED'; playerId: string }
  | { type: 'GAME_STARTED' }
  | { type: 'MEASUREMENT_CREATED'; measurement: MeasurementLine }
  | { type: 'CHAT_MESSAGE'; playerId: string; playerName: string; message: string };
