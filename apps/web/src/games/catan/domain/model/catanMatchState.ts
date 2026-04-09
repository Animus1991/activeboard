export type Brand<K, T> = K & { __brand: T };

export type MatchId = Brand<string, "MatchId">;
export type PlayerId = Brand<string, "PlayerId">;
export type HexId = Brand<string, "HexId">;
export type VertexId = Brand<string, "VertexId">;
export type EdgeId = Brand<string, "EdgeId">;
export type HarborId = Brand<string, "HarborId">;
export type EventId = Brand<string, "EventId">;
export type CommandId = Brand<string, "CommandId">;
export type DevCardId = Brand<string, "DevCardId">;
export type TokenId = Brand<string, "TokenId">;
export type EffectId = Brand<string, "EffectId">;

export type UnixMs = number;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type PlayerColor = "RED" | "BLUE" | "ORANGE" | "WHITE" | "GREEN" | "PURPLE";

export type TerrainType =
  | "FOREST"
  | "HILLS"
  | "MOUNTAINS"
  | "FIELDS"
  | "PASTURE"
  | "DESERT";

export type ResourceType =
  | "WOOD"
  | "BRICK"
  | "ORE"
  | "WHEAT"
  | "SHEEP";

export type DevCardType =
  | "KNIGHT"
  | "YEAR_OF_PLENTY"
  | "ROAD_BUILDING"
  | "MONOPOLY"
  | "VICTORY_POINT";

export type PieceType =
  | "ROAD"
  | "SETTLEMENT"
  | "CITY"
  | "ROBBER";

export type HarborTradeType =
  | { kind: "GENERIC_3_TO_1" }
  | { kind: "SPECIAL_2_TO_1"; resource: ResourceType };

export type GameMode = "BEGINNER_SETUP" | "VARIABLE_SETUP";

export type ResourceMap = Record<ResourceType, number>;

export interface BuildingCosts {
  road: ResourceMap;
  settlement: ResourceMap;
  city: ResourceMap;
  devCard: ResourceMap;
}

export interface PiecePool {
  roadsRemaining: number;
  settlementsRemaining: number;
  citiesRemaining: number;
}

export interface CatanMatchState {
  meta: MatchMetaState;
  rules: RulesConfigState;
  lifecycle: LifecycleState;
  board: BoardState;
  players: Record<PlayerId, PlayerState>;
  turn: TurnState;
  dice: DiceState;
  robber: RobberState;
  bank: BankState;
  developmentDeck: DevelopmentDeckState;
  specialCards: SpecialCardsState;
  trade: TradeState;
  build: BuildState;
  log: EventLogState;
  projections: ProjectionState;
  render: RenderState;
  diagnostics: DiagnosticsState;
}

export interface MatchMetaState {
  matchId: MatchId;
  createdAt: UnixMs;
  startedAt: UnixMs | null;
  endedAt: UnixMs | null;
  createdBy: PlayerId;
  gameVersion: string;
  rulesVersion: string;
  mode: GameMode;
  deterministicSeed: string;
  playerOrder: PlayerId[];
  clockwiseOrder: PlayerId[];
  reverseSetupOrder: PlayerId[];
}

export interface RulesConfigState {
  victoryPointsToWin: number;
  robberDiscardThresholdExclusive: number;
  minimumLongestRoadSegments: number;
  minimumLargestArmyKnights: number;
  maxRoadsPerPlayer: number;
  maxSettlementsPerPlayer: number;
  maxCitiesPerPlayer: number;
  boardHexCount: number;
  seaFramePieceCount: number;
  harborCount: number;
  numberTokenCount: number;
  numberTokenValuesAllowed: number[];
  buildingCosts: BuildingCosts;
  allowCombinedTradeBuildPhase: boolean;
}

export type LifecyclePhase =
  | "LOBBY"
  | "SETUP_ROUND_1_PLACE_SETTLEMENT"
  | "SETUP_ROUND_1_PLACE_ROAD"
  | "SETUP_ROUND_2_PLACE_SETTLEMENT"
  | "SETUP_ROUND_2_PLACE_ROAD"
  | "TURN_START"
  | "TURN_ROLL_DICE"
  | "TURN_RESOLVE_PRODUCTION"
  | "TURN_HANDLE_SEVEN_DISCARDS"
  | "TURN_MOVE_ROBBER"
  | "TURN_STEAL_RESOURCE"
  | "TURN_TRADE"
  | "TURN_BUILD"
  | "TURN_OPTIONAL_DEV_CARD"
  | "TURN_END"
  | "GAME_OVER";

export interface LifecycleState {
  phase: LifecyclePhase;
  status: "WAITING" | "ACTIVE" | "PAUSED" | "ENDED";
  phaseEnteredAt: UnixMs;
  phaseSequenceNumber: number;
}

export interface BoardState {
  frame: SeaFramePieceState[];
  harbors: Record<HarborId, HarborState>;
  hexes: Record<HexId, HexState>;
  numberTokens: Record<TokenId, NumberTokenState>;
  vertices: Record<VertexId, VertexState>;
  edges: Record<EdgeId, EdgeState>;
  adjacency: AdjacencyState;
  generation: BoardGenerationState;
}

export interface Transform3D {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface SeaFramePieceState {
  id: string;
  orderIndex: number;
  worldTransform: Transform3D;
  harborSockets: HarborId[];
}

export interface HexState {
  id: HexId;
  axialQ: number;
  axialR: number;
  terrain: TerrainType;
  resource: ResourceType | null;
  tokenId: TokenId | null;
  hasRobber: boolean;
  worldTransform: Transform3D;
  visualProfileId: string;
}

export interface NumberTokenState {
  id: TokenId;
  hexId: HexId;
  value: number;
  pips: number;
  isHotNumber: boolean;
  worldTransform: Transform3D;
}

export interface VertexState {
  id: VertexId;
  worldPosition: Vec3;
  adjacentHexIds: HexId[];
  adjacentEdgeIds: EdgeId[];
  occupant:
    | null
    | {
        playerId: PlayerId;
        pieceType: "SETTLEMENT" | "CITY";
      };
  isCoastal: boolean;
  connectedHarborId: HarborId | null;
  interactionAnchorId: string;
}

export interface EdgeState {
  id: EdgeId;
  worldTransform: Transform3D;
  vertexA: VertexId;
  vertexB: VertexId;
  adjacentHexIds: HexId[];
  occupant:
    | null
    | {
        playerId: PlayerId;
        pieceType: "ROAD";
      };
  isCoastal: boolean;
  interactionAnchorId: string;
}

export interface HarborState {
  id: HarborId;
  tradeType: HarborTradeType;
  connectedVertexIds: [VertexId, VertexId];
  worldTransform: Transform3D;
  visualProfileId: string;
}

export interface AdjacencyState {
  hexToVertices: Record<HexId, VertexId[]>;
  hexToEdges: Record<HexId, EdgeId[]>;
  vertexToVertices: Record<VertexId, VertexId[]>;
  vertexToEdges: Record<VertexId, EdgeId[]>;
  edgeToEdges: Record<EdgeId, EdgeId[]>;
}

export interface BoardGenerationState {
  generatedFromSeed: string;
  geometryProfile: "STRICT_CLASSIC_CATAN";
  coordinateSystem: "AXIAL_HEX";
  edgeLength: number;
  tileThickness: number;
  boardRadius: number;
}

export interface PlayerState {
  id: PlayerId;
  displayName: string;
  color: PlayerColor;
  connected: boolean;
  seatIndex: number;

  resources: ResourceMap;
  piecePool: PiecePool;

  developmentCardsInHand: DevelopmentCardState[];
  playedKnightsCount: number;
  hiddenVictoryPointCards: number;

  publicVictoryPoints: number;
  computedTotalVictoryPoints: number;

  ownedRoadEdgeIds: EdgeId[];
  ownedSettlementVertexIds: VertexId[];
  ownedCityVertexIds: VertexId[];
  controlledHarborIds: HarborId[];

  stats: PlayerStatsState;
}

export interface PlayerStatsState {
  roadsBuilt: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  totalResourcesProduced: number;
  totalTradesCompleted: number;
  totalCardsDiscardedToSeven: number;
}

export interface TurnState {
  activePlayerId: PlayerId;
  turnNumber: number;
  roundNumber: number;
  setupPlacementRound: 1 | 2 | null;

  hasRolledDiceThisTurn: boolean;
  hasPlayedDevelopmentCardThisTurn: boolean;

  pendingAction:
    | null
    | "PLACE_INITIAL_SETTLEMENT"
    | "PLACE_INITIAL_ROAD"
    | "ROLL_DICE"
    | "DISCARD_FOR_SEVEN"
    | "MOVE_ROBBER"
    | "STEAL_RESOURCE"
    | "RESPOND_TO_TRADE"
    | "BUILD"
    | "END_TURN";

  legalActionIds: string[];
}

export interface DiceState {
  rollAllowed: boolean;
  isRolling: boolean;
  currentAnimationId: string | null;
  lastRoll:
    | null
    | {
        dieA: number;
        dieB: number;
        total: number;
        rolledBy: PlayerId;
        rolledAt: UnixMs;
      };
}

export interface RobberState {
  currentHexId: HexId;
  awaitingMove: boolean;
  awaitingSteal: boolean;
  stealCandidatePlayerIds: PlayerId[];
}

export interface BankState {
  resources: ResourceMap;
  devCardsRemainingByType: Record<DevCardType, number>;
}

export interface DevelopmentDeckState {
  drawPile: DevelopmentCardState[];
  discardPile: DevelopmentCardState[];
}

export interface DevelopmentCardState {
  id: DevCardId;
  type: DevCardType;
  purchasedTurnNumber: number;
  revealed: boolean;
}

export interface SpecialCardsState {
  longestRoad: {
    holderPlayerId: PlayerId | null;
    length: number;
    eligible: boolean;
  };
  largestArmy: {
    holderPlayerId: PlayerId | null;
    playedKnightsRequiredMet: boolean;
  };
}

export interface TradeState {
  domestic: {
    activeOffer: DomesticTradeOffer | null;
    history: DomesticTradeOffer[];
    isOpen: boolean;
  };
  maritime: {
    allowed: boolean;
    lastMaritimeTradeAt: UnixMs | null;
  };
}

export interface DomesticTradeOffer {
  id: string;
  proposedBy: PlayerId;
  proposedTo: PlayerId | "ALL";
  offer: Partial<ResourceMap>;
  request: Partial<ResourceMap>;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  createdAt: UnixMs;
  resolvedAt: UnixMs | null;
}

export interface BuildState {
  legalRoadEdgeIds: EdgeId[];
  legalSettlementVertexIds: VertexId[];
  legalCityUpgradeVertexIds: VertexId[];
  canBuyDevelopmentCard: boolean;
  preview:
    | null
    | {
        kind: "ROAD" | "SETTLEMENT" | "CITY";
        targetId: EdgeId | VertexId;
      };
}

export interface EventLogState {
  sequence: number;
  events: CatanDomainEventEnvelope[];
}

export interface ProjectionState {
  ui: UIProjectionState;
  interaction: InteractionProjectionState;
  render: RenderProjectionState;
  audio: AudioProjectionState;
  camera: CameraProjectionState;
}

export interface VisibleActionButton {
  id: string;
  label: string;
  icon?: string;
  actionPayload: any;
  enabled: boolean;
  reasonDisabled?: string;
}

export interface UIProjectionState {
  visibleActionButtons: VisibleActionButton[];
  activePrompt:
    | null
    | {
        title: string;
        body: string;
        severity: "INFO" | "WARNING" | "ERROR";
      };
  dicePanel: {
    visible: boolean;
    canRoll: boolean;
    lastRollLabel: string | null;
  };
  tradePanel: {
    visible: boolean;
    canPropose: boolean;
    activeOfferId: string | null;
  };
  devCardPanel: {
    visible: boolean;
    playableCardIds: DevCardId[];
  };
}

export interface InteractionProjectionState {
  highlightedVertexIds: VertexId[];
  highlightedEdgeIds: EdgeId[];
  hoveredEntityId: string | null;
  selectedEntityId: string | null;
  clickMode:
    | "NONE"
    | "PLACE_SETTLEMENT"
    | "PLACE_ROAD"
    | "MOVE_ROBBER"
    | "CHOOSE_STEAL_TARGET";
}

export interface RenderProjectionState {
  dirtyFlags: RenderDirtyFlags;
  visibleBoardDecorLayers: string[];
  tokenHighlightHexIds: HexId[];
  settlementGhosts: VertexId[];
  roadGhosts: EdgeId[];
  robberFocusHexId: HexId | null;
}

export interface AudioCue {
  id: string;
  soundId: string;
  volume: number;
  pan: number;
}

export interface AudioProjectionState {
  pendingCues: AudioCue[];
}

export interface CameraProjectionState {
  targetMode: "TACTICAL" | "FOCUS_DICE" | "FOCUS_BUILD" | "FOCUS_ROBBER" | "FOCUS_SPECIAL_CARD";
  focusEntityId: string | null;
}

export interface RenderState {
  boardMaterialProfile: "CLASSIC" | "PREMIUM_PAINTED" | "HYPERREAL_TABLETOP";
  lightingProfile: "NEUTRAL_TABLE" | "WARM_SHOWROOM" | "CINEMATIC_AMBER";
  terrainVisuals: Record<HexId, TerrainVisualState>;
  numberTokenVisuals: Record<TokenId, NumberTokenVisualState>;
  harborVisuals: Record<HarborId, HarborVisualState>;
  pieceVisuals: Record<string, PieceVisualState>;
  diceVisualState: DiceVisualState;
  sceneDirty: boolean;
}

export interface TerrainVisualState {
  hexId: HexId;
  terrain: TerrainType;
  materialPresetId: string;
  microScatterPresetId: string;
  displacementPresetId: string;
  needsRebuild: boolean;
}

export interface NumberTokenVisualState {
  tokenId: TokenId;
  number: number;
  pipCount: number;
  typographyPresetId: string;
  placementMode: "SURFACE_SEATED" | "RECESSED";
  needsRebuild: boolean;
}

export interface HarborVisualState {
  harborId: HarborId;
  modelPresetId: string;
  signagePresetId: string;
  needsRebuild: boolean;
}

export interface PieceVisualState {
  entityId: string;
  pieceType: PieceType | "NUMBER_TOKEN";
  modelPresetId: string;
  materialPresetId: string;
  currentAnimation: string | null;
  needsTransformSync: boolean;
}

export interface DiceVisualState {
  visible: boolean;
  modelPresetId: string;
  isAnimating: boolean;
  pendingRoll:
    | null
    | {
        dieA: number;
        dieB: number;
      };
}

export interface RenderDirtyFlags {
  boardTopologyDirty: boolean;
  terrainVisualsDirty: HexId[];
  numberTokensDirty: TokenId[];
  harborVisualsDirty: HarborId[];
  pieceTransformsDirty: string[];
  diceVisualDirty: boolean;
  lightingDirty: boolean;
  cameraDirty: boolean;
  fullSceneRebuildRequired: boolean;
}

export interface DiagnosticsState {
  validationErrors: string[];
  lastReducerRuntimeMs: number;
  lastProjectionRuntimeMs: number;
  lastRenderSyncRuntimeMs: number;
  geometryIntegrityPassed: boolean;
}

export interface GeometryInvariantReport {
  allHexesRegular: boolean;
  allAdjacentHexesShareCanonicalEdges: boolean;
  noDuplicateVerticesForSameWorldPoint: boolean;
  noDuplicateEdgesForSameConnection: boolean;
  allTokenAnchorsCentered: boolean;
  allHarborAnchorsBoundToCoast: boolean;
  allRoadAnchorsBoundToCanonicalEdges: boolean;
  allSettlementAnchorsBoundToCanonicalVertices: boolean;
}

export interface CatanDomainEvent {
  type: string;
  [key: string]: any;
}

export interface CatanDomainEventEnvelope {
  eventId: EventId;
  sequence: number;
  emittedAt: UnixMs;
  causedByCommandId: CommandId | null;
  causedByPlayerId: PlayerId | null;
  event: CatanDomainEvent;
}
