import { PlayerId, UnixMs } from '../../domain/model/catanMatchState';
import { MatchId, CommandId } from '../persistence/databaseSchema';

export interface MatchMetrics {
  matchId: MatchId;
  currentSequence: number;
  currentPhase: string;
  activePlayerId: PlayerId | null;
  connectedPlayers: number;
  connectedSpectators: number;
  commandAcceptRate: number;
  commandRejectRate: number;
  avgReducerLatencyMs: number;
  avgProjectionLatencyMs: number;
  avgBroadcastLatencyMs: number;
}

export interface CommandLogEntry {
  matchId: MatchId;
  commandId: CommandId;
  playerId: PlayerId;
  commandType: string;
  accepted: boolean;
  rejectionCode?: string;
  resultingSequence?: number;
  processingLatencyMs: number;
  timestamp: UnixMs;
}
