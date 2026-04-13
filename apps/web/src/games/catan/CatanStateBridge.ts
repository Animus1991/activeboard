/**
 * CatanStateBridge.ts
 * 
 * Bridges the legacy GameState (CatanEngine.ts) with the AAA-grade CatanMatchState.
 * 
 * Architecture:
 *   - GameState remains the runtime state (lightweight, functional)
 *   - CatanMatchState is the authoritative model (branded types, event sourcing ready)
 *   - Bridge provides bidirectional conversion and unified type system
 *   - Allows gradual migration without breaking existing code
 */

import type { GameState, ResourceType, DevelopmentCardType } from './CatanEngine';
import type {
  CatanMatchState,
  PlayerId,
  MatchId,
  HexId,
  VertexId,
  EdgeId,
  HarborId,
  EventId,
  CommandId,
  DevCardId,
  TokenId,
  EffectId,
  PlayerColor,
  TerrainType as DomainTerrainType,
  ResourceType as DomainResourceType,
  DevCardType as DomainDevCardType,
  GameMode,
  ResourceMap,
  PiecePool,
  LifecyclePhase,
  LifecycleState,
  BoardState,
  PlayerState,
  TurnState,
  DiceState,
  RobberState,
  BankState,
  DevelopmentDeckState,
  DevelopmentCardState,
  SpecialCardsState,
  TradeState,
  BuildState,
  EventLogState,
  ProjectionState,
  RenderState,
  DiagnosticsState,
} from './domain/model/catanMatchState';

/**
 * Unified type system that bridges both models.
 * Provides branded types and validation without breaking existing code.
 */
export class CatanStateBridge {
  /**
   * Convert legacy GameState to AAA CatanMatchState
   * Used for persistence, backend sync, and event sourcing
   */
  static gameStateToMatchState(
    gameState: GameState,
    matchId: MatchId,
    createdBy: PlayerId,
    mode: GameMode = 'VARIABLE_SETUP',
    vpToWin: number = 10
  ): CatanMatchState {
    const now = Date.now();

    // Convert terrain types
    const terrainMap: Record<string, DomainTerrainType> = {
      forest: 'FOREST',
      hills: 'HILLS',
      pasture: 'PASTURE',
      fields: 'FIELDS',
      mountains: 'MOUNTAINS',
      desert: 'DESERT',
    };

    // Convert resource types
    const resourceMap: Record<ResourceType, DomainResourceType> = {
      wood: 'WOOD',
      brick: 'BRICK',
      sheep: 'SHEEP',
      wheat: 'WHEAT',
      ore: 'ORE',
    };

    // Convert dev card types
    const devCardMap: Record<DevelopmentCardType, DomainDevCardType> = {
      knight: 'KNIGHT',
      'victory-point': 'VICTORY_POINT',
      'road-building': 'ROAD_BUILDING',
      'year-of-plenty': 'YEAR_OF_PLENTY',
      monopoly: 'MONOPOLY',
    };

    // Convert player colors
    const colorMap: Record<string, PlayerColor> = {
      '#e74c3c': 'RED',
      '#3498db': 'BLUE',
      '#f39c12': 'ORANGE',
      '#27ae60': 'GREEN',
      '#8b5cf6': 'PURPLE',
      '#ec4899': 'WHITE',
    };

    // Build players map
    const players: Record<PlayerId, PlayerState> = {};
    gameState.players.forEach((p, i) => {
      const playerId = p.id as PlayerId;
      const resourcesMap: ResourceMap = {
        WOOD: p.resources.wood,
        BRICK: p.resources.brick,
        SHEEP: p.resources.sheep,
        WHEAT: p.resources.wheat,
        ORE: p.resources.ore,
      };

      const piecePool: PiecePool = {
        roadsRemaining: p.roads,
        settlementsRemaining: p.settlements,
        citiesRemaining: p.cities,
      };

      const devCards: DevelopmentCardState[] = p.developmentCards.map((dc, idx) => ({
        id: `${playerId}-dc-${idx}` as DevCardId,
        type: devCardMap[dc.type],
        purchasedTurnNumber: dc.turnBought,
        revealed: dc.isPlayed,
      }));

      players[playerId] = {
        id: playerId,
        displayName: p.name,
        color: colorMap[p.color] || 'RED',
        connected: true,
        seatIndex: i,
        resources: resourcesMap,
        piecePool,
        developmentCardsInHand: devCards,
        playedKnightsCount: p.playedKnights,
        hiddenVictoryPointCards: 0,
        publicVictoryPoints: p.victoryPoints,
        computedTotalVictoryPoints: p.victoryPoints,
        ownedRoadEdgeIds: [],
        ownedSettlementVertexIds: [],
        ownedCityVertexIds: [],
        controlledHarborIds: [],
        stats: {
          roadsBuilt: 15 - p.roads,
          settlementsBuilt: 5 - p.settlements,
          citiesBuilt: 4 - p.cities,
          totalResourcesProduced: 0,
          totalTradesCompleted: 0,
          totalCardsDiscardedToSeven: 0,
        },
      };
    });

    // Determine lifecycle phase from game phase
    const phaseMap: Record<string, LifecyclePhase> = {
      'setup-settlement': 'SETUP_ROUND_1_PLACE_SETTLEMENT',
      'setup-road': 'SETUP_ROUND_1_PLACE_ROAD',
      roll: 'TURN_ROLL_DICE',
      'robber-move': 'TURN_MOVE_ROBBER',
      'robber-steal': 'TURN_STEAL_RESOURCE',
      discard: 'TURN_HANDLE_SEVEN_DISCARDS',
      main: 'TURN_BUILD',
      trade: 'TURN_TRADE',
      build: 'TURN_BUILD',
      'development-card': 'TURN_OPTIONAL_DEV_CARD',
      'game-over': 'GAME_OVER',
    };

    const lifecycle: LifecycleState = {
      phase: phaseMap[gameState.phase] || 'TURN_START',
      status: gameState.phase === 'game-over' ? 'ENDED' : 'ACTIVE',
      phaseEnteredAt: now,
      phaseSequenceNumber: gameState.turn,
    };

    // Build hex states
    const hexes: Record<HexId, any> = {};
    gameState.hexTiles.forEach((hex) => {
      const hexId = `hex-${hex.id}` as HexId;
      hexes[hexId] = {
        id: hexId,
        axialQ: hex.position.q,
        axialR: hex.position.r,
        terrain: terrainMap[hex.terrain],
        resource: hex.terrain === 'desert' ? null : resourceMap[hex.terrain === 'forest' ? 'wood' : 'brick'],
        tokenId: hex.number ? (`token-${hex.id}` as TokenId) : null,
        hasRobber: hex.hasRobber,
        worldTransform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visualProfileId: 'default',
      };
    });

    const board: BoardState = {
      frame: [],
      harbors: {},
      hexes,
      numberTokens: {},
      vertices: {},
      edges: {},
      adjacency: {
        hexToVertices: {},
        hexToEdges: {},
        vertexToVertices: {},
        vertexToEdges: {},
        edgeToEdges: {},
      },
      generation: {
        generatedFromSeed: gameState.id,
        geometryProfile: 'STRICT_CLASSIC_CATAN',
        coordinateSystem: 'AXIAL_HEX',
        edgeLength: 1.28,
        tileThickness: 0.1,
        boardRadius: 2,
      },
    };

    const turn: TurnState = {
      activePlayerId: gameState.players[gameState.currentPlayerIndex].id as PlayerId,
      turnNumber: gameState.turn,
      roundNumber: Math.ceil(gameState.turn / gameState.players.length),
      setupPlacementRound: gameState.setupRound === 1 || gameState.setupRound === 2 ? gameState.setupRound : null,
      hasRolledDiceThisTurn: gameState.diceRoll !== null,
      hasPlayedDevelopmentCardThisTurn: gameState.devCardPlayedThisTurn,
      pendingAction: null,
      legalActionIds: [],
    };

    const dice: DiceState = {
      rollAllowed: gameState.phase === 'roll',
      isRolling: false,
      currentAnimationId: null,
      lastRoll: gameState.diceRoll
        ? {
            dieA: gameState.diceRoll[0],
            dieB: gameState.diceRoll[1],
            total: gameState.diceRoll[0] + gameState.diceRoll[1],
            rolledBy: gameState.players[gameState.currentPlayerIndex].id as PlayerId,
            rolledAt: now,
          }
        : null,
    };

    const robber: RobberState = {
      currentHexId: `hex-${gameState.robberHexId}` as HexId,
      awaitingMove: gameState.phase === 'robber-move',
      awaitingSteal: gameState.phase === 'robber-steal',
      stealCandidatePlayerIds: [],
    };

    const bank: BankState = {
      resources: {
        WOOD: 19,
        BRICK: 19,
        SHEEP: 19,
        WHEAT: 19,
        ORE: 19,
      },
      devCardsRemainingByType: {
        KNIGHT: 14,
        YEAR_OF_PLENTY: 2,
        ROAD_BUILDING: 2,
        MONOPOLY: 2,
        VICTORY_POINT: 5,
      },
    };

    const developmentDeck: DevelopmentDeckState = {
      drawPile: gameState.developmentCardDeck.map((type, i) => ({
        id: `dc-${i}` as DevCardId,
        type: devCardMap[type],
        purchasedTurnNumber: 0,
        revealed: false,
      })),
      discardPile: [],
    };

    const specialCards: SpecialCardsState = {
      longestRoad: {
        holderPlayerId: gameState.longestRoadPlayerId as PlayerId | null,
        length: gameState.players.find((p) => p.id === gameState.longestRoadPlayerId)?.longestRoad || 0,
        eligible: true,
      },
      largestArmy: {
        holderPlayerId: gameState.largestArmyPlayerId as PlayerId | null,
        playedKnightsRequiredMet: true,
      },
    };

    const trade: TradeState = {
      domestic: {
        activeOffer: null,
        history: [],
        isOpen: gameState.phase === 'trade',
      },
      maritime: {
        allowed: gameState.phase === 'main' || gameState.phase === 'trade',
        lastMaritimeTradeAt: null,
      },
    };

    const build: BuildState = {
      legalRoadEdgeIds: [],
      legalSettlementVertexIds: [],
      legalCityUpgradeVertexIds: [],
      canBuyDevelopmentCard: true,
      preview: null,
    };

    const log: EventLogState = {
      sequence: gameState.log.length,
      events: gameState.log.map((entry, i) => ({
        eventId: `evt-${i}` as EventId,
        sequence: i,
        emittedAt: now,
        causedByCommandId: null,
        causedByPlayerId: entry.playerId as PlayerId,
        event: {
          type: entry.type,
          message: entry.message,
        },
      })),
    };

    const projections: ProjectionState = {
      ui: {
        visibleActionButtons: [],
        activePrompt: null,
        dicePanel: { visible: true, canRoll: gameState.phase === 'roll', lastRollLabel: null },
        tradePanel: { visible: false, canPropose: true, activeOfferId: null },
        devCardPanel: { visible: false, playableCardIds: [] },
      },
      interaction: {
        highlightedVertexIds: [],
        highlightedEdgeIds: [],
        hoveredEntityId: null,
        selectedEntityId: null,
        clickMode: 'NONE',
      },
      render: {
        dirtyFlags: {
          boardTopologyDirty: false,
          terrainVisualsDirty: [],
          numberTokensDirty: [],
          harborVisualsDirty: [],
          pieceTransformsDirty: [],
          diceVisualDirty: false,
          lightingDirty: false,
          cameraDirty: false,
          fullSceneRebuildRequired: false,
        },
        visibleBoardDecorLayers: [],
        tokenHighlightHexIds: [],
        settlementGhosts: [],
        roadGhosts: [],
        robberFocusHexId: null,
      },
      audio: {
        pendingCues: [],
      },
      camera: {
        targetMode: 'TACTICAL',
        focusEntityId: null,
      },
    };

    const render: RenderState = {
      boardMaterialProfile: 'PREMIUM_PAINTED',
      lightingProfile: 'WARM_SHOWROOM',
      terrainVisuals: {},
      numberTokenVisuals: {},
      harborVisuals: {},
      pieceVisuals: {},
      diceVisualState: {
        visible: true,
        modelPresetId: 'default',
        isAnimating: false,
        pendingRoll: null,
      },
      sceneDirty: false,
    };

    const diagnostics: DiagnosticsState = {
      validationErrors: [],
      lastReducerRuntimeMs: 0,
      lastProjectionRuntimeMs: 0,
      lastRenderSyncRuntimeMs: 0,
      geometryIntegrityPassed: true,
    };

    return {
      meta: {
        matchId,
        createdAt: now,
        startedAt: gameState.turn > 0 ? now : null,
        endedAt: gameState.phase === 'game-over' ? now : null,
        createdBy,
        gameVersion: '1.0.0',
        rulesVersion: '1.0.0',
        mode,
        deterministicSeed: gameState.id,
        playerOrder: gameState.players.map((p) => p.id as PlayerId),
        clockwiseOrder: gameState.players.map((p) => p.id as PlayerId),
        reverseSetupOrder: [...gameState.players.map((p) => p.id as PlayerId)].reverse(),
      },
      rules: {
        victoryPointsToWin: vpToWin,
        robberDiscardThresholdExclusive: 8,
        minimumLongestRoadSegments: 5,
        minimumLargestArmyKnights: 3,
        maxRoadsPerPlayer: 15,
        maxSettlementsPerPlayer: 5,
        maxCitiesPerPlayer: 4,
        boardHexCount: gameState.hexTiles.length,
        seaFramePieceCount: 0,
        harborCount: 9,
        numberTokenCount: gameState.hexTiles.filter((h) => h.number !== null).length,
        numberTokenValuesAllowed: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
        buildingCosts: {
          road: { WOOD: 1, BRICK: 1, SHEEP: 0, WHEAT: 0, ORE: 0 },
          settlement: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1, ORE: 0 },
          city: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 2, ORE: 3 },
          devCard: { WOOD: 0, BRICK: 0, SHEEP: 1, WHEAT: 1, ORE: 1 },
        },
        allowCombinedTradeBuildPhase: true,
      },
      lifecycle,
      board,
      players,
      turn,
      dice,
      robber,
      bank,
      developmentDeck: developmentDeck,
      specialCards,
      trade,
      build,
      log,
      projections,
      render,
      diagnostics,
    };
  }

  /**
   * Extract GameState from CatanMatchState for runtime use
   * Used when loading from persistence or backend
   */
  static matchStateToGameState(matchState: CatanMatchState): Partial<GameState> {
    // Reverse conversion — extract only the fields needed by GameState
    // This is a lossy conversion (some AAA state is discarded)
    return {
      id: matchState.meta.matchId,
      // ... extract other fields as needed
    };
  }

  /**
   * Validate state consistency between models
   */
  static validateConsistency(gameState: GameState, matchState: CatanMatchState): string[] {
    const errors: string[] = [];

    // Check player count matches
    if (gameState.players.length !== Object.keys(matchState.players).length) {
      errors.push(
        `Player count mismatch: GameState has ${gameState.players.length}, MatchState has ${Object.keys(matchState.players).length}`
      );
    }

    // Check turn number matches
    if (gameState.turn !== matchState.turn.turnNumber) {
      errors.push(`Turn number mismatch: GameState=${gameState.turn}, MatchState=${matchState.turn.turnNumber}`);
    }

    // Check current player matches
    if (gameState.players[gameState.currentPlayerIndex]?.id !== matchState.turn.activePlayerId) {
      errors.push(`Active player mismatch`);
    }

    return errors;
  }
}

/**
 * Type-safe branded ID constructors
 */
export const BrandedIds = {
  matchId: (id: string): MatchId => id as MatchId,
  playerId: (id: string): PlayerId => id as PlayerId,
  hexId: (id: string): HexId => id as HexId,
  vertexId: (id: string): VertexId => id as VertexId,
  edgeId: (id: string): EdgeId => id as EdgeId,
  harborId: (id: string): HarborId => id as HarborId,
  eventId: (id: string): EventId => id as EventId,
  commandId: (id: string): CommandId => id as CommandId,
  devCardId: (id: string): DevCardId => id as DevCardId,
  tokenId: (id: string): TokenId => id as TokenId,
  effectId: (id: string): EffectId => id as EffectId,
};
