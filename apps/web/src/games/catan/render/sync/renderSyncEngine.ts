import { CatanMatchState, HexId, TokenId, HarborId, EdgeId, VertexId, Transform3D, TerrainType, HarborTradeType } from '../../domain/model/catanMatchState';

export interface TerrainBinding {
  hexId: HexId;
  worldTransform: Transform3D;
  terrain: TerrainType;
  materialPresetId: string;
  displacementPresetId: string;
  scatterPresetId: string;
  blockedByRobber: boolean;
  hotNumber: boolean;
  tokenId: TokenId | null;
  dirty: boolean;
}

export interface NumberTokenBinding {
  tokenId: TokenId;
  hexId: HexId;
  value: number;
  pips: number;
  isHotNumber: boolean;
  worldTransform: Transform3D;
  typographyPresetId: string;
  materialPresetId: string;
  dirty: boolean;
}

export interface HarborBinding {
  harborId: HarborId;
  tradeType: HarborTradeType;
  worldTransform: Transform3D;
  modelPresetId: string;
  signPresetId: string;
  connectedVertexIds: [VertexId, VertexId];
  dirty: boolean;
}

export interface EdgeBinding {
  edgeId: EdgeId;
  worldTransform: Transform3D;
  occupant: null | {
    playerId: string;
    color: string;
    pieceType: "ROAD";
  };
  ghostState: "NONE" | "LEGAL_PREVIEW" | "HOVER" | "INVALID";
  dirty: boolean;
}

export interface VertexBinding {
  vertexId: VertexId;
  worldPosition: { x: number; y: number; z: number };
  occupant: null | {
    playerId: string;
    color: string;
    pieceType: "SETTLEMENT" | "CITY";
  };
  ghostState: "NONE" | "LEGAL_PREVIEW" | "HOVER" | "INVALID";
  harborId: HarborId | null;
  dirty: boolean;
}

export interface RobberBinding {
  currentHexId: HexId;
  worldTransform: Transform3D;
  animationState: "IDLE" | "MOVE_IN" | "FOCUS";
  dirty: boolean;
}

export interface DiceBinding {
  visible: boolean;
  worldTransformA: Transform3D;
  worldTransformB: Transform3D;
  isRolling: boolean;
  settledValues: null | {
    dieA: number;
    dieB: number;
  };
  dirty: boolean;
}

export interface BoardGeometryBinding {
  type: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface BoardRenderBindingContract {
  boardGeometry: BoardGeometryBinding;
  terrainBindings: Record<HexId, TerrainBinding>;
  tokenBindings: Record<TokenId, NumberTokenBinding>;
  harborBindings: Record<HarborId, HarborBinding>;
  edgeBindings: Record<EdgeId, EdgeBinding>;
  vertexBindings: Record<VertexId, VertexBinding>;
  robberBinding: RobberBinding;
  diceBinding: DiceBinding;
}

export interface RenderDiff {
  fullBoardRebuild: boolean;
  changedTerrainHexIds: HexId[];
  changedTokenIds: TokenId[];
  changedHarborIds: HarborId[];
  changedEdgeIds: EdgeId[];
  changedVertexIds: VertexId[];
  robberChanged: boolean;
  diceChanged: boolean;
  lightingChanged: boolean;
  cameraChanged: boolean;
}

export interface CatanSceneRuntime {
  // To be mapped to Three.js primitives later
}

export interface RenderSyncEngine {
  buildBindings(state: CatanMatchState): BoardRenderBindingContract;
  diffBindings(
    previous: BoardRenderBindingContract | null,
    next: BoardRenderBindingContract
  ): RenderDiff;
  applyDiff(diff: RenderDiff, scene: CatanSceneRuntime, bindings: BoardRenderBindingContract): void;
}
