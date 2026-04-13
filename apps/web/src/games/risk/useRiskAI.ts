/**
 * useRiskAI — AI opponent hook for Risk
 *
 * Provides configurable AI players that automatically take turns.
 * Strategies: Aggressive (attack-heavy), Defensive (turtle), Balanced.
 * Each AI evaluates board state and executes reinforce → attack → fortify.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  type GameState,
  type Territory,
  getCurrentPlayer,
  getTerritory,
  getPlayerTerritories,
  canAttack,
  canFortify,
  placeArmies,
  attack,
  endAttackPhase,
  fortify,
  skipFortify,
  CONTINENTS,
} from './RiskEngine';

// ============================================================================
// TYPES
// ============================================================================

export type AIDifficulty = 'Easy' | 'Medium' | 'Hard';
export type AIStrategy = 'aggressive' | 'defensive' | 'balanced';

export interface AIPlayerConfig {
  playerId: string;
  difficulty: AIDifficulty;
  strategy?: AIStrategy;
}

interface ScoredTerritory {
  territory: Territory;
  score: number;
}

interface AttackOption {
  from: Territory;
  to: Territory;
  score: number;
}

// ============================================================================
// SCORING HELPERS
// ============================================================================

function getBorderTerritories(state: GameState, playerId: string): Territory[] {
  return getPlayerTerritories(state, playerId).filter(t =>
    t.neighbors.some(nId => {
      const neighbor = getTerritory(state, nId);
      return neighbor && neighbor.ownerId !== playerId;
    })
  );
}

function getWeakestNeighborEnemy(state: GameState, territory: Territory): Territory | null {
  let weakest: Territory | null = null;
  for (const nId of territory.neighbors) {
    const neighbor = getTerritory(state, nId);
    if (neighbor && neighbor.ownerId !== territory.ownerId) {
      if (!weakest || neighbor.armies < weakest.armies) {
        weakest = neighbor;
      }
    }
  }
  return weakest;
}

function continentProgress(state: GameState, playerId: string, continentId: string): number {
  const continent = CONTINENTS.find(c => c.id === continentId);
  if (!continent) return 0;
  const total = state.territories.filter(t => t.continent === continentId).length;
  const owned = state.territories.filter(t => t.continent === continentId && t.ownerId === playerId).length;
  return owned / total;
}

function bestContinentToTarget(state: GameState, playerId: string): string {
  let bestId = 'australia';
  let bestScore = -1;
  for (const c of CONTINENTS) {
    const progress = continentProgress(state, playerId, c.id);
    // Weight: progress * bonus, but penalize very large continents
    const total = state.territories.filter(t => t.continent === c.id).length;
    const score = progress * c.bonus * (1 / Math.sqrt(total));
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }
  return bestId;
}

// ============================================================================
// AI DECISION LOGIC
// ============================================================================

function aiReinforce(state: GameState, config: AIPlayerConfig): GameState {
  const playerId = config.playerId;
  let current = state;

  while (current.reinforcements > 0 && getCurrentPlayer(current).id === playerId) {
    const borders = getBorderTerritories(current, playerId);
    if (borders.length === 0) break;

    let target: Territory;

    if (config.strategy === 'aggressive') {
      // Reinforce the border territory with the best attack opportunity
      const scored: ScoredTerritory[] = borders.map(t => {
        const enemy = getWeakestNeighborEnemy(current, t);
        const advantage = enemy ? t.armies - enemy.armies : 0;
        return { territory: t, score: -advantage }; // lower advantage → needs more troops
      });
      scored.sort((a, b) => b.score - a.score);
      target = scored[0].territory;
    } else if (config.strategy === 'defensive') {
      // Reinforce the most vulnerable border
      const scored: ScoredTerritory[] = borders.map(t => {
        const enemyPressure = t.neighbors.reduce((sum, nId) => {
          const n = getTerritory(current, nId);
          return n && n.ownerId !== playerId ? sum + n.armies : sum;
        }, 0);
        return { territory: t, score: enemyPressure - t.armies };
      });
      scored.sort((a, b) => b.score - a.score);
      target = scored[0].territory;
    } else {
      // Balanced — reinforce toward target continent
      const targetContinent = bestContinentToTarget(current, playerId);
      const continentBorders = borders.filter(t => t.continent === targetContinent);
      const pool = continentBorders.length > 0 ? continentBorders : borders;
      // Pick the one with lowest armies among borders
      pool.sort((a, b) => a.armies - b.armies);
      target = pool[0];
    }

    const amount = config.difficulty === 'Easy' ? 1 : Math.min(current.reinforcements, 3);
    current = placeArmies(current, target.id, amount);
  }

  return current;
}

function aiAttack(state: GameState, config: AIPlayerConfig): GameState {
  const playerId = config.playerId;
  let current = state;
  let attacksMade = 0;
  const maxAttacks = config.difficulty === 'Easy' ? 2 : config.difficulty === 'Medium' ? 5 : 10;

  while (attacksMade < maxAttacks && getCurrentPlayer(current).id === playerId) {
    const options: AttackOption[] = [];

    for (const terr of getPlayerTerritories(current, playerId)) {
      if (terr.armies < 2) continue;
      for (const nId of terr.neighbors) {
        if (canAttack(current, terr.id, nId)) {
          const enemy = getTerritory(current, nId)!;
          const ratio = terr.armies / Math.max(1, enemy.armies);
          
          // Only attack if we have numerical advantage
          const threshold = config.strategy === 'aggressive' ? 1.2 : config.strategy === 'defensive' ? 2.5 : 1.5;
          if (ratio < threshold) continue;

          // Score: higher is better
          let score = ratio * 10;
          // Bonus for completing continent
          const cp = continentProgress(current, playerId, enemy.continent);
          if (cp > 0.6) score += 15;
          // Bonus for weak targets
          if (enemy.armies === 1) score += 5;

          options.push({ from: terr, to: enemy, score });
        }
      }
    }

    if (options.length === 0) break;

    // Sort by score descending
    options.sort((a, b) => b.score - a.score);
    const best = options[0];
    const dice = Math.min(3, best.from.armies - 1);
    current = attack(current, best.from.id, best.to.id, dice);
    attacksMade++;

    // Break if game over
    if (current.phase === 'game-over') return current;
  }

  // End attack phase
  if (current.phase === 'attack' && getCurrentPlayer(current).id === playerId) {
    current = endAttackPhase(current);
  }

  return current;
}

function aiFortify(state: GameState, config: AIPlayerConfig): GameState {
  const playerId = config.playerId;
  if (getCurrentPlayer(state).id !== playerId || state.phase !== 'fortify') {
    return state;
  }

  const myTerritories = getPlayerTerritories(state, playerId);
  
  // Find interior territories with armies (not on border)
  const interior = myTerritories.filter(t =>
    t.armies > 1 && t.neighbors.every(nId => {
      const n = getTerritory(state, nId);
      return n && n.ownerId === playerId;
    })
  );

  if (interior.length === 0) return skipFortify(state);

  // Find the most vulnerable border
  const borders = getBorderTerritories(state, playerId);
  if (borders.length === 0) return skipFortify(state);

  // Sort interior by most spare armies
  interior.sort((a, b) => b.armies - a.armies);
  // Sort borders by most vulnerable (highest enemy pressure vs own armies)
  const scoredBorders = borders.map(t => {
    const enemyPressure = t.neighbors.reduce((sum, nId) => {
      const n = getTerritory(state, nId);
      return n && n.ownerId !== playerId ? sum + n.armies : sum;
    }, 0);
    return { territory: t, vulnerability: enemyPressure - t.armies };
  });
  scoredBorders.sort((a, b) => b.vulnerability - a.vulnerability);

  const source = interior[0];
  const dest = scoredBorders[0].territory;

  if (canFortify(state, source.id, dest.id)) {
    const amount = source.armies - 1;
    return fortify(state, source.id, dest.id, amount);
  }

  return skipFortify(state);
}

// ============================================================================
// MAIN AI TURN
// ============================================================================

function executeAITurn(state: GameState, config: AIPlayerConfig): GameState {
  const defaultStrategy: AIStrategy = config.difficulty === 'Easy' ? 'defensive' 
    : config.difficulty === 'Hard' ? 'aggressive' : 'balanced';
  
  const fullConfig: AIPlayerConfig = {
    ...config,
    strategy: config.strategy || defaultStrategy,
  };

  let current = state;

  // Reinforce
  if (current.phase === 'reinforce' || current.phase === 'setup-reinforce') {
    current = aiReinforce(current, fullConfig);
  }

  // Attack (skip in setup)
  if (current.phase === 'attack') {
    current = aiAttack(current, fullConfig);
  }

  // Fortify
  if (current.phase === 'fortify') {
    current = aiFortify(current, fullConfig);
  }

  return current;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRiskAI(
  gameState: GameState,
  aiConfigs: AIPlayerConfig[],
  onStateUpdate: (newState: GameState) => void,
) {
  const processingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processAITurn = useCallback(() => {
    if (processingRef.current) return;

    const currentPlayer = getCurrentPlayer(gameState);
    const aiConfig = aiConfigs.find(c => c.playerId === currentPlayer.id);
    if (!aiConfig) return;
    if (gameState.phase === 'game-over') return;

    processingRef.current = true;

    // Delay to give a human-like feel
    const delay = aiConfig.difficulty === 'Easy' ? 1500 : aiConfig.difficulty === 'Medium' ? 1000 : 600;

    timeoutRef.current = setTimeout(() => {
      const newState = executeAITurn(gameState, aiConfig);
      onStateUpdate(newState);
      processingRef.current = false;
    }, delay);
  }, [gameState, aiConfigs, onStateUpdate]);

  useEffect(() => {
    const currentPlayer = getCurrentPlayer(gameState);
    const isAI = aiConfigs.some(c => c.playerId === currentPlayer.id);
    
    if (isAI && gameState.phase !== 'game-over') {
      processAITurn();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      processingRef.current = false;
    };
  }, [gameState.currentPlayerIndex, gameState.phase, processAITurn]);

  return {
    isAITurn: aiConfigs.some(c => c.playerId === getCurrentPlayer(gameState).id),
  };
}

export default useRiskAI;
