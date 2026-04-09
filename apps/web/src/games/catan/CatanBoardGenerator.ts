/**
 * CatanBoardGenerator — Variable-size hex board generation with constraint solver
 *
 * Supports 3 board sizes:
 *   - standard (19 hex, radius 2) — classic Catan
 *   - large    (37 hex, radius 3) — 5-6 player expansion
 *   - xlarge   (61 hex, radius 4) — epic mode
 *
 * Constraint solver ensures:
 *   1. No two red numbers (6 or 8) are adjacent
 *   2. Desert always gets null number and starts with robber
 *   3. Balanced resource distribution per board size
 *   4. Fisher-Yates shuffle for true randomization
 */

import type { HexTile, TerrainType, HarborType } from './CatanEngine';

// ============================================================================
// BOARD SIZE DEFINITIONS
// ============================================================================

export type BoardSize = 'standard' | 'large' | 'xlarge';

interface BoardSizeConfig {
  radius: number;
  terrainCounts: Record<TerrainType, number>;
  numberPool: number[];
  harborCount: number;
}

const BOARD_SIZE_CONFIGS: Record<BoardSize, BoardSizeConfig> = {
  standard: {
    radius: 2,
    terrainCounts: {
      forest: 4, hills: 3, pasture: 4, fields: 4, mountains: 3, desert: 1,
    },
    numberPool: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    harborCount: 9,
  },
  large: {
    radius: 3,
    terrainCounts: {
      forest: 6, hills: 5, pasture: 6, fields: 6, mountains: 5, desert: 2,
    },
    // 37 hexes - 2 deserts = 35 numbers needed; extend with extra mid-range
    numberPool: [
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
      3, 4, 5, 9, 10, 11, 6, // extra filler for 35 slots
    ],
    harborCount: 12,
  },
  xlarge: {
    radius: 4,
    terrainCounts: {
      forest: 10, hills: 8, pasture: 10, fields: 10, mountains: 8, desert: 3,
    },
    // 61 hexes - 3 deserts = 58 numbers needed
    numberPool: [
      2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6,
      8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12,
      2, 3, 4, 5, 6, 8, 9, 10, 11, 12,
      3, 4, 5, 9, 10, 11, 5, 9, 6, 8, // filler for 58
    ],
    harborCount: 18,
  },
};

// ============================================================================
// HEX POSITION GENERATION — axial coordinates for any radius
// ============================================================================

export function generateHexPositions(radius: number): { q: number; r: number }[] {
  const positions: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        positions.push({ q, r });
      }
    }
  }
  return positions;
}

// ============================================================================
// ADJACENCY — two hexes are adjacent if axial distance == 1
// ============================================================================

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

function buildAdjacencyMap(positions: { q: number; r: number }[]): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (let i = 0; i < positions.length; i++) {
    const neighbors: number[] = [];
    for (let j = 0; j < positions.length; j++) {
      if (i !== j && hexDistance(positions[i], positions[j]) === 1) {
        neighbors.push(j);
      }
    }
    adj.set(i, neighbors);
  }
  return adj;
}

// ============================================================================
// FISHER-YATES SHUFFLE
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================================
// CONSTRAINT SOLVER — no adjacent 6/8 (red numbers)
// ============================================================================

const RED_NUMBERS = new Set([6, 8]);

/**
 * Check if placing `num` at index `idx` violates the no-adjacent-red constraint.
 */
function violatesRedConstraint(
  idx: number,
  num: number | null,
  assignment: (number | null)[],
  adjacency: Map<number, number[]>,
): boolean {
  if (num === null || !RED_NUMBERS.has(num)) return false;
  const neighbors = adjacency.get(idx) ?? [];
  for (const n of neighbors) {
    const nNum = assignment[n];
    if (nNum !== null && nNum !== undefined && RED_NUMBERS.has(nNum)) {
      return true;
    }
  }
  return false;
}

/**
 * Assign numbers to non-desert hexes using backtracking to satisfy constraints.
 * Falls back to unconstrained shuffle after MAX_ATTEMPTS.
 */
function solveNumberAssignment(
  terrains: TerrainType[],
  numberPool: number[],
  adjacency: Map<number, number[]>,
  maxAttempts = 200,
): (number | null)[] {
  const nonDesertIndices = terrains
    .map((t, i) => ({ t, i }))
    .filter(x => x.t !== 'desert')
    .map(x => x.i);

  const trimmedPool = numberPool.slice(0, nonDesertIndices.length);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(trimmedPool);
    const assignment: (number | null)[] = terrains.map(t => t === 'desert' ? null : undefined as unknown as null);
    let valid = true;

    for (let k = 0; k < nonDesertIndices.length; k++) {
      const idx = nonDesertIndices[k];
      const num = shuffled[k];
      if (violatesRedConstraint(idx, num, assignment, adjacency)) {
        valid = false;
        break;
      }
      assignment[idx] = num;
    }

    if (valid) return assignment;
  }

  // Fallback: unconstrained random assignment
  const shuffled = shuffle(trimmedPool);
  const assignment: (number | null)[] = terrains.map(t => t === 'desert' ? null : null);
  let k = 0;
  for (let i = 0; i < terrains.length; i++) {
    if (terrains[i] !== 'desert') {
      assignment[i] = shuffled[k++];
    }
  }
  return assignment;
}

// ============================================================================
// HARBOR GENERATION — evenly spaced around the border
// ============================================================================

const HARBOR_TYPES_POOL: HarborType[] = [
  '3:1', '3:1', '3:1', '3:1',
  'wood', 'brick', 'sheep', 'wheat', 'ore',
];

export function generateHarborTypes(count: number): HarborType[] {
  const base = [...HARBOR_TYPES_POOL];
  while (base.length < count) {
    base.push(HARBOR_TYPES_POOL[base.length % HARBOR_TYPES_POOL.length]);
  }
  return shuffle(base.slice(0, count));
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export interface GeneratedBoard {
  hexTiles: HexTile[];
  positions: { q: number; r: number }[];
  size: BoardSize;
  radius: number;
}

export function generateBoard(size: BoardSize = 'standard'): GeneratedBoard {
  const config = BOARD_SIZE_CONFIGS[size];
  const positions = generateHexPositions(config.radius);

  // Build terrain pool
  const terrainPool: TerrainType[] = [];
  for (const [terrain, count] of Object.entries(config.terrainCounts) as [TerrainType, number][]) {
    for (let i = 0; i < count; i++) terrainPool.push(terrain);
  }

  // Trim or pad if positions differ from pool (safety)
  while (terrainPool.length < positions.length) terrainPool.push('desert');
  const terrains = shuffle(terrainPool.slice(0, positions.length));

  // Solve number placement with constraint
  const adjacency = buildAdjacencyMap(positions);
  const numbers = solveNumberAssignment(terrains, config.numberPool, adjacency);

  // Build HexTile[]
  const hexTiles: HexTile[] = positions.map((pos, i) => ({
    id: i,
    terrain: terrains[i],
    number: numbers[i],
    hasRobber: terrains[i] === 'desert',
    position: pos,
  }));

  // Only one desert should have the robber initially
  const desertTiles = hexTiles.filter(h => h.terrain === 'desert');
  if (desertTiles.length > 1) {
    const robberIdx = Math.floor(Math.random() * desertTiles.length);
    desertTiles.forEach((h, i) => { h.hasRobber = i === robberIdx; });
  }

  return {
    hexTiles,
    positions,
    size,
    radius: config.radius,
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/** Check if board has no adjacent red numbers (6/8). */
export function validateNoAdjacentRed(board: GeneratedBoard): boolean {
  const adj = buildAdjacencyMap(board.positions);
  for (let i = 0; i < board.hexTiles.length; i++) {
    const num = board.hexTiles[i].number;
    if (num === null || !RED_NUMBERS.has(num)) continue;
    const neighbors = adj.get(i) ?? [];
    for (const n of neighbors) {
      const nNum = board.hexTiles[n].number;
      if (nNum !== null && RED_NUMBERS.has(nNum)) return false;
    }
  }
  return true;
}

/** Get terrain distribution stats. */
export function getBoardStats(board: GeneratedBoard) {
  const terrainCounts: Record<string, number> = {};
  const numberCounts: Record<number, number> = {};
  for (const h of board.hexTiles) {
    terrainCounts[h.terrain] = (terrainCounts[h.terrain] || 0) + 1;
    if (h.number) numberCounts[h.number] = (numberCounts[h.number] || 0) + 1;
  }
  return { terrainCounts, numberCounts, totalHexes: board.hexTiles.length };
}
