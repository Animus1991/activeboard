import type { Context } from 'hono';

// JWT Payload
export interface JWTPayload {
  sub: string; // user id
  email: string;
  username: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

// Hono context variables
export interface AppVariables {
  user?: JWTPayload;
  userId?: string;
}

export type AppContext = Context<{ Variables: AppVariables }>;

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Game state types (for future WebSocket implementation)
export interface GameState {
  turn: number;
  currentPlayerId: string;
  phase: 'deployment' | 'movement' | 'shooting' | 'melee' | 'morale';
  units: UnitState[];
  terrain: TerrainPiece[];
}

export interface UnitState {
  id: string;
  unitTypeId: string;
  playerId: string;
  position: Vector3;
  rotation: number;
  wounds: number;
  status: 'active' | 'fleeing' | 'destroyed';
}

export interface TerrainPiece {
  id: string;
  type: string;
  position: Vector3;
  rotation: number;
  scale: Vector3;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// WebSocket message types
export type WSMessageType =
  | 'join_room'
  | 'leave_room'
  | 'player_ready'
  | 'game_start'
  | 'move_unit'
  | 'roll_dice'
  | 'end_turn'
  | 'chat_message'
  | 'sync_state'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

// Room code generation
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Referral code generation
export function generateReferralCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
