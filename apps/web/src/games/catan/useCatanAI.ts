/**
 * useCatanAI — AI opponent hook for TableForge Catan
 * Implements Beginner / Standard / Expert difficulty using
 * the existing pure CatanEngine functions (no mutation).
 *
 * Usage:
 *   const { triggerAITurn } = useCatanAI({ gameState, setGameState, difficulty });
 *   // Call triggerAITurn() after endTurn() when current player is an AI.
 */

import { useCallback } from 'react';
import {
  type GameState,
  type ResourceType,
  getCurrentPlayer,
  performRoll,
  buildSettlement,
  buildCity,
  buildRoad,
  buyDevelopmentCard,
  bankTrade,
  endTurn,
  advanceSetup,
  moveRobber,
  stealResource,
  discardResources,
  canBuyDevelopmentCard,
  canPlayDevCard,
  playKnight,
  playYearOfPlenty,
  playMonopoly,
  playRoadBuilding,
  buildFreeRoad,
  hasResources,
  BUILDING_COSTS,
  getValidSettlementVertices,
  getValidRoadEdges,
  getValidCityVertices,
  getPlayerTradeRatio,
  getTotalResources,
} from './CatanEngine';

export type AIDifficulty = 'beginner' | 'standard' | 'expert';

// ─── Probability weight for each dice number (6 and 8 = highest) ────────────
const NUMBER_PROB: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function nodeScore(state: GameState, vertexId: string, harbourBonus = false): number {
  const v = state.vertices.find(x => x.id === vertexId);
  if (!v) return 0;
  let score = v.hexIds.reduce((sum: number, hid: number) => {
    const h = state.hexTiles.find(t => t.id === hid);
    return sum + (h?.number ? (NUMBER_PROB[h.number] ?? 0) : 0);
  }, 0);
  if (harbourBonus && v.harbor) score += 3; // harbours add value
  return score;
}

/** Returns the best vertex for a settlement (highest probability + harbour score). */
function bestSettlementVertex(state: GameState, playerId: string, harbourBonus = false): string | null {
  const candidates = getValidSettlementVertices(state, playerId);
  if (candidates.length === 0) return null;
  return candidates.reduce<string>((best, vId) =>
    nodeScore(state, vId, harbourBonus) > nodeScore(state, best, harbourBonus) ? vId : best,
    candidates[0]);
}

/** Returns a valid edge to build a road (prefers extending toward good open nodes). */
function bestRoadEdge(state: GameState, playerId: string): string | null {
  const candidates = getValidRoadEdges(state, playerId);
  if (candidates.length === 0) return null;
  return candidates.reduce<string>((best, eId) => {
    const edge = state.edges.find(e => e.id === eId);
    if (!edge) return best;
    const score = edge.vertexIds.reduce((s: number, vId: string) => {
      const v = state.vertices.find(x => x.id === vId);
      if (v?.building) return s; // occupied — no expansion value
      return s + nodeScore(state, vId, true);
    }, 0);
    const bestEdge = state.edges.find(e => e.id === best);
    const bestScore = bestEdge
      ? bestEdge.vertexIds.reduce((s: number, vId: string) => {
          const v = state.vertices.find(x => x.id === vId);
          if (v?.building) return s;
          return s + nodeScore(state, vId, true);
        }, 0)
      : -1;
    return score > bestScore ? eId : best;
  }, candidates[0]);
}

/** Returns the best settlement to upgrade to a city (highest probability hex). */
function bestCityVertex(state: GameState, playerId: string): string | null {
  const candidates = getValidCityVertices(state, playerId);
  if (candidates.length === 0) return null;
  return candidates.reduce<string>((best, vId) =>
    nodeScore(state, vId) > nodeScore(state, best) ? vId : best,
    candidates[0]);
}

/** Choose the best hex for the robber — maximises opponent city/settlement count
 *  weighted by hex production probability (Expert: blocks highest-producing hex). */
function bestRobberHex(state: GameState, playerId: string, expert = false): number {
  const current = state.robberHexId;
  let bestHex = current;
  let bestScore = -1;
  for (const hex of state.hexTiles) {
    if (hex.id === current || hex.terrain === 'desert') continue;
    let score = 0;
    for (const v of state.vertices) {
      if (v.hexIds.includes(hex.id) && v.building && v.building.playerId !== playerId) {
        const buildingWeight = v.building.type === 'city' ? 2 : 1;
        const probWeight = expert ? (NUMBER_PROB[hex.number ?? 0] ?? 0) : 1;
        score += buildingWeight * (1 + probWeight);
      }
    }
    if (score > bestScore) { bestScore = score; bestHex = hex.id; }
  }
  return bestHex;
}

/** Find the best player to steal from — richest opponent adjacent to robber hex. */
function stealTarget(state: GameState, playerId: string): string | null {
  const robberHex = state.robberHexId;
  const targets = new Map<string, number>(); // id → total resources
  for (const v of state.vertices) {
    if (v.hexIds.includes(robberHex) && v.building && v.building.playerId !== playerId) {
      const tgt = state.players.find(p => p.id === v.building!.playerId);
      if (tgt) {
        const total = getTotalResources(tgt);
        if (total > 0) targets.set(tgt.id, Math.max(targets.get(tgt.id) ?? 0, total));
      }
    }
  }
  if (targets.size === 0) return null;
  // Steal from the one with the most resources (maximize steal value)
  return [...targets.entries()].sort(([, a], [, b]) => b - a)[0][0];
}

/** How many roads does this player have placed? */
function countPlayerRoads(state: GameState, playerId: string): number {
  return state.edges.filter(e => e.road?.playerId === playerId).length;
}

/** Best resource to monopoly on (most total held by opponents). */
function bestMonopolyResource(state: GameState, playerId: string): ResourceType {
  const totals: Record<ResourceType, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const [r, n] of Object.entries(p.resources) as [ResourceType, number][]) {
      totals[r] += n;
    }
  }
  return (Object.entries(totals) as [ResourceType, number][])
    .sort(([, a], [, b]) => b - a)[0][0];
}

/** Expert: which resources does this player most need for their best build? */
function mostNeededResources(player: ReturnType<typeof getCurrentPlayer>): ResourceType[] {
  const needs: Partial<Record<ResourceType, number>> = {};
  for (const [build, cost] of Object.entries(BUILDING_COSTS) as [string, Partial<Record<ResourceType, number>>][]) {
    void build;
    for (const [r, n] of Object.entries(cost) as [ResourceType, number][]) {
      const shortage = n - (player.resources[r] ?? 0);
      if (shortage > 0) needs[r] = (needs[r] ?? 0) + shortage;
    }
  }
  return (Object.entries(needs) as [ResourceType, number][]).sort(([, a], [, b]) => b - a).map(([r]) => r);
}

/** Aggression coefficient per difficulty. */
const AGGRESSION: Record<AIDifficulty, number> = {
  beginner: 0.25,
  standard: 0.55,
  expert:   1.00,
};

// ─── Main AI step — returns a new GameState after one logical AI action ──────

function aiStep(state: GameState, difficulty: AIDifficulty): GameState {
  const player = getCurrentPlayer(state);
  const pid = player.id;
  const agg = AGGRESSION[difficulty];
  const isExpert = difficulty === 'expert';

  // ── Roll phase ────────────────────────────────────────────────────────────
  if (state.phase === 'roll') {
    // Expert: play Knight before rolling if robber is blocking us
    if (isExpert && canPlayDevCard(state, pid, 'knight')) {
      const robberHex = state.hexTiles.find(h => h.id === state.robberHexId);
      const robberBlockingUs = robberHex
        ? state.vertices.some(v => v.hexIds.includes(state.robberHexId) && v.building?.playerId === pid)
        : false;
      if (robberBlockingUs) return playKnight(state, pid);
    }
    return performRoll(state);
  }

  // ── Setup phases ─────────────────────────────────────────────────────────
  if (state.phase === 'setup-settlement') {
    const vId = bestSettlementVertex(state, pid, isExpert);
    if (vId) {
      const next = buildSettlement(state, pid, vId, true);
      return next !== state ? advanceSetup(next) : state;
    }
    return state;
  }
  if (state.phase === 'setup-road') {
    const eId = bestRoadEdge(state, pid);
    if (eId) {
      const next = buildRoad(state, pid, eId, true);
      return next !== state ? advanceSetup(next) : state;
    }
    return state;
  }

  // ── Discard phase ─────────────────────────────────────────────────────────
  if (state.phase === 'discard') {
    const discIdx = state.discardingPlayerIndex ?? 0;
    const discPlayer = state.players[discIdx];
    if (!discPlayer || discPlayer.id !== pid) return state;
    const total = getTotalResources(discPlayer);
    const mustDiscard = Math.floor(total / 2);
    const selection: Record<ResourceType, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    let discarded = 0;
    // Expert: keep resources needed for best builds; discard least-useful excess
    const needed = isExpert ? mostNeededResources(discPlayer) : [];
    const sorted = (Object.keys(discPlayer.resources) as ResourceType[])
      .sort((a, b) => {
        if (isExpert) {
          const aN = needed.indexOf(a); const bN = needed.indexOf(b);
          if (aN === -1 && bN !== -1) return -1; // a not needed → discard first
          if (aN !== -1 && bN === -1) return 1;
        }
        return discPlayer.resources[b] - discPlayer.resources[a]; // most abundant first
      });
    for (const r of sorted) {
      while (discarded < mustDiscard && discPlayer.resources[r] > selection[r]) {
        selection[r]++;
        discarded++;
      }
    }
    return discardResources(state, pid, selection);
  }

  // ── Robber phases ─────────────────────────────────────────────────────────
  if (state.phase === 'robber-move') {
    return moveRobber(state, bestRobberHex(state, pid, isExpert));
  }
  if (state.phase === 'robber-steal') {
    const target = stealTarget(state, pid);
    return target ? stealResource(state, target) : endTurn(state);
  }

  // ── Free road placement (Road Building card) ──────────────────────────────
  if (state.freeRoadsRemaining > 0) {
    const eId = bestRoadEdge(state, pid);
    if (eId) return buildFreeRoad(state, pid, eId);
    return endTurn(state);
  }

  // ── Main phase ────────────────────────────────────────────────────────────
  if (state.phase === 'main') {
    // ── EXPERT: Play development cards ────────────────────────────────────
    if (isExpert && !state.devCardPlayedThisTurn) {
      // Year of Plenty: grab two most-needed resources
      if (canPlayDevCard(state, pid, 'year-of-plenty')) {
        const needed = mostNeededResources(player);
        if (needed.length >= 2) return playYearOfPlenty(state, pid, needed[0], needed[1]);
        if (needed.length === 1) return playYearOfPlenty(state, pid, needed[0], needed[0]);
      }
      // Monopoly: steal the most-held opponent resource
      if (canPlayDevCard(state, pid, 'monopoly')) {
        const best = bestMonopolyResource(state, pid);
        const opponentTotal = state.players
          .filter(p => p.id !== pid)
          .reduce((sum, p) => sum + (p.resources[best] ?? 0), 0);
        if (opponentTotal >= 2) return playMonopoly(state, pid, best);
      }
      // Road Building: if roads are useful
      if (canPlayDevCard(state, pid, 'road-building')) {
        const roads = countPlayerRoads(state, pid);
        const longestRoad = state.longestRoadPlayerId;
        const myRoads = roads;
        const leaderRoads = longestRoad
          ? countPlayerRoads(state, longestRoad)
          : 0;
        if (myRoads < leaderRoads + 2 || getValidRoadEdges(state, pid).length > 0) {
          return playRoadBuilding(state, pid);
        }
      }
      // Knight: use if robber is near opponent's high-production hex
      if (canPlayDevCard(state, pid, 'knight')) {
        const bestHex = bestRobberHex(state, pid, true);
        if (bestHex !== state.robberHexId) return playKnight(state, pid);
      }
    }

    // ── Build city (2 VP, most efficient) ─────────────────────────────────
    if (Math.random() < agg) {
      const vId = bestCityVertex(state, pid);
      if (vId && hasResources(player, BUILDING_COSTS.city)) {
        return buildCity(state, pid, vId);
      }
    }

    // ── Build settlement ───────────────────────────────────────────────────
    if (Math.random() < agg) {
      const vId = bestSettlementVertex(state, pid, isExpert);
      if (vId && hasResources(player, BUILDING_COSTS.settlement)) {
        return buildSettlement(state, pid, vId);
      }
    }

    // ── Expert: harbour-aware bank trade to fund builds ────────────────────
    if (isExpert) {
      const needed = mostNeededResources(player);
      const resources = Object.entries(player.resources) as [ResourceType, number][];
      for (const want of needed.slice(0, 2)) {
        for (const [give, count] of resources.sort(([, a], [, b]) => b - a)) {
          if (give === want) continue;
          const ratio = getPlayerTradeRatio(state, pid, give);
          if (count >= ratio) {
            return bankTrade(state, pid, give, want);
          }
        }
      }
    }

    // ── Extend roads (helps reach new spots or longest-road) ──────────────
    const roadPriority = isExpert
      ? (getValidSettlementVertices(state, pid).length === 0 ? 0.85 : 0.45)
      : agg * 0.7;
    if (Math.random() < roadPriority) {
      const eId = bestRoadEdge(state, pid);
      if (eId && hasResources(player, BUILDING_COSTS.road)) {
        return buildRoad(state, pid, eId);
      }
    }

    // ── Buy dev card ───────────────────────────────────────────────────────
    const devChance = isExpert ? 0.65 : agg * 0.5;
    if (Math.random() < devChance && canBuyDevelopmentCard(state, pid)) {
      return buyDevelopmentCard(state, pid);
    }

    // ── Standard bank trade — dump heavy excess ────────────────────────────
    if (!isExpert) {
      const resources = Object.entries(player.resources) as [ResourceType, number][];
      for (const [give, count] of resources.sort(([, a], [, b]) => b - a)) {
        if (count >= 4) {
          const needed = resources.find(([r, c]) => c === 0 && r !== give);
          if (needed) return bankTrade(state, pid, give, needed[0]);
        }
      }
    }

    // ── End turn ──────────────────────────────────────────────────────────
    return endTurn(state);
  }

  return state;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseCatanAIOptions {
  setGameState: (s: GameState | ((prev: GameState) => GameState)) => void;
  difficulty: AIDifficulty;
  /** IDs that are human-controlled. All others are AI. */
  humanPlayerIds: string[];
}

export function useCatanAI({ setGameState, difficulty, humanPlayerIds }: UseCatanAIOptions) {
  const triggerAITurn = useCallback(async (state: GameState) => {
    let current = state;
    const maxSteps = 20; // Safety cap
    let steps = 0;

    while (steps < maxSteps) {
      const player = getCurrentPlayer(current);
      if (humanPlayerIds.includes(player.id)) break;
      if (current.phase === 'game-over') break;

      // Small delay per step for readable UX
      await new Promise(res => setTimeout(res, difficulty === 'expert' ? 300 : 500));

      const next = aiStep(current, difficulty);
      if (next === current) break; // No progress

      setGameState(next);
      current = next;
      steps++;

      // After endTurn the player index changes; check if now human
      const nextPlayer = getCurrentPlayer(current);
      if (humanPlayerIds.includes(nextPlayer.id)) break;
    }
  }, [difficulty, humanPlayerIds, setGameState]);

  return { triggerAITurn };
}
