import { CatanMatchState, PlayerId, UnixMs } from '../../domain/model/catanMatchState';
import { CatanCommandEnvelope } from '../../domain/commands/commandEnvelope';
import { MatchId, CommandAcceptanceResult } from './serverContracts';

export interface ConnectedPlayerSession {
  playerId: PlayerId;
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

export interface SpectatorViewPacket {
  type: "SPECTATOR_VIEW";
  matchId: MatchId;
  mode: "PUBLIC" | "COMMENTATOR" | "FULL_POSTGAME";
  sequence: number;
  filteredState: Partial<CatanMatchState>;
  projection: any;
}

export interface MatchRoomRuntime {
  matchId: MatchId;
  inMemoryState: CatanMatchState;
  connectedPlayers: Map<PlayerId, ConnectedPlayerSession>;
  connectedSpectators: Map<string, ConnectedSpectatorSession>;
  lastPersistedSequence: number;
  lastSnapshotSequence: number;
  dirtyProjection: boolean;
  dirtyReadModel: boolean;
}

export interface MatchRoomManager {
  createRoom(matchId: MatchId): Promise<MatchRoomRuntime>;
  loadRoom(matchId: MatchId): Promise<MatchRoomRuntime>;
  getRoom(matchId: MatchId): MatchRoomRuntime | null;
  evictRoom(matchId: MatchId): Promise<void>;
}

export interface RoomOwnershipRecord {
  matchId: MatchId;
  ownerNodeId: string;
  leasedUntil: UnixMs;
}

export interface PhotonRoomBridge {
  onPlayerConnected(matchId: MatchId, playerId: PlayerId): Promise<void>;
  onPlayerDisconnected(matchId: MatchId, playerId: PlayerId): Promise<void>;
  onCommandReceived(
    matchId: MatchId,
    commandEnvelope: CatanCommandEnvelope
  ): Promise<CommandAcceptanceResult>;
  broadcastToPlayers(matchId: MatchId, packet: any): Promise<void>;
  broadcastToSpectators(matchId: MatchId, packet: SpectatorViewPacket): Promise<void>;
}
