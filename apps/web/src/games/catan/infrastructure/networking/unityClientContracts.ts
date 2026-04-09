import { CatanMatchState } from '../../domain/model/catanMatchState';
import { CatanCommandEnvelope } from '../../domain/commands/commandEnvelope';
import { MatchId, StateDeltaPacket, ProjectionSyncPacket, ReconnectPayload } from './serverContracts';
import { SpectatorViewPacket } from './roomRuntime';

export interface EventBatchPacket {
  type: "EVENT_BATCH";
  matchId: MatchId;
  fromSequenceExclusive: number;
  toSequenceInclusive: number;
  events: any[]; // CatanDomainEventEnvelope[]
}

export interface FullSnapshotPacket {
  type: "FULL_SNAPSHOT";
  matchId: MatchId;
  sequence: number;
  state: CatanMatchState;
  projection: any;
  serverTime: number;
}

export type SyncPacket =
  | FullSnapshotPacket
  | EventBatchPacket
  | ProjectionSyncPacket
  | StateDeltaPacket
  | ReconnectPayload;

export interface UnitySyncClient {
  connect(matchId: MatchId, authToken: string): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(envelope: CatanCommandEnvelope): Promise<void>;
  onSyncPacket(packet: SyncPacket): void;
  onSpectatorPacket(packet: SpectatorViewPacket): void;
}

export interface UnityClientStateCache {
  currentSequence: number;
  state: CatanMatchState | null;
  projections: any | null; // ProjectionState
  bindings: any | null; // BoardRenderBindingContract
}

export interface UnityPacketHandlers {
  handleFullSnapshot(packet: FullSnapshotPacket): void;
  handleEventBatch(packet: EventBatchPacket): void;
  handleStateDelta(packet: StateDeltaPacket): void;
  handleProjectionSync(packet: ProjectionSyncPacket): void;
  handleReconnectPayload(packet: ReconnectPayload): void;
}
