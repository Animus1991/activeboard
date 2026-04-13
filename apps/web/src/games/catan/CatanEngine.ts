/**
 * TableForge - Catan Game Engine
 * Complete implementation of Settlers of Catan rules
 */

import { generateBoard, type BoardSize } from './CatanBoardGenerator';
export type { BoardSize } from './CatanBoardGenerator';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ResourceType = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export type TerrainType = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert';
export type DevelopmentCardType = 'knight' | 'victory-point' | 'road-building' | 'year-of-plenty' | 'monopoly';
export type BuildingType = 'settlement' | 'city' | 'road';
export type HarborType = '3:1' | 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export interface HexTile {
  id: number;
  terrain: TerrainType;
  number: number | null;  // null for desert
  letterToken: string | null; // For intro animation
  hasRobber: boolean;
  position: { q: number; r: number };  // Axial coordinates
}

export interface Vertex {
  id: string;
  hexIds: number[];  // Adjacent hex IDs
  building: Building | null;
  harbor: HarborType | null;
}

export interface Edge {
  id: string;
  hexIds: number[];
  vertexIds: [string, string];
  road: Road | null;
}

export interface Building {
  type: 'settlement' | 'city';
  playerId: string;
}

export interface Road {
  playerId: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: Record<ResourceType, number>;
  developmentCards: DevelopmentCard[];
  playedKnights: number;
  victoryPoints: number;
  longestRoad: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  settlements: number;  // Remaining to build
  cities: number;
  roads: number;
}

export interface DevelopmentCard {
  type: DevelopmentCardType;
  turnBought: number;
  isPlayed: boolean;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string | null;  // null = bank/harbor trade
  offering: Partial<Record<ResourceType, number>>;
  requesting: Partial<Record<ResourceType, number>>;
  status: 'pending' | 'accepted' | 'declined' | 'countered';
}

export interface GameState {
  id: string;
  players: Player[];
  hexTiles: HexTile[];
  vertices: Vertex[];
  edges: Edge[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turn: number;
  diceRoll: [number, number] | null;
  robberHexId: number;
  developmentCardDeck: DevelopmentCardType[];
  longestRoadPlayerId: string | null;
  largestArmyPlayerId: string | null;
  pendingTrade: TradeOffer | null;
  setupRound: number;  // 1 or 2 during setup
  setupDirection: 1 | -1;  // Forward or reverse during setup
  winner: string | null;
  log: GameLogEntry[];
  devCardPlayedThisTurn: boolean;  // Max 1 dev card per turn
  freeRoadsRemaining: number;  // For road-building dev card
  // INTERACTION MODEL
  discardingPlayerIndex: number | null;  // Which player is currently discarding after a 7
  lastPlacedSettlementVertexId: string | null;  // Setup road must connect to THIS vertex
}

export type GamePhase = 
  | 'setup-settlement'
  | 'setup-road'
  | 'roll'
  | 'robber-move'
  | 'robber-steal'
  | 'discard'
  | 'main'
  | 'trade'
  | 'build'
  | 'development-card'
  | 'game-over';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  message: string;
  type: 'roll' | 'build' | 'trade' | 'card' | 'robber' | 'system';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TERRAIN_RESOURCES: Record<TerrainType, ResourceType | null> = {
  forest: 'wood',
  hills: 'brick',
  pasture: 'sheep',
  fields: 'wheat',
  mountains: 'ore',
  desert: null,
};

export const BUILDING_COSTS: Record<BuildingType, Partial<Record<ResourceType, number>>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
};

export const DEVELOPMENT_CARD_COST: Partial<Record<ResourceType, number>> = {
  sheep: 1, wheat: 1, ore: 1,
};

export const VICTORY_POINTS_TO_WIN = 10;

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];

// Standard Catan board layout
export const STANDARD_TERRAIN: TerrainType[] = [
  'mountains', 'pasture', 'forest',
  'fields', 'hills', 'pasture', 'hills',
  'fields', 'forest', 'desert', 'forest', 'mountains',
  'forest', 'mountains', 'fields', 'pasture',
  'hills', 'fields', 'pasture',
];

export const STANDARD_NUMBERS: (number | null)[] = [
  10, 2, 9,
  12, 6, 4, 10,
  9, 11, null, 3, 8,
  8, 3, 4, 5,
  5, 6, 11,
];

// Standard Catan harbour assignments — 9 ports defined by pairs of adjacent border hexes
const HARBOR_PORT_DEFS: { qa: number; ra: number; qb: number; rb: number; type: HarborType }[] = [
  { qa:  0, ra: -2, qb:  1, rb: -2, type: '3:1'   },
  { qa:  1, ra: -2, qb:  2, rb: -2, type: 'wood'  },
  { qa:  2, ra: -2, qb:  2, rb: -1, type: '3:1'   },
  { qa:  2, ra: -1, qb:  2, rb:  0, type: 'ore'   },
  { qa:  2, ra:  0, qb:  1, rb:  1, type: 'wheat' },
  { qa:  0, ra:  2, qb: -1, rb:  2, type: '3:1'   },
  { qa: -1, ra:  2, qb: -2, rb:  2, type: 'brick' },
  { qa: -2, ra:  1, qb: -2, rb:  0, type: 'sheep' },
  { qa: -2, ra:  0, qb: -1, rb: -1, type: '3:1'   },
];

// Hex positions in axial coordinates (q, r)
export const HEX_POSITIONS: { q: number; r: number }[] = [
  // Row 0 (top)
  { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
  // Row 1
  { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
  // Row 2 (middle)
  { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
  // Row 3
  { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
  // Row 4 (bottom)
  { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
];

// ============================================================================
// BOARD GENERATION
// ============================================================================

function generateHexTiles(): HexTile[] {
  const shuffledTerrain = shuffle([...STANDARD_TERRAIN]);
  const shuffledNumbers = shuffle([...STANDARD_NUMBERS]);
  
  // Find desert and ensure it has no number
  const desertIndex = shuffledTerrain.indexOf('desert');
  const nullIndex = shuffledNumbers.indexOf(null);
  if (desertIndex !== nullIndex) {
    [shuffledNumbers[desertIndex], shuffledNumbers[nullIndex]] = 
    [shuffledNumbers[nullIndex], shuffledNumbers[desertIndex]];
  }

  const letterTokens = 'ABCDEFGHIJKLMNOPQR'.split('');
  let letterIndex = 0;

  return HEX_POSITIONS.map((pos, index) => {
    const terrain = shuffledTerrain[index];
    const number = shuffledNumbers[index];
    const letterToken = number !== null ? letterTokens[letterIndex++] : null;

    return {
      id: index,
      terrain: terrain,
      number: number,
      letterToken: letterToken,
      hasRobber: terrain === 'desert',
      position: pos,
    };
  });
}

function getVertexId(hexIds: number[]): string {
  return hexIds.sort((a, b) => a - b).join('-');
}

function getEdgeId(vertexIds: [string, string]): string {
  return vertexIds.sort().join('|');
}

function assignHarbors(hexTiles: HexTile[], vertices: Vertex[]): Vertex[] {
  const updated = vertices.map(v => ({ ...v }));
  for (const harbor of HARBOR_PORT_DEFS) {
    const hexA = hexTiles.find(h => h.position.q === harbor.qa && h.position.r === harbor.ra);
    const hexB = hexTiles.find(h => h.position.q === harbor.qb && h.position.r === harbor.rb);
    if (!hexA || !hexB) continue;
    for (const vertex of updated) {
      if (vertex.hexIds.includes(hexA.id) && vertex.hexIds.includes(hexB.id)) {
        vertex.harbor = harbor.type;
      }
    }
  }
  return updated;
}

function generateVerticesAndEdges(hexTiles: HexTile[]): { vertices: Vertex[]; edges: Edge[] } {
  const vertexMap = new Map<string, Vertex>();
  const edgeMap = new Map<string, Edge>();

  // For each hex, generate its 6 vertices
  hexTiles.forEach(hex => {
    const neighbors = getHexNeighbors(hex.position, hexTiles);
    
    // Each vertex is shared by up to 3 hexes
    for (let i = 0; i < 6; i++) {
      const adjacentHexes = [hex.id];
      const n1 = neighbors[i];
      const n2 = neighbors[(i + 1) % 6];
      if (n1) adjacentHexes.push(n1.id);
      if (n2) adjacentHexes.push(n2.id);
      
      const vertexId = getVertexId(adjacentHexes);
      if (!vertexMap.has(vertexId)) {
        vertexMap.set(vertexId, {
          id: vertexId,
          hexIds: adjacentHexes,
          building: null,
          harbor: null,
        });
      }
    }
  });

  // Generate edges between adjacent vertices
  const vertices = Array.from(vertexMap.values());
  vertices.forEach(v1 => {
    vertices.forEach(v2 => {
      if (v1.id >= v2.id) return;
      
      // Two vertices are adjacent if they share exactly 2 hexes
      const sharedHexes = v1.hexIds.filter(h => v2.hexIds.includes(h));
      if (sharedHexes.length === 2) {
        const edgeId = getEdgeId([v1.id, v2.id]);
        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            id: edgeId,
            hexIds: sharedHexes,
            vertexIds: [v1.id, v2.id],
            road: null,
          });
        }
      }
    });
  });

  return { vertices, edges: Array.from(edgeMap.values()) };
}

function getHexNeighbors(pos: { q: number; r: number }, hexTiles: HexTile[]): (HexTile | null)[] {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  
  return directions.map(dir => {
    const neighborPos = { q: pos.q + dir.q, r: pos.r + dir.r };
    return hexTiles.find(h => h.position.q === neighborPos.q && h.position.r === neighborPos.r) || null;
  });
}

function generateDevelopmentCardDeck(): DevelopmentCardType[] {
  const deck: DevelopmentCardType[] = [
    ...Array(14).fill('knight'),
    ...Array(5).fill('victory-point'),
    ...Array(2).fill('road-building'),
    ...Array(2).fill('year-of-plenty'),
    ...Array(2).fill('monopoly'),
  ];
  return shuffle(deck);
}

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

export function createInitialGameState(playerNames: string[], boardSize: BoardSize = 'standard'): GameState {
  let hexTiles: HexTile[];
  if (boardSize === 'standard') {
    hexTiles = generateHexTiles();
  } else {
    const board = generateBoard(boardSize);
    hexTiles = board.hexTiles;
  }
  const { vertices: rawVertices, edges } = generateVerticesAndEdges(hexTiles);
  const vertices = assignHarbors(hexTiles, rawVertices);
  const robberHex = hexTiles.find(h => h.terrain === 'desert')!;

  const players: Player[] = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
    developmentCards: [],
    playedKnights: 0,
    victoryPoints: 0,
    longestRoad: 0,
    hasLongestRoad: false,
    hasLargestArmy: false,
    settlements: 5,
    cities: 4,
    roads: 15,
  }));

  return {
    id: generateId(),
    players,
    hexTiles,
    vertices,
    edges,
    currentPlayerIndex: 0,
    phase: 'setup-settlement',
    turn: 0,
    diceRoll: null,
    robberHexId: robberHex.id,
    developmentCardDeck: generateDevelopmentCardDeck(),
    longestRoadPlayerId: null,
    largestArmyPlayerId: null,
    pendingTrade: null,
    setupRound: 1,
    setupDirection: 1,
    winner: null,
    log: [],
    devCardPlayedThisTurn: false,
    freeRoadsRemaining: 0,
    discardingPlayerIndex: null,
    lastPlacedSettlementVertexId: null,
  };
}

// ============================================================================
// GAME HELPERS
// ============================================================================

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getVertex(state: GameState, vertexId: string): Vertex | undefined {
  return state.vertices.find(v => v.id === vertexId);
}

export function getEdge(state: GameState, edgeId: string): Edge | undefined {
  return state.edges.find(e => e.id === edgeId);
}

export function getAdjacentVertices(state: GameState, vertexId: string): Vertex[] {
  const vertex = getVertex(state, vertexId);
  if (!vertex) return [];
  
  return state.edges
    .filter(e => e.vertexIds.includes(vertexId))
    .map(e => {
      const otherId = e.vertexIds.find(v => v !== vertexId)!;
      return getVertex(state, otherId)!;
    })
    .filter(Boolean);
}

export function getAdjacentEdges(state: GameState, vertexId: string): Edge[] {
  return state.edges.filter(e => e.vertexIds.includes(vertexId));
}

export function hasResources(player: Player, cost: Partial<Record<ResourceType, number>>): boolean {
  return Object.entries(cost).every(([resource, amount]) => 
    player.resources[resource as ResourceType] >= (amount || 0)
  );
}

export function deductResources(player: Player, cost: Partial<Record<ResourceType, number>>): Player {
  const newResources = { ...player.resources };
  Object.entries(cost).forEach(([resource, amount]) => {
    newResources[resource as ResourceType] -= amount || 0;
  });
  return { ...player, resources: newResources };
}

export function addResources(player: Player, resources: Partial<Record<ResourceType, number>>): Player {
  const newResources = { ...player.resources };
  Object.entries(resources).forEach(([resource, amount]) => {
    newResources[resource as ResourceType] += amount || 0;
  });
  return { ...player, resources: newResources };
}

export function getTotalResources(player: Player): number {
  return Object.values(player.resources).reduce((sum, count) => sum + count, 0);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function canBuildSettlement(state: GameState, playerId: string, vertexId: string, isSetup: boolean = false): boolean {
  const player = state.players.find(p => p.id === playerId);
  const vertex = getVertex(state, vertexId);
  
  if (!player || !vertex) return false;
  if (vertex.building) return false;  // Already occupied
  if (player.settlements <= 0) return false;  // No settlements left
  
  // Check distance rule (no adjacent settlements)
  const adjacentVertices = getAdjacentVertices(state, vertexId);
  if (adjacentVertices.some(v => v.building)) return false;
  
  if (!isSetup) {
    // Must have resources
    if (!hasResources(player, BUILDING_COSTS.settlement)) return false;
    
    // Must be connected to own road
    const adjacentEdges = getAdjacentEdges(state, vertexId);
    if (!adjacentEdges.some(e => e.road?.playerId === playerId)) return false;
  }
  
  return true;
}

export function canBuildCity(state: GameState, playerId: string, vertexId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  const vertex = getVertex(state, vertexId);
  
  if (!player || !vertex) return false;
  if (!vertex.building || vertex.building.type !== 'settlement') return false;
  if (vertex.building.playerId !== playerId) return false;
  if (player.cities <= 0) return false;
  if (!hasResources(player, BUILDING_COSTS.city)) return false;
  
  return true;
}

export function canBuildRoad(state: GameState, playerId: string, edgeId: string, isSetup: boolean = false): boolean {
  const player = state.players.find(p => p.id === playerId);
  const edge = getEdge(state, edgeId);

  if (!player || !edge) return false;
  if (edge.road) return false;  // Already has road
  if (player.roads <= 0) return false;

  if (!isSetup) {
    if (!hasResources(player, BUILDING_COSTS.road)) return false;
  }

  // SETUP RULE: road must connect to the MOST RECENTLY PLACED settlement (not any building)
  if (isSetup && state.lastPlacedSettlementVertexId) {
    return edge.vertexIds.includes(state.lastPlacedSettlementVertexId);
  }

  // Must connect to own settlement/city or road
  const [v1, v2] = edge.vertexIds;
  const vertex1 = getVertex(state, v1);
  const vertex2 = getVertex(state, v2);

  const hasOwnBuilding =
    (vertex1?.building?.playerId === playerId) ||
    (vertex2?.building?.playerId === playerId);

  // A connected own road is only valid if the shared vertex is NOT blocked by an opponent's building
  const hasConnectedRoad = state.edges.some(e => {
    if (!e.road || e.road.playerId !== playerId) return false;
    const sharedVid = e.vertexIds.find(vid => edge.vertexIds.includes(vid));
    if (!sharedVid) return false;
    const sharedVertex = getVertex(state, sharedVid);
    // Opponent's building at the junction blocks road extension through it
    if (sharedVertex?.building && sharedVertex.building.playerId !== playerId) return false;
    return true;
  });

  return hasOwnBuilding || hasConnectedRoad;
}

export function canBuyDevelopmentCard(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  if (state.developmentCardDeck.length === 0) return false;
  return hasResources(player, DEVELOPMENT_CARD_COST);
}

// ============================================================================
// GAME ACTIONS
// ============================================================================

export function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function performRoll(state: GameState): GameState {
  const dice = rollDice();
  const total = dice[0] + dice[1];
  const player = getCurrentPlayer(state);
  
  let newState: GameState = { ...state, diceRoll: dice };
  newState = addLog(newState, player.id, `rolled ${dice[0]} + ${dice[1]} = ${total}`, 'roll');
  
  if (total === 7) {
    // Find the first player (starting from index 0) who must discard
    const firstDiscardIdx = state.players.findIndex(p => getTotalResources(p) > 7);
    if (firstDiscardIdx >= 0) {
      return { ...newState, phase: 'discard', discardingPlayerIndex: firstDiscardIdx };
    }
    return { ...newState, phase: 'robber-move', discardingPlayerIndex: null };
  }
  
  // Distribute resources
  newState = distributeResources(newState, total);
  return { ...newState, phase: 'main' };
}

export function distributeResources(state: GameState, diceTotal: number): GameState {
  const producingHexes = state.hexTiles.filter(h => 
    h.number === diceTotal && !h.hasRobber
  );
  
  const updatedPlayers = [...state.players];
  
  producingHexes.forEach(hex => {
    const resource = TERRAIN_RESOURCES[hex.terrain];
    if (!resource) return;
    
    // Find all settlements/cities adjacent to this hex
    state.vertices.forEach(vertex => {
      if (!vertex.building) return;
      if (!vertex.hexIds.includes(hex.id)) return;
      
      const playerIndex = updatedPlayers.findIndex(p => p.id === vertex.building!.playerId);
      if (playerIndex === -1) return;
      
      const amount = vertex.building.type === 'city' ? 2 : 1;
      updatedPlayers[playerIndex] = addResources(updatedPlayers[playerIndex], { [resource]: amount });
    });
  });
  
  return { ...state, players: updatedPlayers };
}

export function buildSettlement(state: GameState, playerId: string, vertexId: string, isSetup: boolean = false): GameState {
  if (!canBuildSettlement(state, playerId, vertexId, isSetup)) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const vertexIndex = state.vertices.findIndex(v => v.id === vertexId);
  
  const updatedPlayers = [...state.players];
  let player = updatedPlayers[playerIndex];
  
  if (!isSetup) {
    player = deductResources(player, BUILDING_COSTS.settlement);
  }
  
  player = {
    ...player,
    settlements: player.settlements - 1,
    victoryPoints: player.victoryPoints + 1,
  };
  updatedPlayers[playerIndex] = player;
  
  const updatedVertices = [...state.vertices];
  updatedVertices[vertexIndex] = {
    ...updatedVertices[vertexIndex],
    building: { type: 'settlement', playerId },
  };
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    vertices: updatedVertices,
    lastPlacedSettlementVertexId: vertexId,  // Record for setup road constraint
  };
  
  newState = addLog(newState, playerId, 'built a settlement', 'build');
  
  // During setup round 2, give initial resources
  if (isSetup && state.setupRound === 2) {
    const vertex = updatedVertices[vertexIndex];
    vertex.hexIds.forEach(hexId => {
      const hex = state.hexTiles.find(h => h.id === hexId);
      if (hex) {
        const resource = TERRAIN_RESOURCES[hex.terrain];
        if (resource) {
          updatedPlayers[playerIndex] = addResources(updatedPlayers[playerIndex], { [resource]: 1 });
        }
      }
    });
    newState = { ...newState, players: updatedPlayers };
  }
  
  return newState;
}

export function buildCity(state: GameState, playerId: string, vertexId: string): GameState {
  if (!canBuildCity(state, playerId, vertexId)) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const vertexIndex = state.vertices.findIndex(v => v.id === vertexId);
  
  const updatedPlayers = [...state.players];
  let player = deductResources(updatedPlayers[playerIndex], BUILDING_COSTS.city);
  player = {
    ...player,
    settlements: player.settlements + 1,  // Return settlement
    cities: player.cities - 1,
    victoryPoints: player.victoryPoints + 1,  // +1 more (settlement was already +1)
  };
  updatedPlayers[playerIndex] = player;
  
  const updatedVertices = [...state.vertices];
  updatedVertices[vertexIndex] = {
    ...updatedVertices[vertexIndex],
    building: { type: 'city', playerId },
  };
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    vertices: updatedVertices,
  };
  
  return addLog(newState, playerId, 'upgraded to a city', 'build');
}

export function buildRoad(state: GameState, playerId: string, edgeId: string, isSetup: boolean = false): GameState {
  if (!canBuildRoad(state, playerId, edgeId, isSetup)) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const edgeIndex = state.edges.findIndex(e => e.id === edgeId);
  
  const updatedPlayers = [...state.players];
  let player = updatedPlayers[playerIndex];
  
  if (!isSetup) {
    player = deductResources(player, BUILDING_COSTS.road);
  }
  
  player = { ...player, roads: player.roads - 1 };
  updatedPlayers[playerIndex] = player;
  
  const updatedEdges = [...state.edges];
  updatedEdges[edgeIndex] = {
    ...updatedEdges[edgeIndex],
    road: { playerId },
  };
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    edges: updatedEdges,
  };
  
  newState = addLog(newState, playerId, 'built a road', 'build');
  newState = updateLongestRoad(newState);
  
  return newState;
}

export function buyDevelopmentCard(state: GameState, playerId: string): GameState {
  if (!canBuyDevelopmentCard(state, playerId)) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const cardType = state.developmentCardDeck[0];
  
  const updatedPlayers = [...state.players];
  let player = deductResources(updatedPlayers[playerIndex], DEVELOPMENT_CARD_COST);
  
  const newCard: DevelopmentCard = {
    type: cardType,
    turnBought: state.turn,
    isPlayed: false,
  };
  
  player = {
    ...player,
    developmentCards: [...player.developmentCards, newCard],
    victoryPoints: cardType === 'victory-point' ? player.victoryPoints + 1 : player.victoryPoints,
  };
  updatedPlayers[playerIndex] = player;
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    developmentCardDeck: state.developmentCardDeck.slice(1),
  };
  
  return addLog(newState, playerId, 'bought a development card', 'card');
}

export function moveRobber(state: GameState, hexId: number): GameState {
  if (hexId === state.robberHexId) return state;  // Must move to different hex
  
  const updatedHexTiles = state.hexTiles.map(h => ({
    ...h,
    hasRobber: h.id === hexId,
  }));
  
  const player = getCurrentPlayer(state);
  let newState: GameState = {
    ...state,
    hexTiles: updatedHexTiles,
    robberHexId: hexId,
  };
  
  newState = addLog(newState, player.id, 'moved the robber', 'robber');
  
  // Check if there are players to steal from
  const playersToStealFrom = state.vertices
    .filter(v => v.hexIds.includes(hexId) && v.building && v.building.playerId !== player.id)
    .map(v => v.building!.playerId)
    .filter((id, index, arr) => arr.indexOf(id) === index);
  
  if (playersToStealFrom.length > 0) {
    return { ...newState, phase: 'robber-steal' };
  }
  
  return { ...newState, phase: 'main' };
}

export function stealResource(state: GameState, fromPlayerId: string): GameState {
  const currentPlayer = getCurrentPlayer(state);
  const fromPlayerIndex = state.players.findIndex(p => p.id === fromPlayerId);
  const fromPlayer = state.players[fromPlayerIndex];
  
  // Get random resource from target player
  const availableResources: ResourceType[] = [];
  (Object.entries(fromPlayer.resources) as [ResourceType, number][]).forEach(([resource, count]) => {
    for (let i = 0; i < count; i++) {
      availableResources.push(resource);
    }
  });
  
  if (availableResources.length === 0) {
    return { ...state, phase: 'main' };
  }
  
  const stolenResource = availableResources[Math.floor(Math.random() * availableResources.length)];
  
  const updatedPlayers = [...state.players];
  updatedPlayers[fromPlayerIndex] = deductResources(fromPlayer, { [stolenResource]: 1 });
  
  const currentPlayerIndex = state.players.findIndex(p => p.id === currentPlayer.id);
  updatedPlayers[currentPlayerIndex] = addResources(currentPlayer, { [stolenResource]: 1 });
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    phase: 'main',
  };
  
  return addLog(newState, currentPlayer.id, `stole a resource from ${fromPlayer.name}`, 'robber');
}

export function discardResources(state: GameState, playerId: string, resources: Partial<Record<ResourceType, number>>): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  
  const totalToDiscard = Math.floor(getTotalResources(player) / 2);
  const totalDiscarding = Object.values(resources).reduce((sum, n) => sum + (n || 0), 0);
  
  if (totalDiscarding !== totalToDiscard) return state;
  if (!hasResources(player, resources)) return state;
  
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = deductResources(player, resources);
  
  let newState: GameState = { ...state, players: updatedPlayers };
  newState = addLog(newState, playerId, `discarded ${totalToDiscard} resources`, 'system');
  
  // Advance to the next player who still needs to discard
  const nextDiscardIdx = newState.players.findIndex((p, i) => i !== playerIndex && getTotalResources(p) > 7);
  if (nextDiscardIdx >= 0) {
    return { ...newState, discardingPlayerIndex: nextDiscardIdx };
  }
  
  // All players done discarding — proceed to robber move
  return { ...newState, phase: 'robber-move', discardingPlayerIndex: null };
}

// ============================================================================
// TRADING
// ============================================================================

export function proposeTrade(
  state: GameState, 
  fromPlayerId: string, 
  toPlayerId: string | null,
  offering: Partial<Record<ResourceType, number>>,
  requesting: Partial<Record<ResourceType, number>>
): GameState {
  const trade: TradeOffer = {
    id: generateId(),
    fromPlayerId,
    toPlayerId,
    offering,
    requesting,
    status: 'pending',
  };
  
  return { ...state, pendingTrade: trade, phase: 'trade' };
}

export function acceptTrade(state: GameState, acceptingPlayerId: string): GameState {
  const trade = state.pendingTrade;
  if (!trade || trade.status !== 'pending') return state;
  if (trade.toPlayerId && trade.toPlayerId !== acceptingPlayerId) return state;
  
  const fromPlayerIndex = state.players.findIndex(p => p.id === trade.fromPlayerId);
  const toPlayerIndex = state.players.findIndex(p => p.id === acceptingPlayerId);
  
  const fromPlayer = state.players[fromPlayerIndex];
  const toPlayer = state.players[toPlayerIndex];
  
  if (!hasResources(fromPlayer, trade.offering)) return state;
  if (!hasResources(toPlayer, trade.requesting)) return state;
  
  const updatedPlayers = [...state.players];
  updatedPlayers[fromPlayerIndex] = addResources(
    deductResources(fromPlayer, trade.offering),
    trade.requesting
  );
  updatedPlayers[toPlayerIndex] = addResources(
    deductResources(toPlayer, trade.requesting),
    trade.offering
  );
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    pendingTrade: null,
    phase: 'main',
  };
  
  return addLog(newState, trade.fromPlayerId, `traded with ${toPlayer.name}`, 'trade');
}

export function declineTrade(state: GameState): GameState {
  return { ...state, pendingTrade: null, phase: 'main' };
}

export function getPlayerTradeRatio(state: GameState, playerId: string, resource: ResourceType): number {
  // Check if player has a 2:1 port for this specific resource
  const playerVertices = state.vertices.filter(v => v.building?.playerId === playerId);
  for (const vertex of playerVertices) {
    if (vertex.harbor === resource) return 2;
  }
  // Check if player has a 3:1 generic port
  for (const vertex of playerVertices) {
    if (vertex.harbor === '3:1') return 3;
  }
  // Default 4:1
  return 4;
}

export function bankTrade(
  state: GameState, 
  playerId: string, 
  giving: ResourceType, 
  receiving: ResourceType,
  ratio?: number
): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  
  // Auto-detect best ratio if not specified
  const effectiveRatio = ratio ?? getPlayerTradeRatio(state, playerId, giving);
  
  if (player.resources[giving] < effectiveRatio) return state;
  if (giving === receiving) return state;  // Can't trade same resource
  
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = addResources(
    deductResources(player, { [giving]: effectiveRatio }),
    { [receiving]: 1 }
  );
  
  let newState: GameState = { ...state, players: updatedPlayers };
  return addLog(newState, playerId, `traded ${effectiveRatio} ${giving} for 1 ${receiving} with bank`, 'trade');
}

// ============================================================================
// DEVELOPMENT CARD PLAY ACTIONS
// ============================================================================

export function canPlayDevCard(state: GameState, playerId: string, cardType: DevelopmentCardType): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  if (state.devCardPlayedThisTurn && cardType !== 'victory-point') return false;  // Max 1 non-VP card per turn

  const card = player.developmentCards.find(c => c.type === cardType && !c.isPlayed && c.turnBought < state.turn);
  if (!card) return false;  // Must have unplayed card NOT bought this turn

  // VP cards can only be revealed on winning turn (handled at checkWin)
  if (cardType === 'victory-point') return false;  // Never manually "played" — auto-revealed

  // Phase gate: knights can be played before rolling OR during main; all others only during main
  if (cardType === 'knight') {
    if (state.phase !== 'roll' && state.phase !== 'main') return false;
  } else {
    if (state.phase !== 'main') return false;
  }

  return true;
}

function markCardPlayed(player: Player, cardType: DevelopmentCardType, turn: number): Player {
  const cardIndex = player.developmentCards.findIndex(
    c => c.type === cardType && !c.isPlayed && c.turnBought < turn
  );
  if (cardIndex === -1) return player;
  
  const updatedCards = [...player.developmentCards];
  updatedCards[cardIndex] = { ...updatedCards[cardIndex], isPlayed: true };
  return { ...player, developmentCards: updatedCards };
}

export function playKnight(state: GameState, playerId: string): GameState {
  if (!canPlayDevCard(state, playerId, 'knight')) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const updatedPlayers = [...state.players];
  let player = markCardPlayed(updatedPlayers[playerIndex], 'knight', state.turn);
  player = { ...player, playedKnights: player.playedKnights + 1 };
  updatedPlayers[playerIndex] = player;
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    devCardPlayedThisTurn: true,
    phase: 'robber-move',
  };
  
  newState = addLog(newState, playerId, 'played a Knight', 'card');
  newState = updateLargestArmy(newState);
  return newState;
}

export function playYearOfPlenty(state: GameState, playerId: string, resource1: ResourceType, resource2: ResourceType): GameState {
  if (!canPlayDevCard(state, playerId, 'year-of-plenty')) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const updatedPlayers = [...state.players];
  let player = markCardPlayed(updatedPlayers[playerIndex], 'year-of-plenty', state.turn);
  if (resource1 === resource2) {
    player = addResources(player, { [resource1]: 2 });
  } else {
    player = addResources(player, { [resource1]: 1, [resource2]: 1 });
  }
  updatedPlayers[playerIndex] = player;
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    devCardPlayedThisTurn: true,
  };
  
  return addLog(newState, playerId, `played Year of Plenty (${resource1}, ${resource2})`, 'card');
}

export function playMonopoly(state: GameState, playerId: string, resource: ResourceType): GameState {
  if (!canPlayDevCard(state, playerId, 'monopoly')) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const updatedPlayers = [...state.players];
  let player = markCardPlayed(updatedPlayers[playerIndex], 'monopoly', state.turn);
  
  let totalStolen = 0;
  // Take ALL of the named resource from ALL other players
  for (let i = 0; i < updatedPlayers.length; i++) {
    if (i === playerIndex) continue;
    const amount = updatedPlayers[i].resources[resource];
    if (amount > 0) {
      totalStolen += amount;
      updatedPlayers[i] = deductResources(updatedPlayers[i], { [resource]: amount });
    }
  }
  
  player = addResources(player, { [resource]: totalStolen });
  updatedPlayers[playerIndex] = player;
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    devCardPlayedThisTurn: true,
  };
  
  return addLog(newState, playerId, `played Monopoly on ${resource} (stole ${totalStolen})`, 'card');
}

export function playRoadBuilding(state: GameState, playerId: string): GameState {
  if (!canPlayDevCard(state, playerId, 'road-building')) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const updatedPlayers = [...state.players];
  const player = markCardPlayed(updatedPlayers[playerIndex], 'road-building', state.turn);
  updatedPlayers[playerIndex] = player;
  
  // Determine how many free roads (max 2, but limited by remaining roads)
  const freeRoads = Math.min(2, player.roads);
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    devCardPlayedThisTurn: true,
    freeRoadsRemaining: freeRoads,
  };
  
  return addLog(newState, playerId, 'played Road Building', 'card');
}

export function buildFreeRoad(state: GameState, playerId: string, edgeId: string): GameState {
  if (state.freeRoadsRemaining <= 0) return state;
  
  const edge = getEdge(state, edgeId);
  if (!edge || edge.road) return state;
  
  // Validate placement (like canBuildRoad but without resource check)
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.roads <= 0) return state;
  
  const [v1, v2] = edge.vertexIds;
  const vertex1 = getVertex(state, v1);
  const vertex2 = getVertex(state, v2);
  const hasOwnBuilding = (vertex1?.building?.playerId === playerId) || (vertex2?.building?.playerId === playerId);
  const hasConnectedRoad = state.edges.some(e => {
    if (!e.road || e.road.playerId !== playerId) return false;
    const sharedVid = e.vertexIds.find(vid => edge.vertexIds.includes(vid));
    if (!sharedVid) return false;
    const sharedVertex = getVertex(state, sharedVid);
    if (sharedVertex?.building && sharedVertex.building.playerId !== playerId) return false;
    return true;
  });
  if (!hasOwnBuilding && !hasConnectedRoad) return state;
  
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const edgeIndex = state.edges.findIndex(e => e.id === edgeId);
  
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], roads: updatedPlayers[playerIndex].roads - 1 };
  
  const updatedEdges = [...state.edges];
  updatedEdges[edgeIndex] = { ...updatedEdges[edgeIndex], road: { playerId } };
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    edges: updatedEdges,
    freeRoadsRemaining: state.freeRoadsRemaining - 1,
  };
  
  newState = addLog(newState, playerId, 'placed a free road', 'build');
  newState = updateLongestRoad(newState);
  return newState;
}

// ============================================================================
// LONGEST ROAD & LARGEST ARMY
// ============================================================================

// Recursive backtracking DFS for longest road — correctly handles branching
function dfsLongestRoad(
  state: GameState,
  playerId: string,
  vertexId: string,
  visitedEdges: Set<string>
): number {
  const candidateEdges = state.edges.filter(e =>
    e.road?.playerId === playerId &&
    e.vertexIds.includes(vertexId) &&
    !visitedEdges.has(e.id)
  );
  if (candidateEdges.length === 0) return 0;

  let best = 0;
  for (const edge of candidateEdges) {
    const nextVertexId = edge.vertexIds.find(v => v !== vertexId)!;
    const nextVertex = getVertex(state, nextVertexId);
    visitedEdges.add(edge.id);
    // Opponent building at the far end blocks further traversal but still counts this edge
    if (nextVertex?.building && nextVertex.building.playerId !== playerId) {
      best = Math.max(best, 1);
    } else {
      best = Math.max(best, 1 + dfsLongestRoad(state, playerId, nextVertexId, visitedEdges));
    }
    visitedEdges.delete(edge.id);
  }
  return best;
}

function calculateLongestRoad(state: GameState, playerId: string): number {
  const playerEdges = state.edges.filter(e => e.road?.playerId === playerId);
  if (playerEdges.length === 0) return 0;

  // Collect all endpoint vertices of player's roads as DFS start points
  const vertexSet = new Set<string>();
  playerEdges.forEach(e => e.vertexIds.forEach(v => vertexSet.add(v)));

  let maxLength = 0;
  vertexSet.forEach(vertexId => {
    const len = dfsLongestRoad(state, playerId, vertexId, new Set<string>());
    maxLength = Math.max(maxLength, len);
  });
  return maxLength;
}

function updateLongestRoad(state: GameState): GameState {
  const roadLengths = state.players.map(p => ({
    playerId: p.id,
    length: calculateLongestRoad(state, p.id),
  }));
  
  const maxLength = Math.max(...roadLengths.map(r => r.length));
  if (maxLength < 5) return state;  // Need at least 5 for longest road
  
  const leaders = roadLengths.filter(r => r.length === maxLength);
  
  let newLongestRoadPlayer: string | null = null;
  
  if (leaders.length === 1) {
    newLongestRoadPlayer = leaders[0].playerId;
  } else if (state.longestRoadPlayerId && leaders.some(l => l.playerId === state.longestRoadPlayerId)) {
    // Current holder keeps it in case of tie
    newLongestRoadPlayer = state.longestRoadPlayerId;
  }
  
  if (newLongestRoadPlayer === state.longestRoadPlayerId) return state;
  
  const updatedPlayers = state.players.map(p => ({
    ...p,
    hasLongestRoad: p.id === newLongestRoadPlayer,
    victoryPoints: p.victoryPoints + 
      (p.id === newLongestRoadPlayer ? 2 : 0) -
      (p.id === state.longestRoadPlayerId ? 2 : 0),
    longestRoad: roadLengths.find(r => r.playerId === p.id)?.length || 0,
  }));
  
  const lrResult: GameState = { ...state, players: updatedPlayers, longestRoadPlayerId: newLongestRoadPlayer };
  // Win check: Longest Road can be the 10th VP during the current player's turn
  const currentPlayer = lrResult.players[lrResult.currentPlayerIndex];
  if (currentPlayer.victoryPoints >= VICTORY_POINTS_TO_WIN) {
    return addLog({ ...lrResult, winner: currentPlayer.id, phase: 'game-over' }, currentPlayer.id, 'won the game!', 'system');
  }
  return lrResult;
}

export function updateLargestArmy(state: GameState): GameState {
  const knightCounts = state.players.map(p => ({
    playerId: p.id,
    knights: p.playedKnights,
  }));
  
  const maxKnights = Math.max(...knightCounts.map(k => k.knights));
  if (maxKnights < 3) return state;  // Need at least 3 for largest army
  
  const leaders = knightCounts.filter(k => k.knights === maxKnights);
  
  let newLargestArmyPlayer: string | null = null;
  
  if (leaders.length === 1) {
    newLargestArmyPlayer = leaders[0].playerId;
  } else if (state.largestArmyPlayerId && leaders.some(l => l.playerId === state.largestArmyPlayerId)) {
    newLargestArmyPlayer = state.largestArmyPlayerId;
  }
  
  if (newLargestArmyPlayer === state.largestArmyPlayerId) return state;
  
  const updatedPlayers = state.players.map(p => ({
    ...p,
    hasLargestArmy: p.id === newLargestArmyPlayer,
    victoryPoints: p.victoryPoints + 
      (p.id === newLargestArmyPlayer ? 2 : 0) -
      (p.id === state.largestArmyPlayerId ? 2 : 0),
  }));
  
  const laResult: GameState = { ...state, players: updatedPlayers, largestArmyPlayerId: newLargestArmyPlayer };
  // Win check: Largest Army can be the 10th VP during the current player's turn
  const laCurrentPlayer = laResult.players[laResult.currentPlayerIndex];
  if (laCurrentPlayer.victoryPoints >= VICTORY_POINTS_TO_WIN) {
    return addLog({ ...laResult, winner: laCurrentPlayer.id, phase: 'game-over' }, laCurrentPlayer.id, 'won the game!', 'system');
  }
  return laResult;
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

export function endTurn(state: GameState): GameState {
  // Check for winner
  const winner = state.players.find(p => p.victoryPoints >= VICTORY_POINTS_TO_WIN);
  if (winner) {
    let newState: GameState = { ...state, winner: winner.id, phase: 'game-over' };
    return addLog(newState, winner.id, 'won the game!', 'system');
  }
  
  // Move to next player
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: 'roll',
    turn: state.turn + 1,
    diceRoll: null,
    devCardPlayedThisTurn: false,
    freeRoadsRemaining: 0,
  };
}

export function advanceSetup(state: GameState): GameState {
  const numPlayers = state.players.length;
  let nextIndex = state.currentPlayerIndex + state.setupDirection;
  let setupRound = state.setupRound;
  let setupDirection = state.setupDirection;
  void state.phase; // Phase transitions handled below
  
  // Handle setup phase transitions
  if (state.phase === 'setup-settlement') {
    return { ...state, phase: 'setup-road' };
  }
  
  if (state.phase === 'setup-road') {
    if (setupRound === 1) {
      if (nextIndex >= numPlayers) {
        // End of round 1, reverse direction
        setupDirection = -1;
        nextIndex = numPlayers - 1;
        setupRound = 2;
      }
    } else {
      if (nextIndex < 0) {
        // End of setup, start normal game
        return {
          ...state,
          currentPlayerIndex: 0,
          phase: 'roll',
          turn: 1,
          setupRound: 0,
          setupDirection: 1,
        };
      }
    }
    
    return {
      ...state,
      currentPlayerIndex: nextIndex,
      phase: 'setup-settlement',
      setupRound,
      setupDirection,
    };
  }
  
  return state;
}

// ============================================================================
// INTERACTION MODEL — valid move sets for UI (rule-exact, no re-implementation needed in UI)
// ============================================================================

export function getValidSettlementVertices(state: GameState, playerId: string, isSetup = false): string[] {
  return state.vertices.filter(v => canBuildSettlement(state, playerId, v.id, isSetup)).map(v => v.id);
}

export function getValidRoadEdges(state: GameState, playerId: string, isSetup = false): string[] {
  return state.edges.filter(e => canBuildRoad(state, playerId, e.id, isSetup)).map(e => e.id);
}

export function getValidCityVertices(state: GameState, playerId: string): string[] {
  return state.vertices.filter(v => canBuildCity(state, playerId, v.id)).map(v => v.id);
}

export function getValidRobberHexes(state: GameState): number[] {
  // Robber must move to a DIFFERENT hex than its current position
  return state.hexTiles.filter(h => h.id !== state.robberHexId).map(h => h.id);
}

export function getStealablePlayerIds(state: GameState, hexId: number, activePlayerId: string): string[] {
  // All players (not self) with a building adjacent to hexId AND who have at least 1 resource
  const adjacent = state.vertices.filter(
    v => v.hexIds.includes(hexId) && v.building && v.building.playerId !== activePlayerId
  );
  const unique = [...new Set(adjacent.map(v => v.building!.playerId))];
  // Only players who have resources to steal
  return unique.filter(pid => {
    const p = state.players.find(pl => pl.id === pid);
    return p && getTotalResources(p) > 0;
  });
}

// VP visible to a specific observer — hides unplayed VP dev cards from opponents
export function computePublicVictoryPoints(state: GameState, playerId: string, observingPlayerId: string): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;
  if (playerId === observingPlayerId) return player.victoryPoints;
  // Subtract hidden VP cards (bought but not yet revealed by winning)
  const hiddenVP = player.developmentCards.filter(c => c.type === 'victory-point' && !c.isPlayed).length;
  return player.victoryPoints - hiddenVP;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function addLog(state: GameState, playerId: string, message: string, type: GameLogEntry['type']): GameState {
  const player = state.players.find(p => p.id === playerId);
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: generateId(),
        timestamp: Date.now(),
        playerId,
        message: `${player?.name || 'Unknown'} ${message}`,
        type,
      },
    ],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createInitialGameState,
  getCurrentPlayer,
  getVertex,
  getEdge,
  getAdjacentVertices,
  getAdjacentEdges,
  hasResources,
  canBuildSettlement,
  canBuildCity,
  canBuildRoad,
  canBuyDevelopmentCard,
  canPlayDevCard,
  rollDice,
  performRoll,
  distributeResources,
  buildSettlement,
  buildCity,
  buildRoad,
  buyDevelopmentCard,
  playKnight,
  playYearOfPlenty,
  playMonopoly,
  playRoadBuilding,
  buildFreeRoad,
  moveRobber,
  stealResource,
  discardResources,
  proposeTrade,
  acceptTrade,
  declineTrade,
  bankTrade,
  getPlayerTradeRatio,
  endTurn,
  advanceSetup,
  // Interaction model helpers
  getValidSettlementVertices,
  getValidRoadEdges,
  getValidCityVertices,
  getValidRobberHexes,
  getStealablePlayerIds,
  computePublicVictoryPoints,
  TERRAIN_RESOURCES,
  BUILDING_COSTS,
  DEVELOPMENT_CARD_COST,
  VICTORY_POINTS_TO_WIN,
  PLAYER_COLORS,
};
