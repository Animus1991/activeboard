/**
 * useCatanSounds — sound effects hook
 * Uses the `use-sound` library with royalty-free CDN audio.
 * Gracefully degrades if audio fails to load.
 */

import { useEffect, useRef } from 'react';
import useSound from 'use-sound';
import type { GameState } from './CatanEngine';

// CDN audio - royalty-free SFX
const SFX = {
  dice:    'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  place:   'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  turn:    'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
  win:     'https://assets.mixkit.co/active_storage/sfx/2580/2580-preview.mp3',
  robber:  'https://assets.mixkit.co/active_storage/sfx/2584/2584-preview.mp3',
  build:   'https://assets.mixkit.co/active_storage/sfx/2577/2577-preview.mp3',
  card:    'https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3',
  trade:   'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3',
  steal:   'https://assets.mixkit.co/active_storage/sfx/2583/2583-preview.mp3',
  road:    'https://assets.mixkit.co/active_storage/sfx/2576/2576-preview.mp3',
};

interface UseCatanSoundsOptions {
  gameState: GameState;
}

export function useCatanSounds({ gameState }: UseCatanSoundsOptions) {
  const [playDice]   = useSound(SFX.dice,   { volume: 0.5 });
  const [playPlace]  = useSound(SFX.place,  { volume: 0.4 });
  const [playTurn]   = useSound(SFX.turn,   { volume: 0.35 });
  const [playWin]    = useSound(SFX.win,    { volume: 0.7 });
  const [playRobber] = useSound(SFX.robber, { volume: 0.5 });
  const [playBuild]  = useSound(SFX.build,  { volume: 0.4 });
  const [playCard]   = useSound(SFX.card,   { volume: 0.45 });
  const [playTrade]  = useSound(SFX.trade,  { volume: 0.4 });
  const [playSteal]  = useSound(SFX.steal,  { volume: 0.5 });
  const [playRoad]   = useSound(SFX.road,   { volume: 0.4 });

  const prevDice     = useRef<[number, number] | null>(null);
  const prevTurn     = useRef(gameState.currentPlayerIndex);
  const prevPhase    = useRef(gameState.phase);
  const prevBuildings = useRef(
    gameState.players.reduce((acc, p) => acc + p.settlements + (5 - p.cities), 0)
  );
  const prevPhaseRef = useRef(gameState.phase);
  const prevDevCards = useRef(gameState.players.reduce((acc, p) => acc + p.developmentCards.length, 0));
  const prevRoads    = useRef(gameState.edges.filter(e => e.road).length);
  const prevTradeRef = useRef(gameState.pendingTrade);

  // Dice roll
  useEffect(() => {
    if (!gameState.diceRoll) return;
    const [d1, d2] = gameState.diceRoll;
    const prev = prevDice.current;
    if (!prev || prev[0] !== d1 || prev[1] !== d2) {
      prevDice.current = [d1, d2];
      playDice();
      if (d1 + d2 === 7) setTimeout(() => playRobber(), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.diceRoll]);

  // Turn change
  useEffect(() => {
    if (gameState.currentPlayerIndex !== prevTurn.current) {
      prevTurn.current = gameState.currentPlayerIndex;
      playTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayerIndex]);

  // Building placed (settlement or city count changes)
  useEffect(() => {
    const currentCount = gameState.players.reduce((acc, p) => acc + p.settlements + (5 - p.cities), 0);
    if (currentCount !== prevBuildings.current) {
      prevBuildings.current = currentCount;
      playPlace();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players]);

  // Phase changes to main = build available
  useEffect(() => {
    if (prevPhaseRef.current !== 'main' && gameState.phase === 'main') {
      playBuild();
    }
    prevPhaseRef.current = gameState.phase;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase]);

  // Game over
  useEffect(() => {
    if (gameState.phase === 'game-over' && prevPhase.current !== 'game-over') {
      prevPhase.current = gameState.phase;
      playWin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase]);

  // Dev card purchased
  useEffect(() => {
    const total = gameState.players.reduce((acc, p) => acc + p.developmentCards.length, 0);
    if (total > prevDevCards.current) playCard();
    prevDevCards.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players]);

  // Road placed
  useEffect(() => {
    const total = gameState.edges.filter(e => e.road).length;
    if (total > prevRoads.current) playRoad();
    prevRoads.current = total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.edges]);

  // Trade resolved
  useEffect(() => {
    if (prevTradeRef.current && !gameState.pendingTrade) playTrade();
    prevTradeRef.current = gameState.pendingTrade;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.pendingTrade]);

  // Robber steal (entering robber-steal phase)
  useEffect(() => {
    if (gameState.phase === 'robber-steal' && prevPhaseRef.current !== 'robber-steal') {
      playSteal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase]);
}
