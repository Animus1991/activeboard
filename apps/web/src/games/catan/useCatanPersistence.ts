/**
 * useCatanPersistence — localStorage save / load / undo for Catan
 */

import { useCallback, useRef } from 'react';
import type { GameState } from './CatanEngine';

const SAVE_KEY = 'tableforge_catan_save';
const MAX_UNDO = 20;

export function useCatanPersistence() {
  const historyRef = useRef<GameState[]>([]);

  // ── Push a state onto the undo stack ──────────────────────────────────────
  const pushHistory = useCallback((state: GameState) => {
    historyRef.current = [...historyRef.current.slice(-MAX_UNDO + 1), state];
  }, []);

  // ── Undo: pop last state ──────────────────────────────────────────────────
  const undo = useCallback((): GameState | null => {
    const history = historyRef.current;
    if (history.length < 2) return null;
    // Remove current (last) state, return previous
    historyRef.current = history.slice(0, -1);
    return historyRef.current[historyRef.current.length - 1];
  }, []);

  const canUndo = useCallback(() => historyRef.current.length >= 2, []);

  // ── Save to localStorage ──────────────────────────────────────────────────
  const saveGame = useCallback((state: GameState) => {
    try {
      const serialized = JSON.stringify({ version: 1, savedAt: Date.now(), state });
      localStorage.setItem(SAVE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Load from localStorage ────────────────────────────────────────────────
  const loadGame = useCallback((): { state: GameState; savedAt: number } | null => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !parsed.state) return null;
      return { state: parsed.state as GameState, savedAt: parsed.savedAt as number };
    } catch {
      return null;
    }
  }, []);

  const hasSave = useCallback(() => !!localStorage.getItem(SAVE_KEY), []);

  const deleteSave = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
  }, []);

  return { pushHistory, undo, canUndo, saveGame, loadGame, hasSave, deleteSave };
}
