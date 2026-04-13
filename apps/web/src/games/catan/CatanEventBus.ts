/**
 * CatanEventBus.ts
 * AAA Production Event System for Game State, UI, Sound, and Animations.
 * Strictly decoupled from React render loops.
 */

import { ResourceType, BuildingType } from './CatanEngine';

export type GameEvent =
  // ==========================================
  // DICE EVENTS (Part 3 & 9)
  // ==========================================
  | { type: 'DICE_ROLL_STARTED'; payload: { player: string } }
  | { type: 'DICE_ROLLING'; payload: { velocity: number } }
  | { type: 'DICE_SETTLED'; payload: { result: [number, number]; total: number } }

  // ==========================================
  // RESOURCE EVENTS (Part 8)
  // ==========================================
  | { type: 'RESOURCES_GAINED'; payload: { playerId: string; resources: Partial<Record<ResourceType, number>>; source: 'dice' | 'trade' | 'bank' } }
  | { type: 'RESOURCES_SPENT'; payload: { playerId: string; resources: Partial<Record<ResourceType, number>> } }

  // ==========================================
  // BUILD EVENTS (Part 5)
  // ==========================================
  | { type: 'BUILD_MODE_ENTERED'; payload: { buildingType: BuildingType; playerId: string } }
  | { type: 'BUILD_MODE_EXITED'; payload: { playerId: string } }
  | { type: 'PLACEMENT_PREVIEW'; payload: { valid: boolean; positionId: string } }
  | { type: 'BUILDING_PLACED'; payload: { playerId: string; buildingType: BuildingType; positionId: string } }
  | { type: 'ROAD_PLACED'; payload: { playerId: string; edgeId: string } }

  // ==========================================
  // TRADE EVENTS (Part 4)
  // ==========================================
  | { type: 'TRADE_PROPOSED'; payload: { offerId: string; fromPlayer: string } }
  | { type: 'TRADE_ACCEPTED'; payload: { offerId: string; byPlayer: string } }
  | { type: 'TRADE_REJECTED'; payload: { offerId: string; byPlayer: string } }

  // ==========================================
  // ROBBER EVENTS (Part 2)
  // ==========================================
  | { type: 'ROBBER_MOVE_STARTED'; payload: { playerId: string } }
  | { type: 'ROBBER_MOVED'; payload: { hexId: number; targetPlayerId?: string } }

  // ==========================================
  // SYSTEM EVENTS
  // ==========================================
  | { type: 'TURN_CHANGED'; payload: { nextPlayerId: string; turnNumber: number } }
  | { type: 'PHASE_CHANGED'; payload: { newPhase: string } }
  | { type: 'ERROR_OCCURRED'; payload: { message: string; code: string } };

type EventCallback<T extends GameEvent['type']> = (
  payload: Extract<GameEvent, { type: T }>['payload']
) => void;

class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  on<T extends GameEvent['type']>(event: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event) || [];
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback)
      );
    };
  }

  dispatch(event: GameEvent): void {
    // console.log(`[EventBus] ${event.type}`, event.payload); // Debug trace
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(event.payload);
        } catch (e) {
          console.error(`[EventBus] Error in listener for ${event.type}:`, e);
        }
      });
    }
  }
}

export const CatanEventBus = new EventBus();
