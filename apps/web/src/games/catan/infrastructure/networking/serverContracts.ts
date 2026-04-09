import { CatanMatchState, UnixMs } from '../../domain/model/catanMatchState';
import { CatanDomainEventEnvelope } from '../../domain/model/catanMatchState';
import { CatanCommandEnvelope } from '../../domain/commands/commandEnvelope';

export type MatchId = string;

export interface CommandAcceptanceResult {
  accepted: boolean;
  eventsEmitted: number;
  newSequence: number;
  rejectionReason?: string;
}

export interface StateDeltaPacket {
  type: "STATE_DELTA";
  matchId: MatchId;
  baseSequence: number;
  newSequence: number;
  changedPaths: string[];
  payload: Record<string, unknown>;
}

export interface ProjectionSyncPacket {
  type: "PROJECTION_SYNC";
  matchId: MatchId;
  sequence: number;
  ui?: any; // To be typed strictly
  interaction?: any;
  render?: any;
  audio?: any;
  camera?: any;
}

export interface MatchSnapshot {
  matchId: MatchId;
  sequence: number;
  createdAt: UnixMs;
  state: CatanMatchState;
  checksum: string;
}

export interface ReconnectPayload {
  matchId: MatchId;
  latestSnapshot: MatchSnapshot | null;
  missingEvents: CatanDomainEventEnvelope[];
  currentProjection: any;
}

export interface ConnectedPlayerSession {
  playerId: string;
  connectionId: string;
  lastAckedSequence: number;
  currentViewRole: "ACTIVE_PLAYER" | "PLAYER";
  connectionStatus: "CONNECTED" | "RECONNECTING" | "DISCONNECTED";
}

export interface ConnectedSpectatorSession {
  spectatorId: string;
  connectionId: string;
  lastAckedSequence: number;
  viewMode: "PUBLIC" | "COMMENTATOR" | "DELAYED_FULL_REPLAY";
}

export interface CatanMatchRuntime {
  matchId: MatchId;
  state: CatanMatchState;
  lastSnapshotSequence: number;
  connectedPlayers: ConnectedPlayerSession[];
  connectedSpectators: ConnectedSpectatorSession[];
  eventBuffer: CatanDomainEventEnvelope[];
}

export interface AuthoritativeGameServer {
  receiveCommand(envelope: CatanCommandEnvelope): Promise<CommandAcceptanceResult>;
  loadMatch(matchId: MatchId): Promise<CatanMatchRuntime>;
  persistEvent(envelope: CatanDomainEventEnvelope): Promise<void>;
  persistSnapshot(snapshot: MatchSnapshot): Promise<void>;
  broadcastStateDelta(matchId: MatchId, delta: StateDeltaPacket): Promise<void>;
  broadcastProjectionUpdate(matchId: MatchId, update: ProjectionSyncPacket): Promise<void>;
  handleReconnect(playerId: string, matchId: MatchId): Promise<ReconnectPayload>;
}
