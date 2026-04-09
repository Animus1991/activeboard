import { CatanMatchState, PlayerId, HexId, EdgeId, VertexId } from '../../domain/model/catanMatchState';

export interface TopBannerProjection {
  activePlayerId: PlayerId;
  activePlayerName: string;
  activePlayerColor: string;
  phaseLabel: string;
  subPrompt: string;
}

export interface ActionButtonProjection {
  id: string;
  label: string;
  enabled: boolean;
  visible: boolean;
  hotkey?: string;
  reasonDisabled?: string;
  commandType?: string;
}

export interface ActionsPanelProjection {
  title: string;
  buttons: ActionButtonProjection[];
  instructions: string[];
}

export interface PlayerPanelItemProjection {
  playerId: PlayerId;
  displayName: string;
  color: string;
  visibleVictoryPoints: number;
  resourcesVisibleSummary: {
    totalCards?: number;
  };
  isActive: boolean;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
}

export interface PlayersPanelProjection {
  items: PlayerPanelItemProjection[];
}

export interface DicePanelProjection {
  visible: boolean;
  canRoll: boolean;
  isRolling: boolean;
  dieA: number | null;
  dieB: number | null;
  total: number | null;
  primaryAction: {
    label: string;
    commandType: string;
    enabled: boolean;
  } | null;
}

export interface BuildPreviewOverlayProjection {
  visible: boolean;
  mode: "NONE" | "ROAD" | "SETTLEMENT" | "CITY" | "ROBBER";
  legalVertexIds: VertexId[];
  legalEdgeIds: EdgeId[];
  legalHexIds: HexId[];
}

export interface MainHudProjection {
  topBanner: TopBannerProjection;
  leftPlayersPanel: PlayersPanelProjection;
  rightActionsPanel: ActionsPanelProjection;
  dicePanel: DicePanelProjection;
  buildPreviewOverlay: BuildPreviewOverlayProjection;
  // Others to be added later
}

// Interaction Projection
export interface InteractionProjectionState {
  highlightedVertexIds: VertexId[];
  highlightedEdgeIds: EdgeId[];
  hoveredEntityId: string | null;
  selectedEntityId: string | null;
  clickMode: "NONE" | "PLACE_SETTLEMENT" | "PLACE_ROAD" | "MOVE_ROBBER" | "CHOOSE_STEAL_TARGET";
}

// Engine Interface
export interface CatanProjectionEngine {
  projectUI(state: CatanMatchState, currentUserId: PlayerId): MainHudProjection;
  projectInteraction(state: CatanMatchState, currentUserId: PlayerId): InteractionProjectionState;
}
