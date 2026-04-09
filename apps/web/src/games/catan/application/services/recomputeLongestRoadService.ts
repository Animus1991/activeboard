import { CatanMatchState, PlayerId, VertexId, EdgeId } from '../../domain/model/catanMatchState';

export interface RoadGraph {
  nodes: VertexId[];
  edges: EdgeId[];
  adjacency: Record<VertexId, VertexId[]>;
}

export interface LongestRoadComputationResult {
  holderPlayerId: PlayerId | null;
  length: number;
  eligible: boolean;
}

export function buildRoadGraphForPlayer(
  state: CatanMatchState,
  playerId: PlayerId
): RoadGraph {
  const adjacency: Record<VertexId, VertexId[]> = {};
  const player = state.players[playerId];

  if (!player) {
    return { nodes: [], edges: [], adjacency };
  }

  for (const edgeId of player.ownedRoadEdgeIds) {
    const edge = state.board.edges[edgeId];
    if (!edge) continue;

    // Check if path is interrupted by an opponent's structure
    const isBlockedByOpponent = (vertexId: VertexId) => {
      const occupant = state.board.vertices[vertexId]?.occupant;
      return occupant && occupant.playerId !== playerId;
    };

    const blockA = isBlockedByOpponent(edge.vertexA);
    const blockB = isBlockedByOpponent(edge.vertexB);

    if (!adjacency[edge.vertexA]) adjacency[edge.vertexA] = [];
    if (!adjacency[edge.vertexB]) adjacency[edge.vertexB] = [];

    // Only add connections that aren't blocked by opponent structures
    if (!blockA) adjacency[edge.vertexB].push(edge.vertexA);
    if (!blockB) adjacency[edge.vertexA].push(edge.vertexB);
  }

  return {
    nodes: Object.keys(adjacency) as VertexId[],
    edges: player.ownedRoadEdgeIds,
    adjacency,
  };
}

function makeEdgeKey(v1: VertexId, v2: VertexId): string {
  return [v1, v2].sort().join('-');
}

function dfsLongest(
  graph: RoadGraph,
  current: VertexId,
  visitedEdges: Set<string>
): number {
  let max = 0;

  for (const next of graph.adjacency[current] || []) {
    const edgeKey = makeEdgeKey(current, next);
    if (visitedEdges.has(edgeKey)) continue;

    visitedEdges.add(edgeKey);
    const length = 1 + dfsLongest(graph, next, visitedEdges);
    visitedEdges.delete(edgeKey);

    if (length > max) max = length;
  }

  return max;
}

export function computeLongestRoadLengthForPlayer(graph: RoadGraph): number {
  let best = 0;

  for (const node of graph.nodes) {
    const length = dfsLongest(graph, node, new Set());
    if (length > best) best = length;
  }

  return best;
}

export function computeLongestRoad(
  state: CatanMatchState
): LongestRoadComputationResult {
  const playerIds = Object.keys(state.players) as PlayerId[];

  let bestPlayer: PlayerId | null = null;
  let bestLength = 0;

  for (const playerId of playerIds) {
    const graph = buildRoadGraphForPlayer(state, playerId);
    const longest = computeLongestRoadLengthForPlayer(graph);

    if (longest > bestLength) {
      bestLength = longest;
      bestPlayer = playerId;
    } else if (longest === bestLength) {
      bestPlayer = null; // tie means no change holder unless current holder remains
    }
  }

  return {
    holderPlayerId:
      bestLength >= state.rules.minimumLongestRoadSegments ? bestPlayer : null,
    length: bestLength,
    eligible: bestLength >= state.rules.minimumLongestRoadSegments,
  };
}

export function recomputeLongestRoad(
  state: CatanMatchState
): CatanMatchState {
  const result = computeLongestRoad(state);

  return {
    ...state,
    specialCards: {
      ...state.specialCards,
      longestRoad: {
        holderPlayerId: result.holderPlayerId,
        length: result.length,
        eligible: result.eligible,
      },
    },
  };
}
