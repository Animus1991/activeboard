/**
 * useCatanUnifiedState.ts
 * 
 * React hook that manages both GameState and CatanMatchState in sync.
 * Provides a unified interface for the game engine while maintaining
 * compatibility with the legacy GameState API.
 * 
 * Usage:
 *   const { gameState, matchState, setGameState, syncToMatchState } = useCatanUnifiedState();
 *   // gameState is the runtime state (lightweight)
 *   // matchState is the authoritative state (AAA-grade, event-sourcing ready)
 *   // Both stay in sync automatically
 */

import { useState, useCallback, useRef } from 'react';
import type { GameState } from './CatanEngine';
import type { CatanMatchState, PlayerId, MatchId, GameMode } from './domain/model/catanMatchState';
import { CatanStateBridge, BrandedIds } from './CatanStateBridge';

interface UseCatanUnifiedStateOptions {
  matchId?: MatchId;
  createdBy?: PlayerId;
  vpToWin?: number;
  gameMode?: GameMode;
}

interface UseCatanUnifiedStateReturn {
  // Runtime state (lightweight, functional)
  gameState: GameState;
  setGameState: (state: GameState | ((prev: GameState) => GameState)) => void;

  // Authoritative state (AAA-grade, branded types)
  matchState: CatanMatchState;
  setMatchState: (state: CatanMatchState) => void;

  // Sync operations
  syncToMatchState: () => void;
  syncToGameState: () => void;

  // Validation
  validateConsistency: () => string[];
  hasConsistencyErrors: boolean;

  // Metadata
  matchId: MatchId;
  createdBy: PlayerId;
}

/**
 * Hook that manages unified state synchronization
 */
export function useCatanUnifiedState(options: UseCatanUnifiedStateOptions = {}): UseCatanUnifiedStateReturn {
  const {
    matchId = BrandedIds.matchId(`match-${Date.now()}`),
    createdBy = BrandedIds.playerId('player-0'),
    vpToWin = 10,
    gameMode = 'VARIABLE_SETUP' as const,
  } = options;

  // Runtime state (GameState)
  const [gameState, setGameStateInternal] = useState<GameState>(() => {
    // Initialize with a default game state
    // This would normally come from createInitialGameState()
    return {
      id: matchId,
      players: [],
      hexTiles: [],
      vertices: [],
      edges: [],
      currentPlayerIndex: 0,
      phase: 'setup-settlement',
      turn: 1,
      diceRoll: null,
      robberHexId: 0,
      developmentCardDeck: [],
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
  });

  // Authoritative state (CatanMatchState)
  const [matchState, setMatchStateInternal] = useState<CatanMatchState>(() => {
    return CatanStateBridge.gameStateToMatchState(gameState, matchId, createdBy, gameMode, vpToWin);
  });

  // Track if we're in a sync operation to avoid infinite loops
  const syncingRef = useRef(false);

  // Consistency error tracking
  const [consistencyErrors, setConsistencyErrors] = useState<string[]>([]);

  /**
   * Update GameState and sync to MatchState
   */
  const setGameState = useCallback((updater: GameState | ((prev: GameState) => GameState)) => {
    if (syncingRef.current) return;

    syncingRef.current = true;
    try {
      const newGameState = typeof updater === 'function' ? updater(gameState) : updater;
      setGameStateInternal(newGameState);

      // Auto-sync to match state
      const newMatchState = CatanStateBridge.gameStateToMatchState(
        newGameState,
        matchId,
        createdBy,
        gameMode,
        vpToWin
      );
      setMatchStateInternal(newMatchState);

      // Validate consistency
      const errors = CatanStateBridge.validateConsistency(newGameState, newMatchState);
      setConsistencyErrors(errors);
    } finally {
      syncingRef.current = false;
    }
  }, [gameState, matchId, createdBy, gameMode, vpToWin]);

  /**
   * Update MatchState directly
   */
  const setMatchState = useCallback((newMatchState: CatanMatchState) => {
    if (syncingRef.current) return;

    syncingRef.current = true;
    try {
      setMatchStateInternal(newMatchState);

      // Validate consistency
      const errors = CatanStateBridge.validateConsistency(gameState, newMatchState);
      setConsistencyErrors(errors);
    } finally {
      syncingRef.current = false;
    }
  }, [gameState]);

  /**
   * Manually sync GameState → MatchState
   */
  const syncToMatchState = useCallback(() => {
    const newMatchState = CatanStateBridge.gameStateToMatchState(
      gameState,
      matchId,
      createdBy,
      gameMode,
      vpToWin
    );
    setMatchStateInternal(newMatchState);

    const errors = CatanStateBridge.validateConsistency(gameState, newMatchState);
    setConsistencyErrors(errors);
  }, [gameState, matchId, createdBy, gameMode, vpToWin]);

  /**
   * Manually sync MatchState → GameState
   * (This is lossy — some AAA state is discarded)
   */
  const syncToGameState = useCallback(() => {
    // Extract GameState from MatchState
    const extracted = CatanStateBridge.matchStateToGameState(matchState);
    const newGameState = { ...gameState, ...extracted };
    setGameStateInternal(newGameState);

    const errors = CatanStateBridge.validateConsistency(newGameState, matchState);
    setConsistencyErrors(errors);
  }, [gameState, matchState]);

  /**
   * Validate consistency between models
   */
  const validateConsistency = useCallback(() => {
    const errors = CatanStateBridge.validateConsistency(gameState, matchState);
    setConsistencyErrors(errors);
    return errors;
  }, [gameState, matchState]);

  return {
    gameState,
    setGameState,
    matchState,
    setMatchState,
    syncToMatchState,
    syncToGameState,
    validateConsistency,
    hasConsistencyErrors: consistencyErrors.length > 0,
    matchId,
    createdBy,
  };
}

/**
 * Hook for accessing just the authoritative MatchState
 * Use this when you only need the AAA-grade state
 */
export function useCatanMatchState(initialState?: CatanMatchState) {
  const [matchState, setMatchState] = useState<CatanMatchState>(
    initialState || ({} as CatanMatchState)
  );

  return { matchState, setMatchState };
}

/**
 * Hook for accessing just the runtime GameState
 * Use this for backward compatibility with existing code
 */
export function useCatanGameState(initialState?: GameState) {
  const [gameState, setGameState] = useState<GameState>(
    initialState || ({} as GameState)
  );

  return { gameState, setGameState };
}
