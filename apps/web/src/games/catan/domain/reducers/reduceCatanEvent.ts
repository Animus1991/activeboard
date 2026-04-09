import { 
  CatanMatchState, 
  CatanDomainEventEnvelope,
  ResourceMap,
} from '../model/catanMatchState';

// ============================================================================
// ROOT REDUCER
// ============================================================================

export function reduceCatanEvent(
  state: CatanMatchState,
  envelope: CatanDomainEventEnvelope
): CatanMatchState {
  const next = reduceByType(state, envelope.event);

  return {
    ...next,
    log: {
      ...next.log,
      sequence: envelope.sequence,
      events: [...next.log.events, envelope],
    },
  };
}

// ============================================================================
// EVENT DISPATCHER
// ============================================================================

function reduceByType(
  state: CatanMatchState,
  event: any // Using any here temporarily until all events are strictly typed in Tree
): CatanMatchState {
  switch (event.type) {
    case "MATCH_CREATED":
      return reduceMatchCreated(state, event);
    case "INITIAL_SETTLEMENT_PLACED":
      return reduceInitialSettlementPlaced(state, event);
    case "DICE_ROLLED":
      return reduceDiceRolled(state, event);
    case "RESOURCE_PRODUCED":
      return reduceResourceProduced(state, event);
    case "SETTLEMENT_BUILT":
      return reduceSettlementBuilt(state, event);
    case "CITY_UPGRADED":
      return reduceCityUpgraded(state, event);
    case "ROBBER_MOVED":
      return reduceRobberMoved(state, event);
    // ... other cases will route here
    default:
      return state;
  }
}

// ============================================================================
// SPECIFIC REDUCERS
// ============================================================================

function reduceMatchCreated(state: CatanMatchState, event: any): CatanMatchState {
  return {
    ...state,
    meta: {
      ...state.meta,
      matchId: event.matchId,
      createdAt: Date.now(),
      mode: event.mode,
    },
    lifecycle: {
      ...state.lifecycle,
      phase: "LOBBY",
      status: "WAITING",
      phaseEnteredAt: Date.now(),
      phaseSequenceNumber: state.lifecycle.phaseSequenceNumber + 1,
    },
  };
}

function reduceInitialSettlementPlaced(state: CatanMatchState, event: any): CatanMatchState {
  const vertex = state.board.vertices[event.vertexId];
  const player = state.players[event.playerId];

  return {
    ...state,
    board: {
      ...state.board,
      vertices: {
        ...state.board.vertices,
        [event.vertexId]: {
          ...vertex,
          occupant: {
            playerId: event.playerId,
            pieceType: "SETTLEMENT",
          },
        },
      },
    },
    players: {
      ...state.players,
      [event.playerId]: {
        ...player,
        piecePool: {
          ...player.piecePool,
          settlementsRemaining: player.piecePool.settlementsRemaining - 1,
        },
        ownedSettlementVertexIds: [
          ...player.ownedSettlementVertexIds,
          event.vertexId,
        ],
        publicVictoryPoints: player.publicVictoryPoints + 1,
        computedTotalVictoryPoints: player.computedTotalVictoryPoints + 1,
        stats: {
          ...player.stats,
          settlementsBuilt: player.stats.settlementsBuilt + 1,
        },
      },
    },
    render: {
      ...state.render,
      sceneDirty: true
    }
  };
}

function reduceDiceRolled(state: CatanMatchState, event: any): CatanMatchState {
  return {
    ...state,
    dice: {
      ...state.dice,
      rollAllowed: false,
      isRolling: false,
      lastRoll: {
        dieA: event.dieA,
        dieB: event.dieB,
        total: event.total,
        rolledBy: event.playerId,
        rolledAt: event.emittedAt ?? Date.now(),
      },
    },
    turn: {
      ...state.turn,
      hasRolledDiceThisTurn: true,
      pendingAction: event.total === 7 ? "DISCARD_FOR_SEVEN" : null,
    },
    lifecycle: {
      ...state.lifecycle,
      phase: event.total === 7 ? "TURN_HANDLE_SEVEN_DISCARDS" : "TURN_RESOLVE_PRODUCTION",
      phaseEnteredAt: Date.now(),
      phaseSequenceNumber: state.lifecycle.phaseSequenceNumber + 1,
    },
    render: {
      ...state.render,
      diceVisualState: {
        ...state.render.diceVisualState,
        visible: true,
        isAnimating: false,
        pendingRoll: {
          dieA: event.dieA,
          dieB: event.dieB,
        },
      },
      sceneDirty: true,
    },
  };
}

function reduceResourceProduced(state: CatanMatchState, event: any): CatanMatchState {
  const player = state.players[event.playerId];
  const bankAmount = state.bank.resources[event.resource as keyof ResourceMap];

  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
        ...player,
        resources: {
          ...player.resources,
          [event.resource]: player.resources[event.resource as keyof ResourceMap] + event.amount,
        },
        stats: {
          ...player.stats,
          totalResourcesProduced: player.stats.totalResourcesProduced + event.amount,
        },
      },
    },
    bank: {
      ...state.bank,
      resources: {
        ...state.bank.resources,
        [event.resource]: Math.max(0, bankAmount - event.amount),
      },
    },
  };
}

function reduceSettlementBuilt(state: CatanMatchState, _event: any): CatanMatchState {
  // Implementation matches InitialSettlementPlaced but with resource cost deduction
  return state; // Placeholder for exact implementation
}

function reduceCityUpgraded(state: CatanMatchState, _event: any): CatanMatchState {
  return state; // Placeholder
}

function reduceRobberMoved(state: CatanMatchState, event: any): CatanMatchState {
  const fromHex = state.board.hexes[event.fromHexId];
  const toHex = state.board.hexes[event.toHexId];

  return {
    ...state,
    board: {
      ...state.board,
      hexes: {
        ...state.board.hexes,
        [event.fromHexId]: { ...fromHex, hasRobber: false },
        [event.toHexId]: { ...toHex, hasRobber: true },
      },
    },
    robber: {
      ...state.robber,
      currentHexId: event.toHexId,
      awaitingMove: false,
      awaitingSteal: true,
    },
    lifecycle: {
      ...state.lifecycle,
      phase: "TURN_STEAL_RESOURCE",
      phaseEnteredAt: Date.now(),
      phaseSequenceNumber: state.lifecycle.phaseSequenceNumber + 1,
    },
    render: {
      ...state.render,
      terrainVisuals: {
        ...state.render.terrainVisuals,
        [event.fromHexId]: {
          ...state.render.terrainVisuals[event.fromHexId],
          needsRebuild: true,
        },
        [event.toHexId]: {
          ...state.render.terrainVisuals[event.toHexId],
          needsRebuild: true,
        },
      },
      sceneDirty: true,
    },
  };
}
