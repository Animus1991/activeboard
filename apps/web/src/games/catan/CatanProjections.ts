/**
 * Catan Projection Layer
 *
 * Pure functions that DERIVE state for UI, gameplay gating, and render from
 * the authoritative GameState.  Nothing in this file mutates state.
 *
 * Five projection types:
 *   1. GameplayProjection  — what the active player may do right now
 *   2. UIProjection        — which panels / buttons / banners are visible
 *   3. BuildLegalTargets   — legal vertex/edge ids for each build type
 *   4. RenderDirtyFlags    — what changed between two GameState snapshots
 *   5. Resource helpers    — VP breakdown, maritime rates, production score
 */

import {
  type GameState,
  type ResourceType,
  canBuildSettlement,
  canBuildCity,
  canBuildRoad,
  canBuyDevelopmentCard,
  hasResources,
  getTotalResources,
  BUILDING_COSTS,
} from './CatanEngine';

import {
  type LifecyclePhase,
  type RenderDirtyFlags,
  gamePhaseToLifecycle,
  lifecycleLabel,
} from './CatanStateTree';

// ============================================================
// 1. GAMEPLAY PROJECTION
// What actions are available to a given player right now
// ============================================================

export interface GameplayProjection {
  /** Is this player the active (current-turn) player? */
  isActiveTurn: boolean;
  canRoll:             boolean;
  canEndTurn:          boolean;
  canBuild:            boolean;
  canTrade:            boolean;
  canPlayDevCard:      boolean;
  canPlayKnight:       boolean;
  canPlayRoadBuilding: boolean;
  canPlayYearOfPlenty: boolean;
  canPlayMonopoly:     boolean;
  mustDiscard:         boolean;
  mustMoveRobber:      boolean;
  mustSteal:           boolean;
  freeRoadsRemaining:  number;
  devCardPlayedThisTurn: boolean;
  lifecycle:           LifecyclePhase;
}

export function computeGameplayProjection(
  state: GameState,
  playerId: string,
): GameplayProjection {
  const player      = state.players.find(p => p.id === playerId);
  const activeId    = state.players[state.currentPlayerIndex]?.id;
  const isActiveTurn = activeId === playerId;
  const phase       = state.phase;
  const lifecycle   = gamePhaseToLifecycle(phase);

  const playableCard = (type: string) =>
    player?.developmentCards.some(
      c => !c.isPlayed && c.type === type && c.turnBought < state.turn
    ) ?? false;

  return {
    isActiveTurn,
    canRoll:             isActiveTurn && phase === 'roll',
    canEndTurn:          isActiveTurn && phase === 'main',
    canBuild:            isActiveTurn && (phase === 'main' || phase === 'build'),
    canTrade:            isActiveTurn && phase === 'main',
    canPlayDevCard:      isActiveTurn && !state.devCardPlayedThisTurn &&
                           (phase === 'roll' || phase === 'main'),
    canPlayKnight:       isActiveTurn && !state.devCardPlayedThisTurn &&
                           playableCard('knight') &&
                           (phase === 'roll' || phase === 'main'),
    canPlayRoadBuilding: isActiveTurn && !state.devCardPlayedThisTurn &&
                           playableCard('road-building') && phase === 'main',
    canPlayYearOfPlenty: isActiveTurn && !state.devCardPlayedThisTurn &&
                           playableCard('year-of-plenty') && phase === 'main',
    canPlayMonopoly:     isActiveTurn && !state.devCardPlayedThisTurn &&
                           playableCard('monopoly') && phase === 'main',
    mustDiscard:         phase === 'discard' &&
                           state.discardingPlayerIndex !== null &&
                           state.players[state.discardingPlayerIndex]?.id === playerId,
    mustMoveRobber:      isActiveTurn && phase === 'robber-move',
    mustSteal:           isActiveTurn && phase === 'robber-steal',
    freeRoadsRemaining:  state.freeRoadsRemaining,
    devCardPlayedThisTurn: state.devCardPlayedThisTurn,
    lifecycle,
  };
}

// ============================================================
// 2. UI PROJECTION
// Which panels, buttons, banners should be rendered
// ============================================================

export interface UIProjection {
  showRollButton:       boolean;
  showDicePanel:        boolean;
  showBuildPanel:       boolean;
  showTradeButton:      boolean;
  showEndTurnButton:    boolean;
  showDevCardPanel:     boolean;
  showDiscardPanel:     boolean;
  showRobberMovePanel:  boolean;
  showStealPanel:       boolean;
  showSetupPrompt:      boolean;
  showFreeRoadBanner:   boolean;
  showRobberWarning:    boolean;
  showProductionSummary: boolean;
  phaseLabel:           string;
  phaseDescription:     string;
  lifecyclePhase:       LifecyclePhase;
  /** True when the player MUST take an action before doing anything else */
  actionRequired:       boolean;
}

export function computeUIProjection(
  state: GameState,
  playerId: string,
): UIProjection {
  const proj  = computeGameplayProjection(state, playerId);
  const phase = state.phase;
  const isActive = proj.isActiveTurn;

  const phaseDescriptions: Record<string, string> = {
    'setup-settlement': 'Click a valid intersection to place your settlement',
    'setup-road':       'Click a valid edge adjacent to your last settlement',
    'roll':             'Roll the dice to start your turn',
    'discard':          'You must discard half your resource cards',
    'robber-move':      'Click a terrain hex to move the robber',
    'robber-steal':     'Choose a player to steal one resource from',
    'main':             'Build, trade, play dev cards, or end your turn',
    'game-over':        '',
  };

  return {
    showRollButton:       proj.canRoll,
    showDicePanel:        state.diceRoll !== null,
    showBuildPanel:       proj.canBuild,
    showTradeButton:      proj.canTrade,
    showEndTurnButton:    proj.canEndTurn,
    showDevCardPanel:     isActive && (phase === 'roll' || phase === 'main'),
    showDiscardPanel:     proj.mustDiscard,
    showRobberMovePanel:  proj.mustMoveRobber,
    showStealPanel:       proj.mustSteal,
    showSetupPrompt:      isActive && (phase === 'setup-settlement' || phase === 'setup-road'),
    showFreeRoadBanner:   proj.freeRoadsRemaining > 0,
    showRobberWarning:    state.diceRoll !== null &&
                            state.diceRoll[0] + state.diceRoll[1] === 7,
    showProductionSummary: state.diceRoll !== null && phase === 'main' &&
                            state.diceRoll[0] + state.diceRoll[1] !== 7,
    phaseLabel:           lifecycleLabel(proj.lifecycle),
    phaseDescription:     phaseDescriptions[phase] ?? '',
    lifecyclePhase:       proj.lifecycle,
    actionRequired:       isActive && phase !== 'main',
  };
}

// ============================================================
// 3. BUILD LEGAL TARGETS
// Valid vertex/edge IDs for each build action
// ============================================================

export interface BuildLegalTargets {
  settlementVertices: string[];
  roadEdges:          string[];
  cityVertices:       string[];
  canBuyDevCard:      boolean;
}

export function computeBuildLegalTargets(
  state: GameState,
  playerId: string,
  isSetup = false,
): BuildLegalTargets {
  return {
    settlementVertices: state.vertices
      .filter(v => canBuildSettlement(state, playerId, v.id, isSetup))
      .map(v => v.id),
    roadEdges: state.edges
      .filter(e => canBuildRoad(state, playerId, e.id, isSetup))
      .map(e => e.id),
    cityVertices: state.vertices
      .filter(v => canBuildCity(state, playerId, v.id))
      .map(v => v.id),
    canBuyDevCard: canBuyDevelopmentCard(state, playerId),
  };
}

// ============================================================
// 4. RENDER DIRTY FLAGS
// What changed between two GameState snapshots
// ============================================================

export function computeRenderDirtyFlags(
  prev: GameState | null,
  next: GameState,
): RenderDirtyFlags {
  if (!prev) {
    return {
      boardGeometryDirty:    true,
      terrainMaterialsDirty: next.hexTiles.map(h => h.id),
      tokenPlacementDirty:   next.hexTiles.map(h => h.id),
      piecePlacementDirty:   [],
      robberDirty:           true,
      lightingDirty:         true,
      cameraDirty:           true,
    };
  }

  const terrainMaterialsDirty: number[] = [];
  const tokenPlacementDirty: number[]   = [];
  const piecePlacementDirty: string[]   = [];

  next.hexTiles.forEach(hex => {
    const p = prev.hexTiles.find(h => h.id === hex.id);
    if (!p || p.hasRobber !== hex.hasRobber) tokenPlacementDirty.push(hex.id);
  });

  next.vertices.forEach(v => {
    const p = prev.vertices.find(pv => pv.id === v.id);
    if (!p || JSON.stringify(p.building) !== JSON.stringify(v.building))
      piecePlacementDirty.push(v.id);
  });

  next.edges.forEach(e => {
    const p = prev.edges.find(pe => pe.id === e.id);
    if (!p || JSON.stringify(p.road) !== JSON.stringify(e.road))
      piecePlacementDirty.push(e.id);
  });

  return {
    boardGeometryDirty:    false,
    terrainMaterialsDirty,
    tokenPlacementDirty,
    piecePlacementDirty,
    robberDirty:  prev.robberHexId !== next.robberHexId,
    lightingDirty: false,
    cameraDirty:  prev.phase !== next.phase,
  };
}

// ============================================================
// 5. RESOURCE HELPERS
// ============================================================

// ── VP Breakdown ──────────────────────────────────────────

export interface VPBreakdown {
  settlements:  number;
  cities:       number;
  longestRoad:  number; // 0 or 2
  largestArmy:  number; // 0 or 2
  devCardVP:    number;
  total:        number;
  isWinning:    boolean;
}

export function computeVPBreakdown(
  state: GameState,
  playerId: string,
  vpToWin = 10,
): VPBreakdown {
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return { settlements: 0, cities: 0, longestRoad: 0, largestArmy: 0, devCardVP: 0, total: 0, isWinning: false };
  }

  const settlements = state.vertices.filter(
    v => v.building?.playerId === playerId && v.building.type === 'settlement'
  ).length;

  const cities = state.vertices.filter(
    v => v.building?.playerId === playerId && v.building.type === 'city'
  ).length;

  const longestRoad = player.hasLongestRoad ? 2 : 0;
  const largestArmy = player.hasLargestArmy ? 2 : 0;
  const devCardVP   = player.developmentCards.filter(c => c.type === 'victory-point').length;
  const total       = settlements + cities * 2 + longestRoad + largestArmy + devCardVP;

  return { settlements, cities, longestRoad, largestArmy, devCardVP, total, isWinning: total >= vpToWin };
}

// ── Maritime Trade Rates ──────────────────────────────────

export type MaritimeRates = Record<ResourceType, 2 | 3 | 4>;

export function computeMaritimeRates(state: GameState, playerId: string): MaritimeRates {
  const rates: MaritimeRates = { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 };

  state.vertices
    .filter(v => v.building?.playerId === playerId && v.harbor)
    .forEach(v => {
      const h = v.harbor!;
      if (h === '3:1') {
        (Object.keys(rates) as ResourceType[]).forEach(r => {
          if (rates[r] > 3) rates[r] = 3;
        });
      } else {
        const r = h as ResourceType;
        if (r in rates) rates[r] = 2;
      }
    });

  return rates;
}

// ── Resource Summary ──────────────────────────────────────

export interface ResourceSummary {
  totalCards: number;
  canAfford: {
    road:       boolean;
    settlement: boolean;
    city:       boolean;
    devCard:    boolean;
  };
  maritimeRates: MaritimeRates;
}

export function computeResourceSummary(
  state: GameState,
  playerId: string,
): ResourceSummary {
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return {
      totalCards: 0,
      canAfford: { road: false, settlement: false, city: false, devCard: false },
      maritimeRates: { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 },
    };
  }

  return {
    totalCards: getTotalResources(player),
    canAfford: {
      road:       hasResources(player, BUILDING_COSTS.road),
      settlement: hasResources(player, BUILDING_COSTS.settlement),
      city:       hasResources(player, BUILDING_COSTS.city),
      devCard:    hasResources(player, { sheep: 1, wheat: 1, ore: 1 }),
    },
    maritimeRates: computeMaritimeRates(state, playerId),
  };
}

// ── Production Score (per-vertex probability) ─────────────

const ROLL_PROB: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export function hexRollPips(number: number | null): number {
  return number ? (ROLL_PROB[number] ?? 0) : 0;
}

export function vertexProductionScore(state: GameState, vertexId: string): number {
  const v = state.vertices.find(x => x.id === vertexId);
  if (!v) return 0;
  return v.hexIds.reduce((sum, hexId) => {
    const hex = state.hexTiles.find(h => h.id === hexId);
    return sum + hexRollPips(hex?.number ?? null);
  }, 0);
}

// ── Production Summary after a dice roll ─────────────────

export interface ProductionEntry {
  playerId:  string;
  playerName: string;
  resource:  ResourceType;
  amount:    number;
}

/**
 * Compute what each player receives on a given dice roll.
 * Returns an empty array when the robber blocks all production.
 */
export function computeProduction(
  state: GameState,
  diceTotal: number,
): ProductionEntry[] {
  if (diceTotal === 7) return [];

  const result: ProductionEntry[] = [];
  const TERRAIN_RESOURCES: Record<string, ResourceType | null> = {
    forest: 'wood', hills: 'brick', pasture: 'sheep',
    fields: 'wheat', mountains: 'ore', desert: null,
  };

  state.hexTiles
    .filter(h => h.number === diceTotal && !h.hasRobber)
    .forEach(hex => {
      const resource = TERRAIN_RESOURCES[hex.terrain];
      if (!resource) return;

      state.vertices
        .filter(v => v.hexIds.includes(hex.id) && v.building)
        .forEach(v => {
          const player = state.players.find(p => p.id === v.building!.playerId);
          if (!player) return;
          const amount = v.building!.type === 'city' ? 2 : 1;
          const existing = result.find(e => e.playerId === player.id && e.resource === resource);
          if (existing) existing.amount += amount;
          else result.push({ playerId: player.id, playerName: player.name, resource, amount });
        });
    });

  return result;
}

// ── Robber Steal Candidates ───────────────────────────────

/**
 * Returns the IDs of players with settlements/cities adjacent to the
 * robber hex (excluding the active player).  Falls back to all other
 * players if the robber hex cannot be found.
 */
export function computeStealCandidates(
  state: GameState,
  activePlayerId: string,
): string[] {
  const robberHex = state.hexTiles.find(h => h.id === state.robberHexId);
  if (!robberHex) {
    return state.players.filter(p => p.id !== activePlayerId).map(p => p.id);
  }

  const adjacent = new Set(
    state.vertices
      .filter(v =>
        v.hexIds.includes(robberHex.id) &&
        v.building &&
        v.building.playerId !== activePlayerId,
      )
      .map(v => v.building!.playerId),
  );

  return adjacent.size > 0
    ? [...adjacent]
    : state.players.filter(p => p.id !== activePlayerId).map(p => p.id);
}
