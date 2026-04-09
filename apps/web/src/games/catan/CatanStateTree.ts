/**
 * Catan Authoritative State Tree
 *
 * Single-source-of-truth type system following the event-driven architecture
 * blueprint.  These types sit ABOVE the existing GameState and serve as the
 * formal contract between engine, UI, and render layers.
 *
 * Design principles:
 *   A. Single source of truth — authoritative server model
 *   B. Event-driven simulation — state changes only via accepted domain events
 *   C. Dual state model — gameplay state vs presentation/render state
 *   D. Visuals are projections, not truth
 */

import type { GamePhase, ResourceType } from './CatanEngine';

// ============================================================
// IDENTIFIERS
// ============================================================

export type PlayerId  = string;
export type HexId     = number;
export type VertexId  = string;
export type EdgeId    = string;
export type HarborId  = string;
export type EventId   = string;
export type MatchId   = string;

// ============================================================
// 1. MATCH META STATE
// ============================================================

export interface MatchMetaState {
  matchId: MatchId;
  createdAt: number;
  gameVersion: string;
  seed: string;
  /** Canonical player turn order for the entire match */
  playerOrder: PlayerId[];
  mode: 'classic' | 'beginner' | 'variable';
}

// ============================================================
// 2. RULES CONFIG STATE
// ============================================================

export type ResourceMap = Partial<Record<ResourceType, number>>;

export interface RulesConfigState {
  victoryPointsToWin: number;
  roadCost: ResourceMap;
  settlementCost: ResourceMap;
  cityCost: ResourceMap;
  devCardCost: ResourceMap;
  maxRoadsPerPlayer: number;
  maxSettlementsPerPlayer: number;
  maxCitiesPerPlayer: number;
  /** Players with more than this many cards on a 7 must discard */
  robberHandLimit: number;
  longestRoadMinSegments: number;
  largestArmyMinKnights: number;
}

export const DEFAULT_RULES: RulesConfigState = {
  victoryPointsToWin: 10,
  roadCost:        { wood: 1, brick: 1 },
  settlementCost:  { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  cityCost:        { wheat: 2, ore: 3 },
  devCardCost:     { sheep: 1, wheat: 1, ore: 1 },
  maxRoadsPerPlayer:        15,
  maxSettlementsPerPlayer:   5,
  maxCitiesPerPlayer:        4,
  robberHandLimit:           7,
  longestRoadMinSegments:    5,
  largestArmyMinKnights:     3,
};

// ============================================================
// 3. LIFECYCLE STATE
// ============================================================

/**
 * Canonical lifecycle phases — superset of the legacy GamePhase strings.
 * These drive which panels/buttons/CTAs are visible and enabled.
 */
export type LifecyclePhase =
  | 'LOBBY'
  | 'SETUP_ROUND_1'
  | 'SETUP_ROUND_2'
  | 'TURN_ROLL'
  | 'TURN_RESOLVE_PRODUCTION'
  | 'TURN_DISCARD'
  | 'TURN_ROBBER_MOVE'
  | 'TURN_ROBBER_STEAL'
  | 'TURN_MAIN'
  | 'TURN_END'
  | 'GAME_OVER';

export type MatchStatus = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface LifecycleState {
  phase: LifecyclePhase;
  status: MatchStatus;
}

/** Maps legacy GamePhase → canonical LifecyclePhase */
export function gamePhaseToLifecycle(phase: GamePhase): LifecyclePhase {
  switch (phase) {
    case 'setup-settlement': return 'SETUP_ROUND_1';
    case 'setup-road':       return 'SETUP_ROUND_1';
    case 'roll':             return 'TURN_ROLL';
    case 'discard':          return 'TURN_DISCARD';
    case 'robber-move':      return 'TURN_ROBBER_MOVE';
    case 'robber-steal':     return 'TURN_ROBBER_STEAL';
    case 'main':             return 'TURN_MAIN';
    case 'game-over':        return 'GAME_OVER';
    default:                 return 'TURN_MAIN';
  }
}

export function lifecycleLabel(phase: LifecyclePhase): string {
  const labels: Record<LifecyclePhase, string> = {
    LOBBY:                    'Lobby',
    SETUP_ROUND_1:            'Setup — Round 1',
    SETUP_ROUND_2:            'Setup — Round 2',
    TURN_ROLL:                'Roll Phase',
    TURN_RESOLVE_PRODUCTION:  'Production',
    TURN_DISCARD:             'Discard',
    TURN_ROBBER_MOVE:         'Move Robber',
    TURN_ROBBER_STEAL:        'Steal',
    TURN_MAIN:                'Main Phase',
    TURN_END:                 'End of Turn',
    GAME_OVER:                'Game Over',
  };
  return labels[phase] ?? phase;
}

// ============================================================
// 4. DICE STATE
// ============================================================

export interface DiceRollRecord {
  dieA: number;
  dieB: number;
  total: number;
  rolledBy: PlayerId;
  rolledAt: number;
  turnNumber: number;
}

export interface DiceState {
  lastRoll: DiceRollRecord | null;
  /** Full history for statistics and replay */
  rollHistory: DiceRollRecord[];
  isAnimating: boolean;
  /** Controlled by lifecycle: true only during TURN_ROLL for the active player */
  rollAllowed: boolean;
}

// ============================================================
// 5. BANK STATE
// ============================================================

export interface BankState {
  resources: Record<ResourceType, number>;
  devCardCount: number;
}

export const INITIAL_BANK: BankState = {
  resources: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 },
  devCardCount: 25,
};

// ============================================================
// 6. SPECIAL CARDS STATE
// ============================================================

export interface SpecialCardsState {
  longestRoadHolder: PlayerId | null;
  longestRoadLength: number;
  largestArmyHolder: PlayerId | null;
  largestArmySize: number;
}

// ============================================================
// 7. ROBBER EXTENDED STATE
// ============================================================

export interface RobberExtState {
  currentHexId: HexId;
  awaitingMove: boolean;
  awaitingSteal: boolean;
  /** Players the active player may steal from (adjacent settlements/cities) */
  stealCandidates: PlayerId[];
}

// ============================================================
// 8. RENDER STATE (presentation layer — never authoritative)
// ============================================================

export type BoardMaterialProfile = 'CLASSIC' | 'PREMIUM_PAINTED' | 'HYPERREAL_TABLETOP';
export type LightingProfile      = 'SHOWROOM' | 'WARM_TABLE' | 'MOODY_CINEMATIC';
export type CameraProfile        = 'TACTICAL' | 'ORBIT' | 'INSPECT';

export interface RenderDirtyFlags {
  boardGeometryDirty: boolean;
  /** Hex IDs whose terrain texture needs a redraw */
  terrainMaterialsDirty: HexId[];
  /** Hex IDs whose number token position/visibility changed */
  tokenPlacementDirty: HexId[];
  /** Vertex/edge IDs where piece state changed */
  piecePlacementDirty: string[];
  robberDirty: boolean;
  lightingDirty: boolean;
  cameraDirty: boolean;
}

export interface CameraFocus {
  type: 'HEX' | 'VERTEX' | 'PLAYER' | 'OVERVIEW';
  targetId?: string | number;
  durationMs: number;
}

export interface RenderState {
  boardMaterialProfile: BoardMaterialProfile;
  lightingProfile: LightingProfile;
  cameraProfile: CameraProfile;
  dirtyFlags: RenderDirtyFlags;
  pendingCameraFocus: CameraFocus | null;
}

export const INITIAL_RENDER_STATE: RenderState = {
  boardMaterialProfile: 'HYPERREAL_TABLETOP',
  lightingProfile: 'WARM_TABLE',
  cameraProfile: 'TACTICAL',
  dirtyFlags: {
    boardGeometryDirty: true,
    terrainMaterialsDirty: [],
    tokenPlacementDirty: [],
    piecePlacementDirty: [],
    robberDirty: true,
    lightingDirty: true,
    cameraDirty: true,
  },
  pendingCameraFocus: null,
};

// ============================================================
// 9. FULL CATAN MATCH STATE (root)
// ============================================================

/**
 * Root state for a Catan match.  The core gameplay lives inside `gameStateId`
 * (pointing to the existing GameState), while these sub-states provide the
 * formal projection and presentation contract.
 */
export interface CatanMatchState {
  meta:         MatchMetaState;
  rules:        RulesConfigState;
  lifecycle:    LifecycleState;
  dice:         DiceState;
  bank:         BankState;
  specialCards: SpecialCardsState;
  robberExt:    RobberExtState;
  render:       RenderState;
  /** ID of the corresponding authoritative GameState snapshot */
  gameStateId:  string;
}

// ============================================================
// 10. COMMAND MODEL
// ============================================================

export type CatanCommandType =
  | 'ROLL_DICE'
  | 'PLACE_SETUP_SETTLEMENT'
  | 'PLACE_SETUP_ROAD'
  | 'BUILD_ROAD'
  | 'BUILD_SETTLEMENT'
  | 'UPGRADE_CITY'
  | 'BUY_DEV_CARD'
  | 'PLAY_KNIGHT'
  | 'PLAY_ROAD_BUILDING'
  | 'PLAY_YEAR_OF_PLENTY'
  | 'PLAY_MONOPOLY'
  | 'MOVE_ROBBER'
  | 'STEAL_RESOURCE'
  | 'DISCARD_RESOURCES'
  | 'PROPOSE_TRADE'
  | 'ACCEPT_TRADE'
  | 'REJECT_TRADE'
  | 'MARITIME_TRADE'
  | 'END_TURN';

export interface CatanCommand {
  type:      CatanCommandType;
  playerId:  PlayerId;
  payload?:  Record<string, unknown>;
  timestamp: number;
}

// Validation result returned before a command is applied
export interface CommandValidation {
  valid: boolean;
  reason?: string;
  /** Which lifecycle phase gate failed, if any */
  blockedByPhase?: LifecyclePhase;
}

// ============================================================
// 11. DOMAIN EVENT MODEL
// ============================================================

export type CatanEventType =
  | 'MATCH_CREATED'
  | 'MATCH_STARTED'
  | 'SETUP_SETTLEMENT_PLACED'
  | 'SETUP_ROAD_PLACED'
  | 'STARTING_RESOURCES_GRANTED'
  | 'TURN_STARTED'
  | 'DICE_ROLLED'
  | 'RESOURCE_PRODUCED'
  | 'PRODUCTION_BLOCKED_BY_ROBBER'
  | 'ROBBER_ACTIVATED'
  | 'PLAYERS_DISCARDED'
  | 'ROBBER_MOVED'
  | 'RESOURCE_STOLEN'
  | 'TRADE_PROPOSED'
  | 'TRADE_ACCEPTED'
  | 'TRADE_REJECTED'
  | 'MARITIME_TRADE_EXECUTED'
  | 'ROAD_BUILT'
  | 'SETTLEMENT_BUILT'
  | 'CITY_UPGRADED'
  | 'DEV_CARD_PURCHASED'
  | 'KNIGHT_PLAYED'
  | 'YEAR_OF_PLENTY_PLAYED'
  | 'MONOPOLY_PLAYED'
  | 'ROAD_BUILDING_PLAYED'
  | 'LARGEST_ARMY_CHANGED'
  | 'LONGEST_ROAD_CHANGED'
  | 'VP_UPDATED'
  | 'TURN_ENDED'
  | 'GAME_WON';

export interface CatanDomainEvent {
  id:         EventId;
  type:       CatanEventType;
  matchId:    MatchId;
  playerId:   PlayerId;
  timestamp:  number;
  turnNumber: number;
  payload:    Record<string, unknown>;
}

// ============================================================
// 12. SPATIAL TYPES (3D positions on domain entities)
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform3D {
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

export interface SpatialHex {
  hexId: HexId;
  worldPosition: Vec3;
  corners: Vec3[]; // 6 corner positions in world space
}

export interface SpatialVertex {
  vertexId: VertexId;
  worldPosition: Vec3;
}

export interface SpatialEdge {
  edgeId: EdgeId;
  worldStart: Vec3;
  worldEnd: Vec3;
  midpoint: Vec3;
  angle: number;
}

// ============================================================
// 13. FEATURE COMPLETENESS MATRIX (documentation)
// ============================================================

export interface FeatureMatrixRow {
  /** Frontend UI component exists */
  fe: boolean;
  /** Domain event type defined */
  event: boolean;
  /** Reducer handler implemented */
  reducer: boolean;
  /** Projection layer derives state */
  projection: boolean;
  /** 3D render component exists */
  render: boolean;
  /** Sound effect wired */
  sound?: boolean;
  /** AI can trigger this action */
  ai?: boolean;
}

/**
 * Tracks end-to-end completeness per feature.
 * Update this as features are wired.
 */
export const FEATURE_MATRIX: Record<string, FeatureMatrixRow> = {
  // Core gameplay
  rollDice:         { fe: true,  event: true,  reducer: true,  projection: true,  render: true,  sound: true,  ai: true  },
  buildRoad:        { fe: true,  event: true,  reducer: true,  projection: true,  render: true,  sound: true,  ai: true  },
  buildSettlement:  { fe: true,  event: true,  reducer: true,  projection: true,  render: true,  sound: true,  ai: true  },
  upgradeCity:      { fe: true,  event: true,  reducer: true,  projection: true,  render: true,  sound: true,  ai: true  },
  bankTrade:        { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: true,  ai: true  },
  domesticTrade:    { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: true,  ai: true  },
  devCards:         { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: true,  ai: true  },
  robber:           { fe: true,  event: true,  reducer: true,  projection: true,  render: true,  sound: true,  ai: true  },
  longestRoad:      { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: false, ai: false },
  largestArmy:      { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: false, ai: false },
  winCondition:     { fe: true,  event: true,  reducer: true,  projection: true,  render: false, sound: true,  ai: false },
  // Visual
  terrain3D:        { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  postProcessing:   { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  hdrEnvironment:   { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  windShaders:      { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  resourceFlow3D:   { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  // HUD features
  tutorial:         { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  rulesReference:   { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  gameChat:         { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  diceHistory:      { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  saveLoad:         { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  replayControls:   { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  zoomControls:     { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  keyboardControls: { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  resourceNotif:    { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  tradeRating:      { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: true  },
  // Board generation
  variableBoards:   { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  constraintSolver: { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  // AI
  aiMultiAction:    { fe: false, event: false, reducer: false, projection: false, render: false, sound: false, ai: true  },
  aiTradeProposal:  { fe: false, event: false, reducer: false, projection: false, render: false, sound: false, ai: true  },
  aiPreRollKnight:  { fe: false, event: false, reducer: false, projection: false, render: false, sound: false, ai: true  },
  // Telepresence / Immersion
  presence3D:       { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  avatarBar:        { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  settingsPanel:    { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  layoutMode:       { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  soundMute:        { fe: true,  event: false, reducer: false, projection: false, render: false, sound: true,  ai: false },
  // Game feedback
  vpCelebration:    { fe: true,  event: false, reducer: false, projection: true,  render: false, sound: false, ai: false },
  handLimitWarning: { fe: true,  event: false, reducer: false, projection: true,  render: false, sound: false, ai: false },
  leaderboard:      { fe: true,  event: false, reducer: false, projection: true,  render: false, sound: false, ai: false },
  txLog:            { fe: true,  event: false, reducer: false, projection: false, render: false, sound: false, ai: false },
  playerCardGrid:   { fe: true,  event: false, reducer: false, projection: true,  render: false, sound: false, ai: false },
  // Post-processing extras
  noiseFX:          { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  contactShadows:   { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  // XR
  vrXrSupport:      { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: false, ai: false },
  physicsDice:      { fe: true,  event: false, reducer: false, projection: false, render: true,  sound: true,  ai: false },
};
