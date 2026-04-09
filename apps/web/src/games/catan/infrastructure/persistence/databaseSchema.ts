import { UnixMs, PlayerId } from '../../domain/model/catanMatchState';

export type MatchId = string;
export type EventId = string;
export type CommandId = string;

export interface MatchRecord {
  match_id: MatchId;
  game_type: string;
  rules_version: string;
  game_version: string;
  mode: string;
  created_by_player_id: PlayerId;
  created_at: UnixMs;
  started_at: UnixMs | null;
  ended_at: UnixMs | null;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  deterministic_seed: string;
  latest_sequence: number;
  latest_snapshot_sequence: number | null;
  winner_player_id: PlayerId | null;
}

export interface MatchPlayerRecord {
  match_id: MatchId;
  player_id: PlayerId;
  seat_index: number;
  color: string;
  join_order: number;
  is_bot: boolean;
  final_public_vp: number | null;
  final_total_vp: number | null;
  final_rank: number | null;
}

export interface MatchEventRecord {
  match_id: MatchId;
  sequence: number;
  event_id: EventId;
  emitted_at: UnixMs;
  caused_by_command_id: CommandId | null;
  caused_by_player_id: PlayerId | null;
  event_type: string;
  event_payload: unknown;
  checksum: string;
}

export interface MatchSnapshotRecord {
  match_id: MatchId;
  sequence: number;
  created_at: UnixMs;
  state_json: unknown;
  checksum: string;
  compressed: boolean;
}

export interface MatchReadModelRecord {
  match_id: MatchId;
  game_type: string;
  status: string;
  current_phase: string;
  active_player_id: PlayerId | null;
  turn_number: number;
  latest_sequence: number;
  latest_updated_at: UnixMs;
  public_summary: {
    visibleVpPerPlayer: Record<PlayerId, number>;
    currentTurn: number;
    boardSummary: unknown;
    spectatorSafeMetadata: unknown;
  };
}

export interface ReplayManifestRecord {
  replay_id: string;
  match_id: MatchId;
  created_at: UnixMs;
  storage_uri: string;
  total_events: number;
  final_sequence: number;
  replay_mode: 'public' | 'full_postgame' | 'internal_debug';
}

export interface CommandAuditRecord {
  command_id: CommandId;
  match_id: MatchId;
  issued_by_player_id: PlayerId;
  received_at: UnixMs;
  command_type: string;
  command_payload: unknown;
  accepted: boolean;
  rejection_code: string | null;
  rejection_message: string | null;
}
