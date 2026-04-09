import { CatanMatchState } from '../../domain/model/catanMatchState';

export interface SpectatorFilterService {
  filterStateForSpectator(
    state: CatanMatchState,
    mode: "PUBLIC" | "COMMENTATOR" | "FULL_POSTGAME"
  ): Partial<CatanMatchState>;
}

export function filterStateForPublicSpectator(
  state: CatanMatchState
): Partial<CatanMatchState> {
  const filteredPlayers: Record<string, any> = {};
  
  for (const [playerId, player] of Object.entries(state.players)) {
    filteredPlayers[playerId] = {
      ...player,
      resources: { WOOD: 0, BRICK: 0, ORE: 0, WHEAT: 0, SHEEP: 0 }, // Obfuscated
      developmentCardsInHand: [], // Hidden
      hiddenVictoryPointCards: 0, // Hidden
    };
  }

  return {
    ...state,
    players: filteredPlayers as any, // Type cast for now
  };
}
