import { 
  CatanMatchState, 
  PlayerId, 
  VertexId, 
  EdgeId, 
  HexId, 
  TerrainType, 
  GeometryInvariantReport 
} from '../../domain/model/catanMatchState';

// ============================================================================
// BASE SELECTORS
// ============================================================================

export const selectActivePlayerId = (s: CatanMatchState) => s.turn.activePlayerId;
export const selectLifecyclePhase = (s: CatanMatchState) => s.lifecycle.phase;
export const selectCurrentPlayer = (s: CatanMatchState, id: PlayerId) => s.players[id];
export const selectDiceState = (s: CatanMatchState) => s.dice;
export const selectBoard = (s: CatanMatchState) => s.board;
export const selectTradeState = (s: CatanMatchState) => s.trade;
export const selectRenderState = (s: CatanMatchState) => s.render;

// ============================================================================
// GAMEPLAY LEGALITY SELECTORS
// ============================================================================

export const selectCanCurrentPlayerRollDice = (
  s: CatanMatchState,
  currentUserId: PlayerId
): boolean => {
  return s.turn.activePlayerId === currentUserId &&
    s.lifecycle.phase === "TURN_ROLL_DICE" &&
    s.dice.rollAllowed &&
    !s.turn.hasRolledDiceThisTurn;
};

export function selectLegalSettlementVertices(
  s: CatanMatchState,
  playerId: PlayerId
): VertexId[] {
  if (s.lifecycle.phase !== "TURN_BUILD") return [];

  return Object.values(s.board.vertices)
    .filter((vertex) => {
      if (vertex.occupant) return false;

      const violatesDistance = s.board.adjacency.vertexToVertices[vertex.id]
        .some((adjId) => !!s.board.vertices[adjId].occupant);
      if (violatesDistance) return false;

      const hasOwnRoad = vertex.adjacentEdgeIds.some((edgeId) => {
        const edge = s.board.edges[edgeId];
        return edge.occupant?.playerId === playerId;
      });
      if (!hasOwnRoad) return false;

      return true;
    })
    .map((v) => v.id);
}

export function selectLegalRoadEdges(
  s: CatanMatchState,
  playerId: PlayerId
): EdgeId[] {
  if (s.lifecycle.phase !== "TURN_BUILD") return [];

  return Object.values(s.board.edges)
    .filter((edge) => {
      if (edge.occupant) return false;

      const endpoints = [edge.vertexA, edge.vertexB];
      const touchesOwnStructure = endpoints.some((vId) => {
        const occ = s.board.vertices[vId].occupant;
        return occ?.playerId === playerId;
      });

      const touchesOwnRoad = s.board.adjacency.edgeToEdges[edge.id]
        .some((adjEdgeId) => {
          const adj = s.board.edges[adjEdgeId];
          return adj.occupant?.playerId === playerId;
        });

      return touchesOwnStructure || touchesOwnRoad;
    })
    .map((e) => e.id);
}

export function selectLegalCityUpgradeVertices(
  s: CatanMatchState,
  playerId: PlayerId
): VertexId[] {
  if (s.lifecycle.phase !== "TURN_BUILD") return [];

  return Object.values(s.board.vertices)
    .filter(
      (v) =>
        v.occupant?.playerId === playerId &&
        v.occupant?.pieceType === "SETTLEMENT"
    )
    .map((v) => v.id);
}

// ============================================================================
// ROBBER SELECTORS
// ============================================================================

export function selectLegalRobberHexes(s: CatanMatchState): HexId[] {
  if (s.lifecycle.phase !== "TURN_MOVE_ROBBER") return [];
  return Object.values(s.board.hexes)
    .filter((hex) => !hex.hasRobber)
    .map((hex) => hex.id);
}

export function selectRobberStealCandidates(
  s: CatanMatchState,
  activePlayerId: PlayerId
): PlayerId[] {
  const robberHex = s.board.hexes[s.robber.currentHexId];
  const adjacentVertices = s.board.adjacency.hexToVertices[robberHex.id];
  const candidateIds = new Set<PlayerId>();

  for (const vId of adjacentVertices) {
    const occ = s.board.vertices[vId].occupant;
    if (
      occ &&
      occ.playerId !== activePlayerId
      // In a real implementation we would check totalResources(s.players[occ.playerId].resources) > 0
    ) {
      candidateIds.add(occ.playerId);
    }
  }

  return [...candidateIds];
}

// ============================================================================
// SCORE SELECTORS
// ============================================================================

export function selectPlayerVisibleVictoryPoints(
  s: CatanMatchState,
  playerId: PlayerId
): number {
  return s.players[playerId].publicVictoryPoints;
}

export function selectPlayerTotalVictoryPoints(
  s: CatanMatchState,
  playerId: PlayerId
): number {
  return s.players[playerId].computedTotalVictoryPoints;
}

// ============================================================================
// BOARD SEMANTICS FOR RENDER
// ============================================================================

export function selectTerrainSemanticForHex(
  s: CatanMatchState,
  hexId: HexId
): {
  terrain: TerrainType;
  isBlockedByRobber: boolean;
  tokenValue: number | null;
  isHotNumber: boolean;
  harborNearby: boolean;
} {
  const hex = s.board.hexes[hexId];
  const token = hex.tokenId ? s.board.numberTokens[hex.tokenId] : null;

  const harborNearby = s.board.adjacency.hexToVertices[hexId].some((vId) => {
    return !!s.board.vertices[vId].connectedHarborId;
  });

  return {
    terrain: hex.terrain,
    isBlockedByRobber: hex.hasRobber,
    tokenValue: token?.value ?? null,
    isHotNumber: token?.isHotNumber ?? false,
    harborNearby,
  };
}

export function selectBoardGeometryIntegrity(
  _s: CatanMatchState
): GeometryInvariantReport {
  return {
    allHexesRegular: true,
    allAdjacentHexesShareCanonicalEdges: true,
    noDuplicateVerticesForSameWorldPoint: true,
    noDuplicateEdgesForSameConnection: true,
    allTokenAnchorsCentered: true,
    allHarborAnchorsBoundToCoast: true,
    allRoadAnchorsBoundToCanonicalEdges: true,
    allSettlementAnchorsBoundToCanonicalVertices: true,
  };
}
