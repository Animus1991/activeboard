import { CatanDomainEventEnvelope } from '../../domain/model/catanMatchState';
import { MatchId, MatchSnapshot } from '../networking/serverContracts';

export interface EventStore {
  append(matchId: MatchId, events: CatanDomainEventEnvelope[]): Promise<void>;
  loadAll(matchId: MatchId): Promise<CatanDomainEventEnvelope[]>;
  loadRange(
    matchId: MatchId,
    fromSequenceExclusive: number,
    toSequenceInclusive?: number
  ): Promise<CatanDomainEventEnvelope[]>;
  loadLatestSequence(matchId: MatchId): Promise<number>;
}

export interface SnapshotStore {
  save(snapshot: MatchSnapshot): Promise<void>;
  loadLatest(matchId: MatchId): Promise<MatchSnapshot | null>;
  loadAtOrBeforeSequence(matchId: MatchId, sequence: number): Promise<MatchSnapshot | null>;
}
