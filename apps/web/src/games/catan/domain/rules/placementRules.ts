import { CatanMatchState, PlayerId, VertexId, VertexState } from '../model/catanMatchState';

export function getLegalInitialSettlementVertices(
  state: CatanMatchState,
  _playerId: PlayerId
): VertexId[] {
  if (
    state.lifecycle.phase !== "SETUP_ROUND_1_PLACE_SETTLEMENT" &&
    state.lifecycle.phase !== "SETUP_ROUND_2_PLACE_SETTLEMENT"
  ) {
    return [];
  }

  return Object.values(state.board.vertices)
    .filter((vertex: VertexState) => {
      // Must be empty
      if (vertex.occupant) return false;

      // Distance rule: no adjacent vertex can have an occupant
      const violatesDistance = state.board.adjacency.vertexToVertices[vertex.id]
        .some((adjId: VertexId) => !!state.board.vertices[adjId].occupant);

      if (violatesDistance) return false;

      return true;
    })
    .map((vertex: VertexState) => vertex.id);
}

export function getLegalBuildSettlementVertices(
  state: CatanMatchState,
  playerId: PlayerId
): VertexId[] {
  if (state.lifecycle.phase !== "TURN_BUILD") return [];

  return Object.values(state.board.vertices)
    .filter((vertex: VertexState) => {
      if (vertex.occupant) return false;

      const violatesDistance = state.board.adjacency.vertexToVertices[vertex.id]
        .some((adjId: VertexId) => !!state.board.vertices[adjId].occupant);

      if (violatesDistance) return false;

      const hasRoadConnection = vertex.adjacentEdgeIds.some((edgeId: string) => {
        const edge = state.board.edges[edgeId as any];
        return edge.occupant?.playerId === playerId;
      });

      if (!hasRoadConnection) return false;

      return true;
    })
    .map((vertex: VertexState) => vertex.id);
}
