/**
 * CatanCommandDispatcher.ts
 * Implements strict CQRS (Command Query Responsibility Segregation) for Catan.
 * Validates commands, applies state changes, and emits events to the EventBus.
 */

import { GameState, BuildingType, buildSettlement, buildCity, buildRoad } from './CatanEngine';
import { CatanEventBus } from './CatanEventBus';

export type GameCommand =
  | { type: 'CMD_BUILD_SETTLEMENT'; payload: { playerId: string; vertexId: string; isSetup?: boolean } }
  | { type: 'CMD_BUILD_CITY'; payload: { playerId: string; vertexId: string } }
  | { type: 'CMD_BUILD_ROAD'; payload: { playerId: string; edgeId: string; isSetup?: boolean } }
  | { type: 'CMD_ENTER_BUILD_MODE'; payload: { playerId: string; buildingType: BuildingType } }
  | { type: 'CMD_EXIT_BUILD_MODE'; payload: { playerId: string } };

/**
 * Dispatcher function for all game commands.
 * Handles validation, state reduction, and event emission.
 */
export function dispatchCatanCommand(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case 'CMD_BUILD_SETTLEMENT': {
      const { playerId, vertexId, isSetup } = command.payload;
      const newState = buildSettlement(state, playerId, vertexId, isSetup);
      
      // If state changed, it was successful
      if (newState !== state) {
        CatanEventBus.dispatch({
          type: 'BUILDING_PLACED',
          payload: { playerId, buildingType: 'settlement', positionId: vertexId }
        });
      }
      return newState;
    }

    case 'CMD_BUILD_CITY': {
      const { playerId, vertexId } = command.payload;
      const newState = buildCity(state, playerId, vertexId);
      
      if (newState !== state) {
        CatanEventBus.dispatch({
          type: 'BUILDING_PLACED',
          payload: { playerId, buildingType: 'city', positionId: vertexId }
        });
      }
      return newState;
    }

    case 'CMD_BUILD_ROAD': {
      const { playerId, edgeId, isSetup } = command.payload;
      const newState = buildRoad(state, playerId, edgeId, isSetup);
      
      if (newState !== state) {
        CatanEventBus.dispatch({
          type: 'ROAD_PLACED',
          payload: { playerId, edgeId }
        });
      }
      return newState;
    }

    case 'CMD_ENTER_BUILD_MODE': {
      const { playerId, buildingType } = command.payload;
      CatanEventBus.dispatch({
        type: 'BUILD_MODE_ENTERED',
        payload: { playerId, buildingType }
      });
      return state;
    }

    case 'CMD_EXIT_BUILD_MODE': {
      const { playerId } = command.payload;
      CatanEventBus.dispatch({
        type: 'BUILD_MODE_EXITED',
        payload: { playerId }
      });
      return state;
    }

    default:
      console.warn(`[CatanCommandDispatcher] Unhandled command: ${(command as any).type}`);
      return state;
  }
}
