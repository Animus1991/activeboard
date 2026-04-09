import { MatchId } from '../persistence/databaseSchema';

export interface ReplayKeyMoment {
  type:
    | "MATCH_START"
    | "SETUP_END"
    | "DICE_ROLL"
    | "SEVEN_ROLLED"
    | "ROBBER_MOVE"
    | "SPECIAL_CARD_CHANGE"
    | "VICTORY_POINT_CHANGE"
    | "GAME_WIN";
  sequence: number;
  metadata?: Record<string, unknown>;
}

export interface ReplayIndex {
  matchId: MatchId;
  totalEvents: number;
  turnBoundaries: Array<{ turnNumber: number; startSequence: number; endSequence: number }>;
  keyMoments: ReplayKeyMoment[];
}

export interface ReplaySession {
  matchId: MatchId;
  totalEvents: number;
  currentSequence: number;
  currentState: any; // CatanMatchState
  stepForward(): void;
  stepBackward(): void;
  jumpToSequence(sequence: number): void;
  play(speed: number): void;
  pause(): void;
  projectUI(viewer: any): any;
}

export interface ReplayEngine {
  load(matchId: MatchId): Promise<ReplaySession>;
}
